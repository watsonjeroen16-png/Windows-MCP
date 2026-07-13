/**
 * Companion customization — species/personality/environment, editable any
 * time post-onboarding (unlike onboarding's one-time choice). Zod-validated,
 * requires the session-token auth from middleware/auth.ts (imported, not
 * edited). Default export is a factory — see routes/intentions.ts for the
 * same shape and rationale.
 *
 * Mounted in app.ts alongside the onboarding/verify/sms routers.
 */

import { Router } from "express";
import { z } from "zod";

import type { Db } from "../db/types.js";
import type { WorldDb } from "../db/world-types.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { COMPANIONS, ENVIRONMENTS, PERSONALITIES } from "../schemas.js";
import type { SessionTokenService } from "../services/session-token.js";

const updateCustomizationSchema = z.object({
  companionSpecies: z.enum(COMPANIONS),
  personality: z.enum(PERSONALITIES),
  environment: z.enum(ENVIRONMENTS),
});

export interface CustomizationRouterDeps {
  db: Db;
  worldDb: WorldDb;
  sessionTokens: SessionTokenService;
}

export function createCustomizationRouter({
  db,
  worldDb,
  sessionTokens,
}: CustomizationRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(sessionTokens));

  // GET / — current customization. Falls back to the onboarding profile's
  // original choice if the user has never customized post-onboarding.
  router.get("/", async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;
      const user = await db.getUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }

      const customization = await worldDb.getCustomization(user.id);
      if (customization) {
        res.status(200).json({ customization, source: "customization" });
        return;
      }

      const withProfile = await db.getUserWithProfile(phone);
      if (withProfile?.profile) {
        res.status(200).json({
          customization: {
            companion_species: withProfile.profile.companion,
            personality: withProfile.profile.personality,
            environment: withProfile.profile.environment,
          },
          source: "onboarding_profile",
        });
        return;
      }

      res.status(404).json({ error: "not_customized" });
    } catch (err) {
      next(err);
    }
  });

  // PUT / — update species/personality/environment (full replacement).
  router.put("/", validateBody(updateCustomizationSchema), async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;
      const user = await db.getUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }

      const input = req.body as z.infer<typeof updateCustomizationSchema>;
      const customization = await worldDb.upsertCustomization(user.id, input);
      res.status(200).json({ customization });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createCustomizationRouter;
