import request from "supertest";
import { describe, expect, it } from "vitest";

import { authHeaderFor, makeTestApp, VALID_PROFILE_BODY } from "./helpers/make-app.js";

const PHONE = VALID_PROFILE_BODY.phone;

/** Verifies the phone and returns the Authorization header for the issued session token. */
async function verifyPhone(app: ReturnType<typeof makeTestApp>["app"], phone: string): Promise<string> {
  const res = await request(app).post("/api/verify/check").send({ phone, code: "000000" });
  expect(res.status).toBe(200);
  expect(typeof res.body.token).toBe("string");
  return `Bearer ${res.body.token}`;
}

describe("POST /api/onboarding/profile — auth", () => {
  it("returns 401 with no Authorization header", async () => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/onboarding/profile").send(VALID_PROFILE_BODY);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("returns 401 with a malformed Authorization header", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", "not-a-bearer-token")
      .send(VALID_PROFILE_BODY);
    expect(res.status).toBe(401);
  });

  it("returns 401 with a garbage/forged token", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", "Bearer totally.forged")
      .send(VALID_PROFILE_BODY);
    expect(res.status).toBe(401);
  });

  it("returns 401 with a token signed by a different secret", async () => {
    const { app, sessionTokens: _unused } = makeTestApp();
    // A token from a differently-keyed service must not verify here.
    const { createSessionTokenService } = await import("../src/services/session-token.js");
    const otherTokens = createSessionTokenService("a-completely-different-secret");
    const foreignToken = otherTokens.issue(PHONE).token;
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", `Bearer ${foreignToken}`)
      .send(VALID_PROFILE_BODY);
    expect(res.status).toBe(401);
  });

  it("returns 401 with an expired token", async () => {
    const { app } = makeTestApp();
    const { createSessionTokenService } = await import("../src/services/session-token.js");
    // TTL of -1ms: issued already-expired.
    const shortLived = createSessionTokenService("test-session-secret-not-for-production", -1);
    const expiredToken = shortLived.issue(PHONE).token;
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", `Bearer ${expiredToken}`)
      .send(VALID_PROFILE_BODY);
    expect(res.status).toBe(401);
  });

  it("ignores a `phone` field in the body — identity comes from the token", async () => {
    const { app, db, sessionTokens } = makeTestApp();
    await verifyPhone(app, PHONE);
    const otherPhone = "+15559998888";

    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ ...VALID_PROFILE_BODY, phone: otherPhone });

    expect(res.status).toBe(201);
    // The profile was written under the token's phone, not the body's.
    const tokenOwner = await db.getUserByPhone(PHONE);
    expect(db.profiles.get(tokenOwner!.id)).toBeDefined();
    const spoofedTarget = await db.getUserByPhone(otherPhone);
    expect(spoofedTarget).toBeNull();
  });
});

describe("POST /api/onboarding/profile — validation", () => {
  it("rejects empty goals", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ ...VALID_PROFILE_BODY, goals: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("rejects unknown goal values", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ ...VALID_PROFILE_BODY, goals: ["fitness", "crypto"] });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate goals", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ ...VALID_PROFILE_BODY, goals: ["fitness", "fitness"] });
    expect(res.status).toBe(400);
  });

  it("rejects identityWhy shorter than 10 chars (trimmed)", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ ...VALID_PROFILE_BODY, identityWhy: "   short.   " });
    expect(res.status).toBe(400);
  });

  it("rejects identityWhy longer than 280 chars", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ ...VALID_PROFILE_BODY, identityWhy: "x".repeat(281) });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid companion", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ ...VALID_PROFILE_BODY, companion: "unicorn" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid personality", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ ...VALID_PROFILE_BODY, personality: "sarcastic" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid environment", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ ...VALID_PROFILE_BODY, environment: "the_moon" });
    expect(res.status).toBe(400);
  });

  it("rejects missing smsPrefs", async () => {
    const { app, sessionTokens } = makeTestApp();
    const { smsPrefs: _omit, ...body } = VALID_PROFILE_BODY;
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send(body);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/onboarding/profile — verification gate", () => {
  it("returns 404 when no user exists for the phone", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send(VALID_PROFILE_BODY);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("phone_not_found");
  });

  it("returns 409 when the phone exists but is not verified", async () => {
    const { app, db, sessionTokens } = makeTestApp();
    db.users.set(PHONE, {
      id: "00000000-0000-0000-0000-000000000001",
      phone: PHONE,
      phone_verified_at: null,
      welcomed_at: null,
      created_at: new Date(),
    });
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send(VALID_PROFILE_BODY);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("phone_not_verified");
  });
});

