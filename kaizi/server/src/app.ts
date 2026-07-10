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
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import {
  createVerifyIpRateLimit,
  PhoneRateLimiter,
  type RateLimitOptions,
} from "./middleware/rate-limit.js";
import { createOnboardingRouter } from "./routes/onboarding.js";
import { createSmsRouter } from "./routes/sms.js";
import { createVerifyRouter } from "./routes/verify.js";
import type { SmsService } from "./services/twilio.js";

export interface CreateAppOptions {
  db: Db;
  sms: SmsService;
  /** Per-IP limit for /api/verify/* (default 5/min). */
  verifyRateLimit?: RateLimitOptions;
  /** Per-phone limit for /api/verify/* (default 5/min). */
  verifyPhoneRateLimit?: { max?: number; windowMs?: number };
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

  app.use(
    "/api/verify",
    createVerifyIpRateLimit(options.verifyRateLimit),
    createVerifyRouter({ db: options.db, sms: options.sms, phoneLimiter })
  );
  app.use("/api/onboarding", createOnboardingRouter({ db: options.db }));
  app.use(
    "/api/sms",
    createSmsRouter({
      db: options.db,
      sms: options.sms,
      enforceQuietHours: options.enforceQuietHours,
      now: options.now,
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
