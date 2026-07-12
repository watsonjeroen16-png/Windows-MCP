/**
 * Postgres-backed implementation of the WorldDb interface (pg pool,
 * DATABASE_URL). Mirrors the style of ./index.ts (the onboarding Db's pg
 * implementation). Tests never import this module — they use
 * ./world-memory.ts instead. Requires 002_companion_world.sql to be applied
 * (see src/db/migrate.ts / `npm run migrate`).
 */

import pg from "pg";

import type {
  ChatMessageRow,
  ChatRole,
  CompanionCustomizationRow,
  CreateIntentionInput,
  CustomizationUpsertInput,
  IntentionRow,
  JournalEntryRow,
  WorldDb,
} from "./world-types.js";

export function createPgWorldDb(databaseUrl: string): WorldDb {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  return {
    async createIntention(userId: string, input: CreateIntentionInput): Promise<IntentionRow> {
      // `source` is COALESCE'd against the column default ("user") rather
      // than passed a JS-side default, so a caller that omits it gets
      // exactly the same value the DB would produce for a bare INSERT.
      const { rows } = await pool.query<IntentionRow>(
        `INSERT INTO intentions (user_id, title, subtitle, reward_growth, scheduled_for, source)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'user'))
         RETURNING *`,
        [
          userId,
          input.title,
          input.subtitle ?? null,
          input.rewardGrowth,
          input.scheduledFor,
          input.source ?? null,
        ]
      );
      return rows[0]!;
    },

    async listIntentionsForDate(userId: string, scheduledFor: string): Promise<IntentionRow[]> {
      const { rows } = await pool.query<IntentionRow>(
        `SELECT * FROM intentions
         WHERE user_id = $1 AND scheduled_for = $2
         ORDER BY created_at ASC`,
        [userId, scheduledFor]
      );
      return rows;
    },

    async keepIntention(userId: string, intentionId: string): Promise<IntentionRow | null> {
      // Single atomic UPDATE ... WHERE ... RETURNING: only transitions a
      // still-pending intention owned by this user, so a concurrent
      // double-tap can't both "win" the keep (mirrors markWelcomed's
      // claim-or-fail pattern in the onboarding Db).
      const { rows } = await pool.query<IntentionRow>(
        `UPDATE intentions
         SET status = 'kept', kept_at = now()
         WHERE id = $1 AND user_id = $2 AND status = 'pending'
         RETURNING *`,
        [intentionId, userId]
      );
      return rows[0] ?? null;
    },

    async insertChatMessage(
      userId: string,
      role: ChatRole,
      content: string
    ): Promise<ChatMessageRow> {
      const { rows } = await pool.query<ChatMessageRow>(
        `INSERT INTO chat_messages (user_id, role, content)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, role, content]
      );
      return rows[0]!;
    },

    async listChatMessages(userId: string, limit = 50): Promise<ChatMessageRow[]> {
      // Fetch the most recent `limit` rows, then re-sort ascending so callers
      // always see oldest-first regardless of the query's internal order.
      const { rows } = await pool.query<ChatMessageRow>(
        `SELECT * FROM (
           SELECT * FROM chat_messages
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2
         ) recent
         ORDER BY created_at ASC`,
        [userId, limit]
      );
      return rows;
    },

    async getCustomization(userId: string): Promise<CompanionCustomizationRow | null> {
      const { rows } = await pool.query<CompanionCustomizationRow>(
        "SELECT * FROM companion_customization WHERE user_id = $1",
        [userId]
      );
      return rows[0] ?? null;
    },

    async upsertCustomization(
      userId: string,
      input: CustomizationUpsertInput
    ): Promise<CompanionCustomizationRow> {
      const { rows } = await pool.query<CompanionCustomizationRow>(
        `INSERT INTO companion_customization (user_id, companion_species, personality, environment)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           companion_species = EXCLUDED.companion_species,
           personality = EXCLUDED.personality,
           environment = EXCLUDED.environment,
           updated_at = now()
         RETURNING *`,
        [userId, input.companionSpecies, input.personality, input.environment]
      );
      return rows[0]!;
    },

    async insertJournalEntry(userId: string, content: string): Promise<JournalEntryRow> {
      const { rows } = await pool.query<JournalEntryRow>(
        `INSERT INTO journal_entries (user_id, content)
         VALUES ($1, $2)
         RETURNING *`,
        [userId, content]
      );
      return rows[0]!;
    },

    async listJournalEntries(userId: string, limit = 50): Promise<JournalEntryRow[]> {
      const { rows } = await pool.query<JournalEntryRow>(
        `SELECT * FROM journal_entries
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      return rows;
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}
