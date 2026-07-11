/**
 * Environment configuration for the Kaizi onboarding server.
 *
 * Mock mode is active when ANY Twilio variable is missing — the server must
 * never crash (or make network calls) without credentials.
 */

import { randomBytes } from "node:crypto";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
  messagingFrom: string;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  mockMode: boolean;
  twilio: TwilioConfig | null;
  enforceQuietHours: boolean;
  /** HMAC secret for signing post-verification session tokens (see services/session-token.ts). */
  sessionSecret: string;
  /** True when SESSION_SECRET was not set and a random one was generated for this process. */
  sessionSecretGenerated: boolean;
}

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const verifyServiceSid = env.TWILIO_VERIFY_SERVICE_SID?.trim();
  const messagingFrom = env.TWILIO_MESSAGING_FROM?.trim();

  const haveAllTwilio = Boolean(accountSid && authToken && verifyServiceSid && messagingFrom);

  const envSessionSecret = env.SESSION_SECRET?.trim();
  const sessionSecretGenerated = !envSessionSecret;
  // Dev/CI convenience: generate a per-process secret when unset so the
  // server never crashes for lack of config. index.ts refuses to start with
  // a generated secret when NODE_ENV=production (same pattern as H-1).
  const sessionSecret = envSessionSecret ?? randomBytes(32).toString("hex");

  return {
    port: Number(env.PORT ?? 4000),
    databaseUrl: env.DATABASE_URL ?? "postgres://postgres:kaizi@localhost:5432/kaizi",
    mockMode: !haveAllTwilio,
    twilio: haveAllTwilio
      ? {
          accountSid: accountSid!,
          authToken: authToken!,
          verifyServiceSid: verifyServiceSid!,
          messagingFrom: messagingFrom!,
        }
      : null,
    enforceQuietHours: truthy(env.KAIZI_ENFORCE_QUIET_HOURS),
    sessionSecret,
    sessionSecretGenerated,
  };
}
