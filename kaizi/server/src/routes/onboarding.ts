import { Router } from "express";

import type { Db } from "../db/types.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { profileSchema, submitQuizSchema, type ProfileInput, type SubmitQuizInput } from "../schemas.js";

export const MEMORY_KIND_IDENTITY_WHY = "identity_why";

export function createOnboardingRouter({ db }: { db: Db }): Router {
  const router = Router();

  // POST /api/onboarding/profile — persist goals, identityWhy, companion,
  // personality, environment, smsPrefs. Requires a verified phone. The phone
  // is the one bound to the caller's bearer token (see middleware/auth.ts),
  // never a value from the request body — a body `phone` field, if sent, is
  // ignored (H-2). Idempotent-ish: re-posting for the same user updates the
  // profile.
  router.post("/profile", validateBody(profileSchema), async (req, res, next) => {
    try {
      const input = req.body as ProfileInput;
      const phone = (req as AuthedRequest).authPhone!;

      const user = await db.getUserByPhone(phone);
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

  // POST /api/onboarding/quiz — persist the 10-question onboarding quiz
  // (personalization-spec.md section 1), or record a full "Skip quiz" via
  // skippedEntirely. Same auth/session pattern as POST /profile: identity
  // comes from the bearer token (never the body), requires a verified phone.
  // Idempotent-ish upsert, matching /profile's re-post semantics — a user
  // who backs up and changes an answer before finishing onboarding just
  // re-submits.
  router.post("/quiz", validateBody(submitQuizSchema), async (req, res, next) => {
    try {
      const input = req.body as SubmitQuizInput;
      const phone = (req as AuthedRequest).authPhone!;

      const user = await db.getUserByPhone(phone);
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
          detail: "phone must be verified before saving quiz responses",
        });
        return;
      }

      const result = await db.upsertQuizResponses(user.id, {
        answers: input.answers,
        skippedEntirely: input.skippedEntirely,
      });

      res.status(result.created ? 201 : 200).json({
        ok: true,
        userId: user.id,
        created: result.created,
        skippedEntirely: result.row.skipped_entirely,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
