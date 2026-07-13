import { Router } from "express";

import type { Db } from "../db/types.js";
import type { AuthedRequest } from "../middleware/auth.js";
import type { GlobalSendCircuitBreaker } from "../middleware/rate-limit.js";
import { validateBody } from "../middleware/validate.js";
import { welcomeSchema } from "../schemas.js";
import { renderWelcomeSms } from "../services/sms-templates.js";
import type { SmsService } from "../services/twilio.js";

export interface SmsRouterDeps {
  db: Db;
  sms: SmsService;
  /** Spec: no sends 21:30-07:30 local. Enforced only when configured on. */
  enforceQuietHours?: boolean;
  now?: () => Date;
  /** Shared with /api/verify/start — aggregate cap on all outbound sends (M-1). */
  globalSendBreaker?: GlobalSendCircuitBreaker;
}

/** Quiet hours per spec: 21:30-07:30 (server-local time). */
export function isQuietHours(date: Date): boolean {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= 21 * 60 + 30 || minutes < 7 * 60 + 30;
}

export function createSmsRouter({
  db,
  sms,
  enforceQuietHours = false,
  now,
  globalSendBreaker,
}: SmsRouterDeps): Router {
  const router = Router();
  const clock = now ?? (() => new Date());

  // POST /api/sms/welcome — render the personality template and send the
  // first companion SMS. The phone is the one bound to the caller's bearer
  // token (see middleware/auth.ts), never a value from the request body
  // (H-2). Refuses when the profile is missing or the user was already
  // welcomed.
  router.post("/welcome", validateBody(welcomeSchema), async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;

      if (globalSendBreaker && !globalSendBreaker.allow()) {
        res.status(503).json({
          error: "circuit_open",
          detail: "sends are temporarily paused, try again later",
        });
        return;
      }

      const record = await db.getUserWithProfile(phone);
      if (!record) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }
      if (!record.profile) {
        res.status(409).json({
          error: "profile_missing",
          detail: "complete onboarding before requesting the welcome SMS",
        });
        return;
      }
      if (record.user.welcomed_at) {
        res.status(409).json({ error: "already_welcomed" });
        return;
      }

      if (enforceQuietHours && isQuietHours(clock())) {
        res.status(409).json({
          error: "quiet_hours",
          detail: "no sends between 21:30 and 07:30",
        });
        return;
      }

      const firstGoal = record.profile.goals[0];
      if (!firstGoal) {
        res.status(409).json({ error: "profile_missing", detail: "profile has no goals" });
        return;
      }

      // Claim the send atomically before doing any actual work: two
      // concurrent requests can both pass the check above (both read
      // welcomed_at as null), but only one can win this conditional update.
      // The loser must not render/send at all — prevents a double Twilio
      // send under a race (see db/types.ts markWelcomed for the contract).
      const claimed = await db.markWelcomed(record.user.id);
      if (!claimed) {
        res.status(409).json({ error: "already_welcomed" });
        return;
      }

      const body = renderWelcomeSms({
        personality: record.profile.personality,
        firstGoal,
        identityWhy: record.profile.identity_why,
      });

      const result = await sms.sendSms(phone, body);

      if (result.mock) {
        res.status(200).json({ status: "queued", mock: true, body });
        return;
      }
      res.status(200).json({ status: result.status, sid: result.sid, mock: false });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
