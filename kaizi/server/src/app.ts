/**
 * Express app factory. Pure with respect to the environment: all external
 * dependencies (db, SMS provider, rate limits, logging) are injected so tests
 * can run fully in-memory in mock mode.
 */

import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";

import type { Db } from "./db/types.js";
import type { WorldDb } from "./db/world-types.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import {
  createVerifyIpRateLimit,
  GlobalSendCircuitBreaker,
  PhoneRateLimiter,
  type RateLimitOptions,
} from "./middleware/rate-limit.js";
import createChatRouter from "./routes/chat.js";
import createCustomizationRouter from "./routes/customization.js";
import createIntentionsRouter from "./routes/intentions.js";
import createJournalRouter from "./routes/journal.js";
import { createOnboardingRouter } from "./routes/onboarding.js";
import { createSmsRouter } from "./routes/sms.js";
import { createVerifyRouter } from "./routes/verify.js";
import type { SessionTokenService } from "./services/session-token.js";
import type { SmsService } from "./services/twilio.js";

export interface CreateAppOptions {
  db: Db;
  sms: SmsService;
  sessionTokens: SessionTokenService;
  worldDb: WorldDb;
  /** Per-IP limit for /api/verify/* (default 5/min). */
  verifyRateLimit?: RateLimitOptions;
  /** Per-phone limit for /api/verify/* (default 5/min). */
  verifyPhoneRateLimit?: { max?: number; windowMs?: number };
  /** Per-phone daily cap on /api/verify/start (default 5/day). SMS-pumping guard, M-1. */
  verifyPhoneDailyRateLimit?: { max?: number; windowMs?: number };
  /** Aggregate cap on all outbound Twilio sends (default 300/hour). M-1. */
  globalSendLimit?: { max?: number; windowMs?: number };
  /**
   * Per-IP limit for the Companion World routes (/api/intentions, /api/chat,
   * /api/customization, /api/journal) — default 30/min. Looser than the
   * verify/onboarding/sms default (5/min) since these are normal in-app
   * interactions, not phone-verification attempts, but /api/chat calls the
   * real Claude API per message once ANTHROPIC_API_KEY is set, so an
   * unbounded rate here is a real-money abuse vector the same way
   * unbounded /api/verify/start is for Twilio (M-1 in security-review.md).
   */
  worldRateLimit?: RateLimitOptions;
  /** Enforce the 21:30-07:30 quiet-hours window on /api/sms/welcome. */
  enforceQuietHours?: boolean;
  /** Request logging (morgan tiny). Off in tests. */
  logging?: boolean;
  now?: () => Date;
}

export function createApp(options: CreateAppOptions): Express {
  const app = express();

  app.disable("x-powered-by");
  if (process.env.NODE_ENV === "production") {
    // Railway (and every mainstream PaaS this project's DEPLOYMENT.md
    // targets) terminates TLS and proxies through exactly one hop before
    // traffic reaches this process. Without this, express-rate-limit and
    // PhoneRateLimiter key on the proxy's IP for every request — degrading
    // the per-IP verify limiter to a single shared global bucket (self-DoS)
    // — because `req.ip` falls back to the socket address, not
    // X-Forwarded-For. Trusting exactly 1 hop (not `true`, which would trust
    // an attacker-supplied X-Forwarded-For with no proxy in front of it) is
    // the fix docs/security-review.md L-2 recommends. Off in dev/test so
    // local `req.ip` behavior (and existing rate-limit tests) is unchanged.
    app.set("trust proxy", 1);
  }
  app.use(helmet());
  // No `cors()` middleware: Kaizi has no browser client (the app is native
  // Expo, and native fetch ignores CORS entirely), so `Access-Control-Allow-
  // Origin: *` only ever helped an unauthenticated web page use a visitor's
  // browser as an unwitting caller against these endpoints — closing this
  // combines with the auth requirement (H-2) and rate limits (M-1/M-3) to
  // remove that vector. Browsers now enforce their same-origin default,
  // which is irrelevant to native clients. See docs/security-review.md M-4.
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
  const worldIpRateLimit = createVerifyIpRateLimit({
    max: options.worldRateLimit?.max ?? 30,
    windowMs: options.worldRateLimit?.windowMs ?? 60_000,
  });

  app.use(
    "/api/intentions",
    worldIpRateLimit,
    createIntentionsRouter({ db: options.db, worldDb: options.worldDb, sessionTokens: options.sessionTokens })
  );
  app.use(
    "/api/chat",
    worldIpRateLimit,
    createChatRouter({ db: options.db, worldDb: options.worldDb, sessionTokens: options.sessionTokens })
  );
  app.use(
    "/api/customization",
    worldIpRateLimit,
    createCustomizationRouter({ db: options.db, worldDb: options.worldDb, sessionTokens: options.sessionTokens })
  );
  app.use(
    "/api/journal",
    worldIpRateLimit,
    createJournalRouter({ db: options.db, worldDb: options.worldDb, sessionTokens: options.sessionTokens })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
