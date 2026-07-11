/**
 * Express app factory. Pure with respect to the environment: all external
 * dependencies (db, SMS provider, rate limits, logging) are injected so tests
 * can run fully in-memory in mock mode.
 */

import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";

import type { Db } from "./db/types.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import {
  createVerifyIpRateLimit,
  GlobalSendCircuitBreaker,
  PhoneRateLimiter,
  type RateLimitOptions,
} from "./middleware/rate-limit.js";
import { createOnboardingRouter } from "./routes/onboarding.js";
import { createSmsRouter } from "./routes/sms.js";
import { createVerifyRouter } from "./routes/verify.js";
import type { SessionTokenService } from "./services/session-token.js";
import type { SmsService } from "./services/twilio.js";

export interface CreateAppOptions {
  db: Db;
  sms: SmsService;
  sessionTokens: SessionTokenService;
  /** Per-IP limit for /api/verify/* (default 5/min). */
  verifyRateLimit?: RateLimitOptions;
  /** Per-phone limit for /api/verify/* (default 5/min). */
  verifyPhoneRateLimit?: { max?: number; windowMs?: number };
  /** Per-phone daily cap on /api/verify/start (default 5/day). SMS-pumping guard, M-1. */
  verifyPhoneDailyRateLimit?: { max?: number; windowMs?: number };
  /** Aggregate cap on all outbound Twilio sends (default 300/hour). M-1. */
  globalSendLimit?: { max?: number; windowMs?: number };
  /** Enforce the 21:30-07:30 quiet-hours window on /api/sms/welcome. */
  enforceQuietHours?: boolean;
  /** Request logging (morgan tiny). Off in tests. */
  logging?: boolean;
  now?: () => Date;
}

export function createApp(options: CreateAppOptions): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "16kb" }));
  if (options.logging !== false) {
    app.use(morgan("tiny"));
  }

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const phoneLimiter = new PhoneRateLimiter(
    options.verifyPhoneRateLimit?.max ?? 5,
    options.verifyPhoneRateLimit?.windowMs ?? 60_000
  );
  const dailyPhoneLimiter = new PhoneRateLimiter(
    options.verifyPhoneDailyRateLimit?.max ?? 5,
    options.verifyPhoneDailyRateLimit?.windowMs ?? 24 * 60 * 60 * 1000
  );
  const globalSendBreaker = new GlobalSendCircuitBreaker(
    options.globalSendLimit?.max ?? 300,
    options.globalSendLimit?.windowMs ?? 60 * 60 * 1000
  );
  const auth = requireAuth(options.sessionTokens);

  // Periodic sweep of stale per-phone rate-limit entries: without this, a
  // phone number that hits the limiter once and never recurs stays in
  // memory forever (unbounded growth under a botnet with distinct phones,
  // L-3 in docs/security-review.md). unref() so it never keeps the process
  // (or a test run) alive.
  const sweepInterval = setInterval(
    () => {
      phoneLimiter.sweep();
      dailyPhoneLimiter.sweep();
    },
    10 * 60 * 1000
  );
  sweepInterval.unref();

  app.use(
    "/api/verify",
    createVerifyIpRateLimit(options.verifyRateLimit),
    createVerifyRouter({
      db: options.db,
      sms: options.sms,
      phoneLimiter,
      dailyPhoneLimiter,
      globalSendBreaker,
      sessionTokens: options.sessionTokens,
    })
  );
  app.use(
    "/api/onboarding",
    createVerifyIpRateLimit(options.verifyRateLimit),
    auth,
    createOnboardingRouter({ db: options.db })
  );
  app.use(
    "/api/sms",
    createVerifyIpRateLimit(options.verifyRateLimit),
    auth,
    createSmsRouter({
      db: options.db,
      sms: options.sms,
      enforceQuietHours: options.enforceQuietHours,
      now: options.now,
      globalSendBreaker,
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
