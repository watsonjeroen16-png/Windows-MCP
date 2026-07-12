/**
 * Companion chat — send a user message, persist it, call the real Claude
 * integration (services/claude-chat.ts) for the companion's reply, persist
 * and return that too. Zod-validated, requires the session-token auth from
 * middleware/auth.ts (imported, not edited). Default export is a factory —
 * see routes/intentions.ts for the same shape and rationale.
 *
 * Not wired into app.ts/index.ts here — see PENDING_INTEGRATION.md.
 */

import { Router } from "express";
import { z } from "zod";

import type { Db } from "../db/types.js";
import type { WorldDb } from "../db/world-types.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import type { Companion, Personality } from "../schemas.js";
import { getCompanionReply } from "../services/claude-chat.js";
import { buildQuizProfileDigest } from "../services/quiz-digest.js";
import type { SessionTokenService } from "../services/session-token.js";

const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "message cannot be empty").max(2000, "message too long"),
});

export interface ChatRouterDeps {
  db: Db;
  worldDb: WorldDb;
  sessionTokens: SessionTokenService;
}

const DEFAULT_PERSONALITY: Personality = "supportive";
const DEFAULT_SPECIES: Companion = "fox";
const CHAT_HISTORY_LIMIT = 50;

/** "wolf_pup" -> "Wolf Pup". Species is used as the companion's name until a naming feature ships (see onboarding-spec.md screen 7c). */
function humanizeSpecies(species: string): string {
  return species
    .split("_")
    .map((word) => (word.length > 0 ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseLimit(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.trunc(n), 200) : undefined;
}

export function createChatRouter({ db, worldDb, sessionTokens }: ChatRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(sessionTokens));

  // GET / — recent chat history, oldest first.
  router.get("/", async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;
      const user = await db.getUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }
      const limit = parseLimit(req.query.limit) ?? CHAT_HISTORY_LIMIT;
      const messages = await worldDb.listChatMessages(user.id, limit);
      res.status(200).json({ messages });
    } catch (err) {
      next(err);
    }
  });

  // POST / — send a user message; store it, get + store the companion's reply.
  router.post("/", validateBody(sendMessageSchema), async (req, res, next) => {
    try {
      const phone = (req as AuthedRequest).authPhone!;
      const user = await db.getUserByPhone(phone);
      if (!user) {
        res.status(404).json({ error: "phone_not_found" });
        return;
      }

      const { content } = req.body as { content: string };

      const [userMessage, customization, userWithProfile, quizResponses] = await Promise.all([
        worldDb.insertChatMessage(user.id, "user", content),
        worldDb.getCustomization(user.id),
        db.getUserWithProfile(phone),
        db.getQuizResponses(user.id),
      ]);

      const profile = userWithProfile?.profile ?? null;
      // Prefer the mutable post-onboarding customization; fall back to the
      // original onboarding choice if the user hasn't re-customized yet.
      const species: Companion = customization?.companion_species ?? profile?.companion ?? DEFAULT_SPECIES;
      const personality: Personality =
        customization?.personality ?? profile?.personality ?? DEFAULT_PERSONALITY;
      const companionName = humanizeSpecies(species);

      const todaysIntentions = await worldDb.listIntentionsForDate(user.id, todayIsoDate());
      const unkeptTitles = todaysIntentions
        .filter((intention) => intention.status === "pending")
        .map((intention) => intention.title);

      const digestLines: string[] = [];
      if (profile?.goals && profile.goals.length > 0) {
        digestLines.push(`Goals: ${profile.goals.join(", ")}`);
      }
      if (profile?.identity_why) {
        digestLines.push(`Why they're doing this: ${profile.identity_why}`);
      }
      if (unkeptTitles.length > 0) {
        digestLines.push(`Unkept intentions today: ${unkeptTitles.join("; ")}`);
      }

      // Quiz-derived digest (personalization-spec.md section 3.4) — its own
      // cache_control breakpoint in claude-chat.ts's system prompt, separate
      // from the volatile memoryDigest above. Empty when the user has no
      // quiz responses on file or skipped the quiz entirely.
      const quizDigest = quizResponses ? buildQuizProfileDigest(quizResponses.answers) : "";

      const reply = await getCompanionReply({
        personality,
        companionName,
        species,
        memoryDigest: digestLines.join("\n"),
        quizDigest,
        userMessage: content,
      });

      const companionMessage = await worldDb.insertChatMessage(user.id, "companion", reply);

      res.status(201).json({ userMessage, companionMessage });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createChatRouter;
