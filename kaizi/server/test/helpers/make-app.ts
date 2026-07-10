/**
 * Test harness: app factory wired to the in-memory db and mock Twilio.
 */

import type { Express } from "express";

import { createApp, type CreateAppOptions } from "../../src/app.js";
import { createMockSmsService } from "../../src/services/twilio.js";
import { createMemoryDb, type MemoryDb } from "./memory-db.js";

export interface TestApp {
  app: Express;
  db: MemoryDb;
  smsLog: string[];
}

export function makeTestApp(overrides: Partial<CreateAppOptions> = {}): TestApp {
  const db = createMemoryDb();
  const smsLog: string[] = [];
  const sms = createMockSmsService((msg) => smsLog.push(msg));

  const app = createApp({
    db,
    sms,
    logging: false,
    // Generous defaults so ordinary tests never trip limits; the rate-limit
    // test overrides these explicitly.
    verifyRateLimit: { max: 1000, windowMs: 60_000 },
    verifyPhoneRateLimit: { max: 1000, windowMs: 60_000 },
    ...overrides,
  });

  return { app, db, smsLog };
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
