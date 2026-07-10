/**
 * Environment configuration for the Kaizi onboarding server.
 *
 * Mock mode is active when ANY Twilio variable is missing — the server must
 * never crash (or make network calls) without credentials.
 */

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
  };
}
