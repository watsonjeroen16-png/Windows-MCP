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
      await client.query(
        "TRUNCATE TABLE memory_entries, sms_preferences, onboarding_profiles, users RESTART IDENTITY CASCADE"
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
});
