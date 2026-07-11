/**
 * Reflection journal entries — also the future source for "memory echo"
 * retrieval (world-spec.md #3); only storage is built here. Zod-validated,
 * requires the session-token auth from middleware/auth.ts (imported, not
 * edited). Default export is a factory — see routes/intentions.ts for the
 * same shape and rationale.
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

const createJournalEntrySchema = z.object({
  content: z.string().trim().min(1, "entry cannot be empty").max(4000, "entry too long"),
});

export interface JournalRouterDeps {
  db: Db;
  worldDb: WorldDb;
  sessionTokens: SessionTokenService;
}

const JOURNAL_HISTORY_LIMIT = 50;

function parseLimit(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.trunc(n), 200) : undefined;
}

export function createJournalRouter({ db, worldDb, sessionTokens }: JournalRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(sessionTokens));

  // GET / — recent entries, newest first.
  router.get("/", async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;
      const user = await db.getUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }
      const limit = parseLimit(req.query.limit) ?? JOURNAL_HISTORY_LIMIT;
      const entries = await worldDb.listJournalEntries(user.id, limit);
      res.status(200).json({ entries });
    } catch (err) {
      next(err);
    }
  });

  // POST / — create a new entry.
  router.post("/", validateBody(createJournalEntrySchema), async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;
      const user = await db.getUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }
      const { content } = req.body as { content: string };
      const entry = await worldDb.insertJournalEntry(user.id, content);
      res.status(201).json({ entry });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createJournalRouter;
