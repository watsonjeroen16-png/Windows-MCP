/**
 * POST /api/onboarding/quiz — the 10-question onboarding quiz
 * (personalization-spec.md section 1). Same auth/session pattern as
 * profile.test.ts (see that file for the full auth-matrix coverage this
 * route shares via requireAuth — not re-tested exhaustively here).
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { authHeaderFor, makeTestApp, VALID_PROFILE_BODY } from "./helpers/make-app.js";

const PHONE = "+15551119999";

async function verifyPhone(app: ReturnType<typeof makeTestApp>["app"], phone: string): Promise<string> {
  const res = await request(app).post("/api/verify/check").send({ phone, code: "000000" });
  expect(res.status).toBe(200);
  return `Bearer ${res.body.token}`;
}

const VALID_ANSWERS = {
  focusGoal: "fitness",
  startingPoint: "restarting",
  obstacle: "distractions",
  supportStyle: "direct",
  availability: ["early_morning", "evening"],
  motivationStyle: "visible_progress",
  pastAttempts: "tried_apps_didnt_stick",
  confidence: "fairly",
  rhythm: "flexible",
  ninetyDayVision: "streak_proud_of",
};

describe("POST /api/onboarding/quiz — auth", () => {
  it("returns 401 with no Authorization header", async () => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/onboarding/quiz").send({ answers: VALID_ANSWERS });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });
});

describe("POST /api/onboarding/quiz — validation", () => {
  it("rejects an unknown answer value", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ answers: { ...VALID_ANSWERS, obstacle: "aliens" } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("rejects an unknown top-level field on answers (strict schema)", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ answers: { ...VALID_ANSWERS, screenTimeOptIn: true } });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate availability selections", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ answers: { availability: ["evening", "evening"] } });
    expect(res.status).toBe(400);
  });

  it("accepts focusGoal 'all' (the catch-all chip, not a real goal)", async () => {
    const { app, db, sessionTokens } = makeTestApp();
    await verifyPhone(app, PHONE);
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ answers: { focusGoal: "all" } });
    expect(res.status).toBe(201);
    const user = await db.getUserByPhone(PHONE);
    expect(db.quizResponses.get(user!.id)!.answers.focusGoal).toBe("all");
  });

  it("accepts a fully empty answers object (every question skipped individually)", async () => {
    const { app, sessionTokens } = makeTestApp();
    await verifyPhone(app, PHONE);
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ answers: {} });
    expect(res.status).toBe(201);
  });

  it("accepts an entirely omitted body (answers defaults to {})", async () => {
    const { app, sessionTokens } = makeTestApp();
    await verifyPhone(app, PHONE);
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({});
    expect(res.status).toBe(201);
  });
});

describe("POST /api/onboarding/quiz — verification gate", () => {
  it("returns 404 when no user exists for the phone", async () => {
    const { app, sessionTokens } = makeTestApp();
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ answers: VALID_ANSWERS });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("phone_not_found");
  });

  it("returns 409 when the phone exists but is not verified", async () => {
    const { app, db, sessionTokens } = makeTestApp();
    db.users.set(PHONE, {
      id: "00000000-0000-0000-0000-000000000002",
      phone: PHONE,
      phone_verified_at: null,
      welcomed_at: null,
      created_at: new Date(),
    });
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", authHeaderFor(sessionTokens, PHONE))
      .send({ answers: VALID_ANSWERS });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("phone_not_verified");
  });
});

describe("POST /api/onboarding/quiz — happy path", () => {
  it("persists the full 10 answers", async () => {
    const { app, db } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);

    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", auth)
      .send({ answers: VALID_ANSWERS });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.created).toBe(true);
    expect(res.body.skippedEntirely).toBe(false);

    const user = await db.getUserByPhone(PHONE);
    const row = db.quizResponses.get(user!.id);
    expect(row).toBeDefined();
    expect(row!.answers).toEqual(VALID_ANSWERS);
    expect(row!.completed_at).toBeInstanceOf(Date);
  });

  it("records skippedEntirely: true (the 'Skip quiz' card-1 affordance) with no answers required", async () => {
    const { app, db } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);

    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", auth)
      .send({ skippedEntirely: true });

    expect(res.status).toBe(201);
    expect(res.body.skippedEntirely).toBe(true);

    const user = await db.getUserByPhone(PHONE);
    expect(db.quizResponses.get(user!.id)!.skipped_entirely).toBe(true);
  });

  it("re-posting updates the answers (200, not 201) — a user backing up and changing one answer", async () => {
    const { app, db } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);

    await request(app).post("/api/onboarding/quiz").set("Authorization", auth).send({ answers: VALID_ANSWERS });
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", auth)
      .send({ answers: { ...VALID_ANSWERS, confidence: "very" } });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);

    const user = await db.getUserByPhone(PHONE);
    expect(db.quizResponses.get(user!.id)!.answers.confidence).toBe("very");
  });

  it("ignoring answers with a partial submission omits unanswered questions rather than nulling them", async () => {
    const { app, db } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);

    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", auth)
      .send({ answers: { focusGoal: "discipline", confidence: "not_very" } });

    expect(res.status).toBe(201);
    const user = await db.getUserByPhone(PHONE);
    const answers = db.quizResponses.get(user!.id)!.answers;
    expect(answers.focusGoal).toBe("discipline");
    expect(answers.confidence).toBe("not_very");
    expect(answers.obstacle).toBeUndefined();
  });

  it("does not require an onboarding profile to already exist (quiz can be submitted independently)", async () => {
    const { app, db } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);
    // Deliberately not posting /profile first.
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", auth)
      .send({ answers: VALID_ANSWERS });
    expect(res.status).toBe(201);
    const user = await db.getUserByPhone(PHONE);
    expect(db.profiles.get(user!.id)).toBeUndefined();
  });
});

describe("POST /api/onboarding/quiz — identity isolation", () => {
  it("ignores any spoofed identity in the body — quiz is written under the token's phone only", async () => {
    const { app, db, sessionTokens } = makeTestApp();
    const auth = await verifyPhone(app, PHONE);
    const res = await request(app)
      .post("/api/onboarding/quiz")
      .set("Authorization", auth)
      .send({ answers: VALID_ANSWERS, phone: VALID_PROFILE_BODY.phone });

    expect(res.status).toBe(201);
    const owner = await db.getUserByPhone(PHONE);
    expect(db.quizResponses.get(owner!.id)).toBeDefined();
    const other = await db.getUserByPhone(VALID_PROFILE_BODY.phone);
    expect(other).toBeNull();
    void sessionTokens;
  });
});
