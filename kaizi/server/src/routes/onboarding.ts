import { Router } from "express";

import type { Db } from "../db/types.js";
import { validateBody } from "../middleware/validate.js";
import { profileSchema, type ProfileInput } from "../schemas.js";

export const MEMORY_KIND_IDENTITY_WHY = "identity_why";

export function createOnboardingRouter({ db }: { db: Db }): Router {
  const router = Router();

  // POST /api/onboarding/profile — persist goals, identityWhy, companion,
  // personality, environment, smsPrefs. Requires a verified phone.
  // Idempotent-ish: re-posting for the same user updates the profile.
  router.post("/profile", validateBody(profileSchema), async (req, res, next) => {
    try {
      const input = req.body as ProfileInput;

      const user = await db.getUserByPhone(input.phone);
      if (!user) {
        res.status(404).json({
          error: "phone_not_found",
          detail: "no user for this phone — complete verification first",
        });
        return;
      }
      if (!user.phone_verified_at) {
        res.status(409).json({
          error: "phone_not_verified",
          detail: "phone must be verified before saving a profile",
        });
        return;
      }

      const result = await db.upsertProfile(user.id, {
        goals: input.goals,
        identityWhy: input.identityWhy,
        companion: input.companion,
        personality: input.personality,
        environment: input.environment,
      });
      await db.upsertSmsPreferences(user.id, input.smsPrefs);

      // Seed companion memory with the identity answer. On updates, only add a
      // new entry when the answer actually changed (memory is append-only).
      if (result.created || result.previousIdentityWhy !== input.identityWhy) {
        await db.insertMemoryEntry(user.id, MEMORY_KIND_IDENTITY_WHY, input.identityWhy);
      }

      res.status(result.created ? 201 : 200).json({
        ok: true,
        userId: user.id,
        created: result.created,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
