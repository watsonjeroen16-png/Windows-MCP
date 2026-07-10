/**
 * Twilio Verify + Messaging behind one interface, with a deterministic mock.
 *
 * Mock mode (any Twilio env var absent):
 *   - verify start always returns pending
 *   - verify check approves ONLY the code "000000"
 *   - SMS is logged, never sent
 */

import type { TwilioConfig } from "../config.js";

export interface VerifyStartResult {
  status: "pending";
  mock: boolean;
}

export interface VerifyCheckResult {
  approved: boolean;
  mock: boolean;
}

export interface SendSmsResult {
  status: "queued" | "sent" | "accepted";
  sid?: string;
  mock: boolean;
  /** Rendered body — only echoed back in mock mode. */
  body?: string;
}

export interface SmsService {
  readonly mock: boolean;
  startVerification(phone: string): Promise<VerifyStartResult>;
  checkVerification(phone: string, code: string): Promise<VerifyCheckResult>;
  sendSms(to: string, body: string): Promise<SendSmsResult>;
}

export const MOCK_APPROVAL_CODE = "000000";

export function createMockSmsService(
  log: (msg: string) => void = (msg) => console.log(msg)
): SmsService {
  return {
    mock: true,
    async startVerification(phone: string): Promise<VerifyStartResult> {
      log(`[twilio:mock] verify start for ${phone} (code is ${MOCK_APPROVAL_CODE})`);
      return { status: "pending", mock: true };
    },
    async checkVerification(phone: string, code: string): Promise<VerifyCheckResult> {
      const approved = code === MOCK_APPROVAL_CODE;
      log(`[twilio:mock] verify check for ${phone}: ${approved ? "approved" : "rejected"}`);
      return { approved, mock: true };
    },
    async sendSms(to: string, body: string): Promise<SendSmsResult> {
      log(`[twilio:mock] SMS to ${to}:\n${body}`);
      return { status: "queued", mock: true, body };
    },
  };
}

/**
 * Real Twilio implementation. The SDK is imported lazily so mock-mode
 * processes (and tests) never load or initialize the Twilio client.
 */
export async function createRealSmsService(config: TwilioConfig): Promise<SmsService> {
  const { default: twilio } = await import("twilio");
  const client = twilio(config.accountSid, config.authToken);

  return {
    mock: false,
    async startVerification(phone: string): Promise<VerifyStartResult> {
      await client.verify.v2
        .services(config.verifyServiceSid)
        .verifications.create({ to: phone, channel: "sms" });
      return { status: "pending", mock: false };
    },
    async checkVerification(phone: string, code: string): Promise<VerifyCheckResult> {
      const check = await client.verify.v2
        .services(config.verifyServiceSid)
        .verificationChecks.create({ to: phone, code });
      return { approved: check.status === "approved", mock: false };
    },
    async sendSms(to: string, body: string): Promise<SendSmsResult> {
      const message = await client.messages.create({
        to,
        from: config.messagingFrom,
        body,
      });
      return {
        status: (message.status as SendSmsResult["status"]) ?? "queued",
        sid: message.sid,
        mock: false,
      };
    },
  };
}
