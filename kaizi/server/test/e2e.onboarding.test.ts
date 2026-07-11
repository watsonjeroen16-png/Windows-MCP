/**
 * End-to-end onboarding flow in mock mode (QA):
 * verify/start -> verify/check (000000) -> onboarding/profile -> sms/welcome.
 *
 * Walks the exact sequence the app performs (see app/src/screens/SmsSetupScreen,
 * VerifyCodeScreen, HandoffScreen) and asserts the welcome SMS body is the
 * spec-verbatim personality template with {firstGoal}/{whyPhrase} substituted.
 */

import request from "supertest";
import { describe, expect, it } from "vitest";

import { SMS_TEMPLATES } from "../src/services/sms-templates.js";
import { makeTestApp } from "./helpers/make-app.js";

const PHONE = "+31612345678";

// Mirrors app/src/state/OnboardingContext.tsx payload assembly (HandoffScreen).
const PROFILE = {
  phone: PHONE,
  goals: ["skin", "discipline"],
  identityWhy: "Because I'm tired of almost. Because my kids are watching.",
  companion: "human_female",
  personality: "mentor",
  environment: "japanese_garden",
  smsPrefs: { morning: true, evening: false },
} as const;

// Expected derivations per spec: firstGoal "skin" -> "your skin";
// whyPhrase = first sentence, first letter lowercased, trailing punctuation stripped.
const EXPECTED_GOAL_NOUN = "your skin";
const EXPECTED_WHY_PHRASE = "because I'm tired of almost";
const EXPECTED_BODY = SMS_TEMPLATES.mentor
  .replaceAll("{whyPhrase}", EXPECTED_WHY_PHRASE)
  .replaceAll("{firstGoal}", EXPECTED_GOAL_NOUN);

describe("e2e onboarding flow (mock mode)", () => {
  it("walks start -> check -> profile -> welcome and renders the correct SMS", async () => {
    const ctx = makeTestApp();

    // Guard: profile must be rejected before verification — no token exists yet.
    const early = await request(ctx.app).post("/api/onboarding/profile").send(PROFILE);
    expect(early.status).toBe(401);
    expect(early.body.error).toBe("unauthorized");

    // 1. Send the code (screen 7a).
    const start = await request(ctx.app).post("/api/verify/start").send({ phone: PHONE });
    expect(start.status).toBe(200);

    // 1b. A wrong code is rejected and does NOT create a verified user or a token.
    const wrong = await request(ctx.app)
      .post("/api/verify/check")
      .send({ phone: PHONE, code: "123456" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe("invalid_code");
    expect(wrong.body.token).toBeUndefined();

    // 2. Check the mock-accepted code (screen 7b) — this is the only step
    // that yields a session token; profile/welcome require it as a bearer
    // credential from here on (H-2).
    const check = await request(ctx.app)
      .post("/api/verify/check")
      .send({ phone: PHONE, code: "000000" });
    expect(check.status).toBe(200);
    expect(check.body.status).toBe("approved");
    expect(check.body.verified).toBe(true);
    expect(typeof check.body.token).toBe("string");
    const auth = `Bearer ${check.body.token}`;

    // 3. Commit the profile (handoff screen, 7c).
    const profile = await request(ctx.app)
      .post("/api/onboarding/profile")
      .set("Authorization", auth)
      .send(PROFILE);
    expect(profile.status).toBe(201);
    expect(profile.body.ok).toBe(true);
    expect(profile.body.created).toBe(true);

    // 4. Enqueue the first companion SMS.
    const welcome = await request(ctx.app)
      .post("/api/sms/welcome")
      .set("Authorization", auth)
      .send({});
    expect(welcome.status).toBe(200);
    expect(welcome.body.status).toBe("queued");
    expect(welcome.body.mock).toBe(true);

    const body: string = welcome.body.body;
    // The body references the chosen goal noun and the identityWhy-derived phrase...
    expect(body).toContain(EXPECTED_GOAL_NOUN);
    expect(body).toContain(EXPECTED_WHY_PHRASE);
    // ...and is exactly the mentor template from the design spec, substituted.
    expect(body).toBe(EXPECTED_BODY);
    expect(body).toContain("it's your compass when the path gets steep");
    expect(body).not.toContain("{");

    // 5. Repeat welcome is refused (the app treats this 409 as benign).
    const repeat = await request(ctx.app)
      .post("/api/sms/welcome")
      .set("Authorization", auth)
      .send({});
    expect(repeat.status).toBe(409);
    expect(repeat.body.error).toBe("already_welcomed");

    // 6. The token keeps working for repeat/idempotent calls within its TTL
    // (it's still the same verified session) — re-posting the profile with
    // the same token is allowed and just updates in place.
    const reProfile = await request(ctx.app)
      .post("/api/onboarding/profile")
      .set("Authorization", auth)
      .send(PROFILE);
    expect(reProfile.status).toBe(200);
    expect(reProfile.body.created).toBe(false);
  });

  it("rejects the profile with 409 when the phone exists but is unverified, even with a validly-signed token", async () => {
    const ctx = makeTestApp();

    // Create an unverified user directly (no verified check has succeeded).
    const user = await ctx.db.upsertVerifiedUser(PHONE);
    user.phone_verified_at = null;

    // A token can only be minted by verify/check in this test, so issue one
    // directly against the test harness's session-token service to exercise
    // the phone_not_verified branch specifically (simulates a token that
    // outlived a since-reset verification state).
    const auth = `Bearer ${ctx.sessionTokens.issue(PHONE).token}`;

    const res = await request(ctx.app)
      .post("/api/onboarding/profile")
      .set("Authorization", auth)
      .send(PROFILE);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("phone_not_verified");
  });

  it("rejects profile/welcome outright with no token at all (401, before any DB lookup)", async () => {
    const ctx = makeTestApp();
    const profileRes = await request(ctx.app).post("/api/onboarding/profile").send(PROFILE);
    expect(profileRes.status).toBe(401);
    const welcomeRes = await request(ctx.app).post("/api/sms/welcome").send({});
    expect(welcomeRes.status).toBe(401);
  });
});
