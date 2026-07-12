/**
 * Test harness: app factory wired to the in-memory db and mock Twilio.
 */

import type { Express } from "express";

import { createApp, type CreateAppOptions } from "../../src/app.js";
import { createMemoryWorldDb, type MemoryWorldDb } from "../../src/db/world-memory.js";
import { createSessionTokenService, type SessionTokenService } from "../../src/services/session-token.js";
import { createMockSmsService } from "../../src/services/twilio.js";
import { createMemoryDb, type MemoryDb } from "./memory-db.js";

export interface TestApp {
  app: Express;
  db: MemoryDb;
  worldDb: MemoryWorldDb;
  smsLog: string[];
  sessionTokens: SessionTokenService;
}

const TEST_SESSION_SECRET = "test-session-secret-not-for-production";

export function makeTestApp(overrides: Partial<CreateAppOptions> = {}): TestApp {
  const db = createMemoryDb();
  const worldDb = createMemoryWorldDb();
  const smsLog: string[] = [];
  const sms = createMockSmsService((msg) => smsLog.push(msg));
  const sessionTokens = createSessionTokenService(TEST_SESSION_SECRET);

  const app = createApp({
    db,
    sms,
    sessionTokens,
    worldDb,
    logging: false,
    // Generous defaults so ordinary tests never trip limits; the rate-limit
    // test overrides these explicitly.
    verifyRateLimit: { max: 1000, windowMs: 60_000 },
    verifyPhoneRateLimit: { max: 1000, windowMs: 60_000 },
    verifyPhoneDailyRateLimit: { max: 1000, windowMs: 24 * 60 * 60 * 1000 },
    globalSendLimit: { max: 1000, windowMs: 60 * 60 * 1000 },
    worldRateLimit: { max: 1000, windowMs: 60_000 },
    ...overrides,
  });

  return { app, db, worldDb, smsLog, sessionTokens };
}

/** Build an `Authorization: Bearer <token>` header value for `phone` directly, bypassing verify/check. */
export function authHeaderFor(sessionTokens: SessionTokenService, phone: string): string {
  return `Bearer ${sessionTokens.issue(phone).token}`;
}

export const VALID_PROFILE_BODY = {
  phone: "+15551234567",
  goals: ["fitness", "discipline"],
  identityWhy: "Because I'm tired of almost. Because my kids are watching.",
  companion: "fox",
  personality: "coach",
  environment: "japanese_garden",
  smsPrefs: { morning: true, evening: true },
} as const;