describe("POST /api/onboarding/profile — happy path", () => {
  it("persists profile, sms prefs, and seeds an identity_why memory entry", async () => {
    const { app, db } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);

    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", auth)
      .send(VALID_PROFILE_BODY);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.created).toBe(true);

    const user = await db.getUserByPhone(PHONE);
    const profile = db.profiles.get(user!.id);
    expect(profile).toBeDefined();
    expect(profile!.goals).toEqual(["fitness", "discipline"]);
    expect(profile!.companion).toBe("fox");
    expect(profile!.personality).toBe("coach");
    expect(profile!.environment).toBe("japanese_garden");
    expect(profile!.identity_why).toBe(VALID_PROFILE_BODY.identityWhy);

    const prefs = db.smsPrefs.get(user!.id);
    expect(prefs).toMatchObject({ morning: true, evening: true });

    const memories = db.memories.filter((m) => m.user_id === user!.id);
    expect(memories).toHaveLength(1);
    expect(memories[0]).toMatchObject({
      kind: "identity_why",
      content: VALID_PROFILE_BODY.identityWhy,
    });
  });

  it("re-posting updates the profile (200) without duplicating unchanged memory", async () => {
    const { app, db } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);

    await request(app).post("/api/onboarding/profile").set("Authorization", auth).send(VALID_PROFILE_BODY);
    const res = await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", auth)
      .send({ ...VALID_PROFILE_BODY, companion: "lion", smsPrefs: { morning: false, evening: true } });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);

    const user = await db.getUserByPhone(PHONE);
    expect(db.profiles.get(user!.id)!.companion).toBe("lion");
    expect(db.smsPrefs.get(user!.id)).toMatchObject({ morning: false, evening: true });
    // identityWhy unchanged -> still exactly one memory entry
    expect(db.memories.filter((m) => m.user_id === user!.id)).toHaveLength(1);
  });

  it("appends a new memory entry when identityWhy changes", async () => {
    const { app, db } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);

    await request(app).post("/api/onboarding/profile").set("Authorization", auth).send(VALID_PROFILE_BODY);
    await request(app)
      .post("/api/onboarding/profile")
      .set("Authorization", auth)
      .send({ ...VALID_PROFILE_BODY, identityWhy: "Because I promised myself this year is different." });

    const user = await db.getUserByPhone(PHONE);
    expect(db.memories.filter((m) => m.user_id === user!.id)).toHaveLength(2);
  });

  it("rejects a double-submit race with the same token consistently (idempotent, no duplicate memory)", async () => {
    const { app, db } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);

    const [first, second] = await Promise.all([
      request(app).post("/api/onboarding/profile").set("Authorization", auth).send(VALID_PROFILE_BODY),
      request(app).post("/api/onboarding/profile").set("Authorization", auth).send(VALID_PROFILE_BODY),
    ]);
    expect([200, 201]).toContain(first.status);
    expect([200, 201]).toContain(second.status);

    const user = await db.getUserByPhone(PHONE);
    // Same identityWhy submitted twice concurrently -> still exactly one memory entry.
    expect(db.memories.filter((m) => m.user_id === user!.id)).toHaveLength(1);
  });
});
