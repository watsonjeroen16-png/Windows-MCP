import { Router } from "express";

import type { Db } from "../db/types.js";
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
}

/** Quiet hours per spec: 21:30-07:30 (server-local time). */
export function isQuietHours(date: Date): boolean {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= 21 * 60 + 30 || minutes < 7 * 60 + 30;
}

export function createSmsRouter({ db, sms, enforceQuietHours = false, now }: SmsRouterDeps): Router {
  const router = Router();
  const clock = now ?? (() => new Date());

  // POST /api/sms/welcome — render the personality template and send the
  // first companion SMS. Refuses when the profile is missing or the user
  // was already welcomed.
  router.post("/welcome", validateBody(welcomeSchema), async (req, res, next) => {
    try {
      const { phone } = req.body as { phone: string };

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

      const body = renderWelcomeSms({
        personality: record.profile.personality,
        firstGoal,
        identityWhy: record.profile.identity_why,
      });

      const result = await sms.sendSms(phone, body);
      await db.markWelcomed(record.user.id);

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
