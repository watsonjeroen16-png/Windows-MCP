/**
 * Intentions — the renamed "Promises" mechanic (daily habit/commitment
 * instances). Zod-validated, requires the session-token auth from
 * middleware/auth.ts (imported, not edited). Default export is a factory —
 * `createIntentionsRouter(deps)` — so the caller supplies the onboarding Db
 * (for phone -> userId lookup, same pattern as routes/onboarding.ts) and the
 * new WorldDb, without this file constructing its own connections.
 *
 * Not wired into app.ts/index.ts here — see PENDING_INTEGRATION.md.
 */

import { Router } from "express";
import { z } from "zod";

import type { Db } from "../db/types.js";
import type { WorldDb } from "../db/world-types.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import type { SessionTokenService } from "../services/session-token.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const createIntentionSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200, "title too long"),
  subtitle: z.string().trim().max(200, "subtitle too long").optional(),
  rewardGrowth: z
    .number()
    .int("rewardGrowth must be an integer")
    .min(0, "rewardGrowth must be >= 0")
    .max(10_000, "rewardGrowth too large"),
  scheduledFor: z.string().regex(DATE_REGEX, "scheduledFor must be YYYY-MM-DD"),
});

// POST /:id/keep takes no body; accept either an empty body or a stray key
// (ignored) so a client that sends `{}` doesn't get a spurious 400.
const emptyBodySchema = z.object({});

export interface IntentionsRouterDeps {
  db: Db;
  worldDb: WorldDb;
  sessionTokens: SessionTokenService;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createIntentionsRouter({ db, worldDb, sessionTokens }: IntentionsRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(sessionTokens));

  // GET / — today's intentions. Optional ?date=YYYY-MM-DD to look at another day.
  router.get("/", async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;
      const user = await db.getUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }

      const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
      if (dateParam !== undefined && !DATE_REGEX.test(dateParam)) {
        res.status(400).json({
          error: "validation_failed",
          details: [{ path: "date", message: "date must be YYYY-MM-DD" }],
        });
        return;
      }

      const scheduledFor = dateParam ?? todayIsoDate();
      const intentions = await worldDb.listIntentionsForDate(user.id, scheduledFor);
      res.status(200).json({ intentions, scheduledFor });
    } catch (err) {
      next(err);
    }
  });

  // POST / — create a new intention (defaults to status "pending").
  router.post("/", validateBody(createIntentionSchema), async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;
      const user = await db.getUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }

      const input = req.body as z.infer<typeof createIntentionSchema>;
      const intention = await worldDb.createIntention(user.id, {
        title: input.title,
        subtitle: input.subtitle ?? null,
        rewardGrowth: input.rewardGrowth,
        scheduledFor: input.scheduledFor,
      });
      res.status(201).json({ intention });
    } catch (err) {
      next(err);
    }
  });

  // POST /:id/keep — mark an intention kept. Awards reward_growth (no XP
  // ledger yet — the client reads reward_growth off the returned intention).
  router.post("/:id/keep", validateBody(emptyBodySchema), async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;
      const user = await db.getUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }

      const intentionId = req.params.id!;
      const kept = await worldDb.keepIntention(user.id, intentionId);
      if (!kept) {
        res.status(409).json({
          error: "not_keepable",
          detail: "intention is missing, not yours, or already kept/missed",
        });
        return;
      }
      res.status(200).json({ intention: kept });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createIntentionsRouter;
