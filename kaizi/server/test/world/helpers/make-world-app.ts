/**
 * Test harness for the Companion World routes: a minimal Express app wiring
 * the four new world routers to in-memory dbs. Deliberately not built on
 * src/app.ts (that file is off-limits for this phase — see the routes'
 * comments) — this is a small standalone app, same middleware shape as
 * app.ts (helmet/cors/json + notFoundHandler/errorHandler) but scoped to
 * just the world routes.
 *
 * Reuses (imports, never edits) the existing onboarding in-memory Db helper
 * (test/helpers/memory-db.ts) for phone -> userId lookups, since the world
 * tables reference the same `users` table by user_id.
 */

import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { createMemoryWorldDb, type MemoryWorldDb } from "../../../src/db/world-memory.js";
import { errorHandler, notFoundHandler } from "../../../src/middleware/error.js";
import { createChatRouter } from "../../../src/routes/chat.js";
import { createCustomizationRouter } from "../../../src/routes/customization.js";
import { createIntentionsRouter } from "../../../src/routes/intentions.js";
import { createJournalRouter } from "../../../src/routes/journal.js";
import {
  createSessionTokenService,
  type SessionTokenService,
} from "../../../src/services/session-token.js";
import { createMemoryDb, type MemoryDb } from "../../helpers/memory-db.js";

export interface WorldTestApp {
  app: Express;
  db: MemoryDb;
  worldDb: MemoryWorldDb;
  sessionTokens: SessionTokenService;
}

const TEST_SESSION_SECRET = "world-test-session-secret-not-for-production";

export function makeWorldTestApp(): WorldTestApp {
  const db = createMemoryDb();
  const worldDb = createMemoryWorldDb();
  const sessionTokens = createSessionTokenService(TEST_SESSION_SECRET);

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "64kb" }));

  app.use("/api/intentions", createIntentionsRouter({ db, worldDb, sessionTokens }));
  app.use("/api/chat", createChatRouter({ db, worldDb, sessionTokens }));
  app.use("/api/customization", createCustomizationRouter({ db, worldDb, sessionTokens }));
  app.use("/api/journal", createJournalRouter({ db, worldDb, sessionTokens }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, db, worldDb, sessionTokens };
}

/** Verifies `phone` against the in-memory onboarding Db and returns a ready Authorization header. */
export async function verifiedAuthHeader(
  db: MemoryDb,
  sessionTokens: SessionTokenService,
  phone: string
): Promise<string> {
  await db.upsertVerifiedUser(phone);
  return `Bearer ${sessionTokens.issue(phone).token}`;
}
