/**
 * Full-stack integration test against a REAL Postgres instance — the same
 * createApp() the production server uses, wired to createPgDb() instead of
 * the in-memory test double. Exercises the exact SQL in src/db/index.ts and
 * the migration in src/db/migrations/001_init.sql.
 *
 * Skipped by default so `npm test` still needs no database (see
 * server/README.md). Opt in with:
 *
 *   TEST_REAL_DB=1 DATABASE_URL=postgres://postgres:kaizi@localhost:5432/kaizi npm test
 *   # or: npm run test:integration
 *
 * Requires migrations already applied (`npm run migrate`) against that URL.
 */
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { createPgDb } from "../src/db/index.js";
import { createPgWorldDb } from "../src/db/world-pg.js";
import { createSessionTokenService } from "../src/services/session-token.js";
import { createMockSmsService } from "../src/services/twilio.js";

const RUN = process.env.TEST_REAL_DB === "1" || process.env.TEST_REAL_DB === "true";
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:kaizi@localhost:5432/kaizi";

describe.skipIf(!RUN)("integration: real Postgres", () => {
  const db = createPgDb(DATABASE_URL);
  const worldDb = createPgWorldDb(DATABASE_URL);
  const sessionTokens = createSessionTokenService("integration-test-secret");
  const smsLog: string[] = [];
  const sms = createMockSmsService((msg) => smsLog.push(msg));
  const app = createApp({
    db,
    sms,
    sessionTokens,
    worldDb,
    logging: false,
    verifyRateLimit: { max: 1000, windowMs: 60_000 },
    verifyPhoneRateLimit: { max: 1000, windowMs: 60_000 },
    verifyPhoneDailyRateLimit: { max: 1000, windowMs: 24 * 60 * 60 * 1000 },
    globalSendLimit: { max: 1000, windowMs: 60 * 60 * 1000 },
  });

  const PHONE = "+15557778899";

  beforeEach(async () => {
    // Isolate each test: real tables persist across runs (no in-memory
    // reset), so clear them before every test rather than relying on
    // uniqueness of generated phone numbers.
    await truncateAll();
  });

  afterAll(async () => {
    await db.close();
  });

  async function truncateAll(): Promise<void> {
    const pg = (await import("pg")).default;
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      // TRUNCATE ... CASCADE on `users` already cascades to every table with
      // an FK to it (onboarding_quiz_responses, intentions, chat_messages,
      // etc.) — onboarding_quiz_responses and intentions are still listed
      // explicitly for clarity about what this test file touches.
      await client.query(
        "TRUNCATE TABLE memory_entries, sms_preferences, onboarding_profiles, onboarding_quiz_responses, intentions, users RESTART IDENTITY CASCADE"
      );
    } finally {
      await client.end();
    }
  }

  it("walks the full onboarding flow against real Postgres and persists real rows", async () => {
    const early = await request(app).post("/api/onboarding/profile").send({});
    expect(early.status).toBe(401);

    const check = await request(app)
      .post("/api/verify/check")
      .send({ phone: PHONE, code: "000000" });
    expect(check.status).toBe(200);
    expect(check.body.verified).toBe(true);
    const auth = `Bearer ${check.body.token}`;

    const user = await db.getUserByPhone(PHONE);
    expect(user).not.toBeNull();
    expect(user!.phone_verified_at).toBeInstanceOf(Date);

    const profile = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", auth)
      .send({
        goals: ["fitness", "discipline"],
        identityWhy: "Because I am tired of almost. Because my kids are watching.",
        companion: "fox",
        personality: "coach",
        environment: "japanese_garden",
        smsPrefs: { morning: true, evening: true },
      });
    expect(profile.status).toBe(201);
    expect(profile.body.created).toBe(true);

    // Confirm it actually landed in Postgres via a raw read through the real Db.
    const withProfile = await db.getUserWithProfile(PHONE);
    expect(withProfile?.profile).toMatchObject({ companion: "fox", personality: "coach" });
    expect(withProfile?.smsPrefs).toMatchObject({ morning: true, evening: true });

    const welcome = await request(app).post("/api/sms/welcome").set("Authorization", auth).send({});
    expect(welcome.status).toBe(200);
    expect(welcome.body.mock).toBe(true);
    // firstGoal "fitness" maps to the noun "fitness" (see FIRST_GOAL_NOUNS).
    expect(welcome.body.body).toContain("fitness");
    expect(welcome.body.body).not.toContain("{");

    const repeat = await request(app).post("/api/sms/welcome").set("Authorization", auth).send({});
    expect(repeat.status).toBe(409);
    expect(repeat.body.error).toBe("already_welcomed");

    const reloaded = await db.getUserByPhone(PHONE);
    expect(reloaded!.welcomed_at).toBeInstanceOf(Date);
  });

  it("upsertProfile detects a real change to identity_why via the previousIdentityWhy return value", async () => {
    const user = await db.upsertVerifiedUser(PHONE);
    const first = await db.upsertProfile(user.id, {
      goals: ["fitness"],
      identityWhy: "Because A.",
      companion: "fox",
      personality: "coach",
      environment: "japanese_garden",
    });
    expect(first.created).toBe(true);
    expect(first.previousIdentityWhy).toBeNull();

    const second = await db.upsertProfile(user.id, {
      goals: ["fitness"],
      identityWhy: "Because B.",
      companion: "fox",
      personality: "coach",
      environment: "japanese_garden",
    });
    expect(second.created).toBe(false);
    expect(second.previousIdentityWhy).toBe("Because A.");
  });

  it("stores an injection-shaped identityWhy as inert literal text (parameterized queries)", async () => {
    const check = await request(app)
      .post("/api/verify/check")
      .send({ phone: PHONE, code: "000000" });
    const auth = `Bearer ${check.body.token}`;
    const payload = "Robert'); DROP TABLE users; --  and this is my real reason for being here";

    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", auth)
      .send({
        goals: ["fitness"],
        identityWhy: payload,
        companion: "fox",
        personality: "coach",
        environment: "japanese_garden",
        smsPrefs: { morning: true, evening: true },
      });
    expect(res.status).toBe(201);

    const withProfile = await db.getUserWithProfile(PHONE);
    expect(withProfile?.profile?.identity_why).toBe(payload);

    // The users table is still here and still has exactly our one row.
    const stillThere = await db.getUserByPhone(PHONE);
    expect(stillThere).not.toBeNull();
  });

  it("markWelcomed is atomic: concurrent claims against the real row yield exactly one winner", async () => {
    const user = await db.upsertVerifiedUser(PHONE);
    const results = await Promise.all([db.markWelcomed(user.id), db.markWelcomed(user.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("ON DELETE CASCADE removes profile/prefs/memory when the user row is deleted", async () => {
    const user = await db.upsertVerifiedUser(PHONE);
    await db.upsertProfile(user.id, {
      goals: ["fitness"],
      identityWhy: "Because I want this.",
      companion: "fox",
      personality: "coach",
      environment: "japanese_garden",
    });
    await db.upsertSmsPreferences(user.id, { morning: true, evening: true });
    await db.insertMemoryEntry(user.id, "identity_why", "Because I want this.");

    const pg = (await import("pg")).default;
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      await client.query("DELETE FROM users WHERE id = $1", [user.id]);
      const profiles = await client.query("SELECT 1 FROM onboarding_profiles WHERE user_id = $1", [
        user.id,
      ]);
      const prefs = await client.query("SELECT 1 FROM sms_preferences WHERE user_id = $1", [user.id]);
      const memories = await client.query("SELECT 1 FROM memory_entries WHERE user_id = $1", [user.id]);
      expect(profiles.rows).toHaveLength(0);
      expect(prefs.rows).toHaveLength(0);
      expect(memories.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  it("persists onboarding quiz answers via POST /api/onboarding/quiz against real Postgres", async () => {
    const check = await request(app).post("/api/verify/check").send({ phone: PHONE, code: "000000" });
    const auth = `Bearer ${check.body.token}`;

    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", auth)
      .send({
        answers: {
          focusGoal: "fitness",
          startingPoint: "restarting",
          obstacle: "distractions",
          confidence: "fairly",
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);

    const user = await db.getUserByPhone(PHONE);
    const row = await db.getQuizResponses(user!.id);
    expect(row).not.toBeNull();
    expect(row!.answers).toMatchObject({
      focusGoal: "fitness",
      startingPoint: "restarting",
      obstacle: "distractions",
      confidence: "fairly",
    });
    expect(row!.skipped_entirely).toBe(false);
    expect(row!.completed_at).toBeInstanceOf(Date);

    // Re-submit updates in place (200, not 201) — confirms the real
    // ON CONFLICT DO UPDATE path, not just the in-memory test double's.
    const second = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", auth)
      .send({ answers: { confidence: "very" } });
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    const updated = await db.getQuizResponses(user!.id);
    expect(updated!.answers.confidence).toBe("very");
    // Confirms JSONB round-trips as a real object, not a JSON string.
    expect(typeof updated!.answers).toBe("object");
  });

  it("intentions.source defaults to 'user' via the real column DEFAULT, and 'companion' persists explicitly", async () => {
    const user = await db.upsertVerifiedUser(PHONE);

    const userIntention = await worldDb.createIntention(user.id, {
      title: "User-typed intention",
      rewardGrowth: 5,
      scheduledFor: "2026-07-12",
    });
    expect(userIntention.source).toBe("user");

    const companionIntention = await worldDb.createIntention(user.id, {
      title: "AI-generated intention",
      rewardGrowth: 10,
      scheduledFor: "2026-07-12",
      source: "companion",
    });
    expect(companionIntention.source).toBe("companion");

    // Read back through a raw query to confirm the CHECK constraint and
    // default are real schema behavior, not something only the app-layer
    // code path produces.
    const pg = (await import("pg")).default;
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const { rows } = await client.query(
        "SELECT id, source FROM intentions WHERE user_id = $1 ORDER BY created_at ASC",
        [user.id]
      );
      expect(rows.map((r: { source: string }) => r.source)).toEqual(["user", "companion"]);

      // The CHECK constraint actually rejects an invalid source at the DB level.
      await expect(
        client.query("INSERT INTO intentions (user_id, title, reward_growth, scheduled_for, source) VALUES ($1, $2, $3, $4, $5)", [
          user.id,
          "Bad row",
          5,
          "2026-07-12",
          "robot",
        ])
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });

  it("POST /api/intentions/generate persists companion-sourced intentions against real Postgres (mock mode)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const check = await request(app).post("/api/verify/check").send({ phone: PHONE, code: "000000" });
    const auth = `Bearer ${check.body.token}`;

    const res = await request(app)
      .post("/api/intentions/generate")
      .set("Authorization", auth)
      .send({ count: 2, scheduledFor: "2026-07-13" });
    expect(res.status).toBe(201);
    expect(res.body.intentions).toHaveLength(2);
    for (const intention of res.body.intentions) {
      expect(intention.source).toBe("companion");
    }

    const user = await db.getUserByPhone(PHONE);
    const rows = await worldDb.listIntentionsForDate(user!.id, "2026-07-13");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.source === "companion")).toBe(true);
  });
});
