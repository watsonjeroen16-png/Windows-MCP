import request from "supertest";
import { describe, expect, it } from "vitest";

import { makeTestApp, VALID_PROFILE_BODY } from "./helpers/make-app.js";

const PHONE = VALID_PROFILE_BODY.phone;

async function verifyPhone(app: ReturnType<typeof makeTestApp>["app"], phone: string) {
  const res = await request(app).post("/api/verify/check").send({ phone, code: "000000" });
  expect(res.status).toBe(200);
}

describe("POST /api/onboarding/profile — validation", () => {
  it("rejects empty goals", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .send({ ...VALID_PROFILE_BODY, goals: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("rejects unknown goal values", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .send({ ...VALID_PROFILE_BODY, goals: ["fitness", "crypto"] });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate goals", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .send({ ...VALID_PROFILE_BODY, goals: ["fitness", "fitness"] });
    expect(res.status).toBe(400);
  });

  it("rejects identityWhy shorter than 10 chars (trimmed)", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .send({ ...VALID_PROFILE_BODY, identityWhy: "   short.   " });
    expect(res.status).toBe(400);
  });

  it("rejects identityWhy longer than 280 chars", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .send({ ...VALID_PROFILE_BODY, identityWhy: "x".repeat(281) });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid companion", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .send({ ...VALID_PROFILE_BODY, companion: "unicorn" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid personality", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .send({ ...VALID_PROFILE_BODY, personality: "sarcastic" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid environment", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/profile")
      .send({ ...VALID_PROFILE_BODY, environment: "the_moon" });
    expect(res.status).toBe(400);
  });

  it("rejects missing smsPrefs", async () => {
    const { app } = makeTestApp();
    const { smsPrefs: _omit, ...body } = VALID_PROFILE_BODY;
    const res = await request(app).post("/api/onboarding/profile").send(body);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/onboarding/profile — verification gate", () => {
  it("returns 404 when no user exists for the phone", async () => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/onboarding/profile").send(VALID_PROFILE_BODY);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("phone_not_found");
  });

  it("returns 409 when the phone exists but is not verified", async () => {
    const { app, db } = makeTestApp();
    db.users.set(PHONE, {
      id: "00000000-0000-0000-0000-000000000001",
      phone: PHONE,
      phone_verified_at: null,
      welcomed_at: null,
      created_at: new Date(),
    });
    const res = await request(app).post("/api/onboarding/profile").send(VALID_PROFILE_BODY);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("phone_not_verified");
  });
});

describe("POST /api/onboarding/profile — happy path", () => {
  it("persists profile, sms prefs, and seeds an identity_why memory entry", async () => {
    const { app, db } = makeTestApp();
    await verifyPhone(app, PHONE);

    const res = await request(app).post("/api/onboarding/profile").send(VALID_PROFILE_BODY);
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
    await verifyPhone(app, PHONE);

    await request(app).post("/api/onboarding/profile").send(VALID_PROFILE_BODY);
    const res = await request(app)
      .post("/api/onboarding/profile")
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
    await verifyPhone(app, PHONE);

    await request(app).post("/api/onboarding/profile").send(VALID_PROFILE_BODY);
    await request(app)
      .post("/api/onboarding/profile")
      .send({ ...VALID_PROFILE_BODY, identityWhy: "Because I promised myself this year is different." });

    const user = await db.getUserByPhone(PHONE);
    expect(db.memories.filter((m) => m.user_id === user!.id)).toHaveLength(2);
  });
});
