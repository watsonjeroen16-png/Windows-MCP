import { Router } from "express";

import type { Db } from "../db/types.js";
import { GlobalSendCircuitBreaker, PhoneRateLimiter } from "../middleware/rate-limit.js";
import { validateBody } from "../middleware/validate.js";
import { verifyCheckSchema, verifyStartSchema } from "../schemas.js";
import type { SessionTokenService } from "../services/session-token.js";
import type { SmsService } from "../services/twilio.js";

export interface VerifyRouterDeps {
  db: Db;
  sms: SmsService;
  phoneLimiter: PhoneRateLimiter;
  /** Per-phone daily cap on verification sends (SMS-pumping guard, M-1). */
  dailyPhoneLimiter: PhoneRateLimiter;
  /** Aggregate circuit breaker shared across all outbound sends (M-1). */
  globalSendBreaker: GlobalSendCircuitBreaker;
  sessionTokens: SessionTokenService;
}

export function createVerifyRouter({
  db,
  sms,
  phoneLimiter,
  dailyPhoneLimiter,
  globalSendBreaker,
  sessionTokens,
}: VerifyRouterDeps): Router {
  const router = Router();

  // POST /api/verify/start — begin Twilio Verify for an E.164 phone.
  router.post("/start", validateBody(verifyStartSchema), async (req, res, next) => {
    try {
      const { phone } = req.body as { phone: string };

      if (!phoneLimiter.allow(phone)) {
        res.status(429).json({ error: "rate_limited", detail: "too many attempts for this phone" });
        return;
      }
      if (!dailyPhoneLimiter.allow(phone)) {
        res.status(429).json({
          error: "rate_limited",
          detail: "daily verification limit reached for this phone",
        });
        return;
      }
      if (!globalSendBreaker.allow()) {
        res.status(503).json({
          error: "circuit_open",
          detail: "verification sends are temporarily paused, try again later",
        });
        return;
      }

      const result = await sms.startVerification(phone);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/verify/check — check a verification code; upsert user on approval
  // and issue a short-lived session token bound to the phone (H-2). The
  // token is required as `Authorization: Bearer <token>` on
  // /api/onboarding/profile and /api/sms/welcome.
  router.post("/check", validateBody(verifyCheckSchema), async (req, res, next) => {
    try {
      const { phone, code } = req.body as { phone: string; code: string };

      if (!phoneLimiter.allow(phone)) {
        res.status(429).json({ error: "rate_limited", detail: "too many attempts for this phone" });
        return;
      }

      const result = await sms.checkVerification(phone, code);
      if (!result.approved) {
        res.status(400).json({ error: "invalid_code" });
        return;
      }

      const user = await db.upsertVerifiedUser(phone);
      const { token, expiresAt } = sessionTokens.issue(phone);
      res.status(200).json({
        status: "approved",
        verified: true,
        userId: user.id,
        mock: result.mock,
        token,
        expiresAt,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
