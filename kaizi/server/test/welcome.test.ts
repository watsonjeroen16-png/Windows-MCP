import request from "supertest";
import { describe, expect, it } from "vitest";

import type { Personality } from "../src/schemas.js";
import { SMS_MAX_LENGTH } from "../src/services/sms-templates.js";
import { makeTestApp, VALID_PROFILE_BODY } from "./helpers/make-app.js";

const PHONE = VALID_PROFILE_BODY.phone;

async function onboard(
  ctx: ReturnType<typeof makeTestApp>,
  overrides: Partial<typeof VALID_PROFILE_BODY> & { personality?: Personality } = {}
) {
  const check = await request(ctx.app)
    .post("/api/verify/check")
    .send({ phone: PHONE, code: "000000" });
  expect(check.status).toBe(200);
  const profile = await request(ctx.app)
    .post("/api/onboarding/profile")
    .send({ ...VALID_PROFILE_BODY, ...overrides });
  expect(profile.status).toBe(201);
}

describe("POST /api/sms/welcome", () => {
  it("returns 404 for an unknown phone", async () => {
    const ctx = makeTestApp();
    const res = await request(ctx.app).post("/api/sms/welcome").send({ phone: PHONE });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("phone_not_found");
  });

  it("returns 409 when the user is verified but has no profile", async () => {
    const ctx = makeTestApp();
    await request(ctx.app).post("/api/verify/check").send({ phone: PHONE, code: "000000" });
    const res = await request(ctx.app).post("/api/sms/welcome").send({ phone: PHONE });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("profile_missing");
  });

  it("queues the rendered SMS in mock mode and marks the user welcomed", async () => {
    const ctx = makeTestApp();
    await onboard(ctx);

    const res = await request(ctx.app).post("/api/sms/welcome").send({ phone: PHONE });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("queued");
    expect(res.body.mock).toBe(true);
    expect(typeof res.body.body).toBe("string");
    expect(res.body.body).not.toContain("{");
    expect(res.body.body.length).toBeLessThanOrEqual(SMS_MAX_LENGTH);

    // Mock service logged the send.
    expect(ctx.smsLog.some((line) => line.includes(PHONE))).toBe(true);

    const user = await ctx.db.getUserByPhone(PHONE);
    expect(user!.welcomed_at).toBeInstanceOf(Date);
  });

  it("returns 409 already_welcomed on a second call", async () => {
    const ctx = makeTestApp();
    await onboard(ctx);

    await request(ctx.app).post("/api/sms/welcome").send({ phone: PHONE });
    const second = await request(ctx.app).post("/api/sms/welcome").send({ phone: PHONE });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("already_welcomed");
  });

  const cases: Array<{ personality: Personality; expectSnippet: string }> = [
    { personality: "coach", expectSnippet: "It's Kaizi — your coach." },
    { personality: "tough_love", expectSnippet: "Words are cheap." },
    { personality: "mentor", expectSnippet: "it's your compass when the path gets steep" },
    { personality: "supportive", expectSnippet: "I'm really glad you're here." },
    { personality: "rival", expectSnippet: "Prove me wrong." },
  ];

  it.each(cases)(
    "renders the $personality template with placeholders substituted",
    async ({ personality, expectSnippet }) => {
      const ctx = makeTestApp();
      await onboard(ctx, {
        personality,
        goals: ["business", "fitness"],
        identityWhy: "I want to build something my family is proud of. No more waiting.",
      });

      const res = await request(ctx.app).post("/api/sms/welcome").send({ phone: PHONE });
      expect(res.status).toBe(200);
      const body: string = res.body.body;
      expect(body).toContain(expectSnippet);
      // firstGoal = business -> "your business"; whyPhrase from first sentence, lowercased.
      expect(body).toContain("your business");
      expect(body).toContain("i want to build something my family is proud of");
      expect(body).not.toContain("{firstGoal}");
      expect(body).not.toContain("{whyPhrase}");
      expect(body.length).toBeLessThanOrEqual(SMS_MAX_LENGTH);
    }
  );

  it("respects quiet hours when enforcement is enabled", async () => {
    const lateNight = new Date();
    lateNight.setHours(22, 0, 0, 0);
    const ctx = makeTestApp({ enforceQuietHours: true, now: () => lateNight });
    await onboard(ctx);

    const res = await request(ctx.app).post("/api/sms/welcome").send({ phone: PHONE });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("quiet_hours");

    // User was NOT marked welcomed — the send can be retried after quiet hours.
    const user = await ctx.db.getUserByPhone(PHONE);
    expect(user!.welcomed_at).toBeNull();
  });
});
