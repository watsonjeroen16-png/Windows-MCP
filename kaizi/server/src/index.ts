/**
 * Bootstrap: load env, pick mock vs real Twilio, wire Postgres, start HTTP.
 */

import "dotenv/config";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPgDb } from "./db/index.js";
import { createMockSmsService, createRealSmsService, MOCK_APPROVAL_CODE } from "./services/twilio.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.mockMode) {
    console.log(
      "[kaizi] TWILIO MOCK MODE — one or more Twilio env vars are missing.\n" +
        `[kaizi]   verify: code "${MOCK_APPROVAL_CODE}" approves; SMS bodies are logged, not sent.`
    );
  } else {
    console.log("[kaizi] Twilio LIVE mode — Verify + Messaging calls will hit Twilio.");
  }

  const sms = config.mockMode
    ? createMockSmsService()
    : await createRealSmsService(config.twilio!);

  const db = createPgDb(config.databaseUrl);

  const app = createApp({
    db,
    sms,
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
