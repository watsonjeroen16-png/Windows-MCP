/**
 * Postgres-backed implementation of the Db interface (pg pool, DATABASE_URL).
 * Tests never import this module — they stub the Db interface instead.
 */

import pg from "pg";

import type {
  Db,
  ProfileRow,
  ProfileUpsertInput,
  ProfileUpsertResult,
  SmsPreferencesRow,
  UserRow,
  UserWithProfile,
} from "./types.js";

export function createPgDb(databaseUrl: string): Db {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  return {
    async getUserByPhone(phone: string): Promise<UserRow | null> {
      const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE phone = $1", [phone]);
      return rows[0] ?? null;
    },

    async upsertVerifiedUser(phone: string): Promise<UserRow> {
      const { rows } = await pool.query<UserRow>(
        `INSERT INTO users (phone, phone_verified_at)
         VALUES ($1, now())
         ON CONFLICT (phone) DO UPDATE SET phone_verified_at = now()
         RETURNING *`,
        [phone]
      );
      return rows[0]!;
    },

    async upsertProfile(userId: string, input: ProfileUpsertInput): Promise<ProfileUpsertResult> {
      const existing = await pool.query<Pick<ProfileRow, "identity_why">>(
        "SELECT identity_why FROM onboarding_profiles WHERE user_id = $1",
        [userId]
      );
      const previousIdentityWhy = existing.rows[0]?.identity_why ?? null;

      await pool.query(
        `INSERT INTO onboarding_profiles (user_id, goals, identity_why, companion, personality, environment)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           goals = EXCLUDED.goals,
           identity_why = EXCLUDED.identity_why,
           companion = EXCLUDED.companion,
           personality = EXCLUDED.personality,
           environment = EXCLUDED.environment,
           updated_at = now()`,
        [userId, input.goals, input.identityWhy, input.companion, input.personality, input.environment]
      );

      return { created: existing.rows.length === 0, previousIdentityWhy };
    },

    async upsertSmsPreferences(
      userId: string,
      prefs: { morning: boolean; evening: boolean }
    ): Promise<void> {
      await pool.query(
        `INSERT INTO sms_preferences (user_id, morning, evening)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           morning = EXCLUDED.morning,
           evening = EXCLUDED.evening,
           updated_at = now()`,
        [userId, prefs.morning, prefs.evening]
      );
    },

    async insertMemoryEntry(userId: string, kind: string, content: string): Promise<void> {
      await pool.query("INSERT INTO memory_entries (user_id, kind, content) VALUES ($1, $2, $3)", [
        userId,
        kind,
        content,
      ]);
    },

    async getUserWithProfile(phone: string): Promise<UserWithProfile | null> {
      const { rows: users } = await pool.query<UserRow>("SELECT * FROM users WHERE phone = $1", [
        phone,
      ]);
      const user = users[0];
      if (!user) return null;

      const [{ rows: profiles }, { rows: prefs }] = await Promise.all([
        pool.query<ProfileRow>("SELECT * FROM onboarding_profiles WHERE user_id = $1", [user.id]),
        pool.query<SmsPreferencesRow>("SELECT * FROM sms_preferences WHERE user_id = $1", [user.id]),
      ]);

      return { user, profile: profiles[0] ?? null, smsPrefs: prefs[0] ?? null };
    },

    async markWelcomed(userId: string): Promise<void> {
      await pool.query("UPDATE users SET welcomed_at = now() WHERE id = $1", [userId]);
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}
