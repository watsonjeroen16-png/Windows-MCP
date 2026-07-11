/**
 * Bootstrap: load env, pick mock vs real Twilio, wire Postgres, start HTTP.
 */

import "dotenv/config";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPgDb } from "./db/index.js";
import { createSessionTokenService } from "./services/session-token.js";
import { createMockSmsService, createRealSmsService, MOCK_APPROVAL_CODE } from "./services/twilio.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.mockMode) {
    // Fail closed: mock verification approves the fixed code "000000" for any
    // phone. That must never be reachable in production.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[kaizi] FATAL: Twilio env vars are missing but NODE_ENV=production — " +
          "refusing to start with mock verification (code 000000 would approve any phone)."
      );
      process.exit(1);
    }
    console.log(
      "[kaizi] TWILIO MOCK MODE — one or more Twilio env vars are missing.\n" +
        `[kaizi]   verify: code "${MOCK_APPROVAL_CODE}" approves; SMS bodies are logged, not sent.`
    );
  } else {
    console.log("[kaizi] Twilio LIVE mode — Verify + Messaging calls will hit Twilio.");
  }

  if (config.sessionSecretGenerated && process.env.NODE_ENV === "production") {
    // Fail closed: a per-process random secret means tokens don't survive a
    // restart or a multi-replica deploy, and rotation is invisible. Same
    // posture as the mock-mode guard above — never silently degrade auth.
    console.error(
      "[kaizi] FATAL: SESSION_SECRET is not set but NODE_ENV=production — " +
        "refusing to start with an auto-generated session-token secret."
    );
    process.exit(1);
  }
  if (config.sessionSecretGenerated) {
    console.log(
      "[kaizi] SESSION_SECRET not set — using a random per-process secret (dev only; " +
        "tokens invalidate on restart)."
    );
  }

  const sms = config.mockMode
    ? createMockSmsService()
    : await createRealSmsService(config.twilio!);

  const db = createPgDb(config.databaseUrl);
  const sessionTokens = createSessionTokenService(config.sessionSecret);

  const app = createApp({
    db,
    sms,
    sessionTokens,
    enforceQuietHours: config.enforceQuietHours,
  });

  const server = app.listen(config.port, () => {
    console.log(`[kaizi] onboarding API listening on http://localhost:${config.port}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`[kaizi] ${signal} received, shutting down`);
    server.close(() => {
      db.close()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[kaizi] fatal startup error:", err);
  process.exit(1);
});
