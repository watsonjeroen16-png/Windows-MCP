import request from "supertest";
import { describe, expect, it } from "vitest";

import { makeTestApp } from "./helpers/make-app.js";

const PHONE = "+15551234567";

describe("GET /health", () => {
  it("returns ok", async () => {
    const { app } = makeTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("POST /api/verify/start", () => {
  it.each([
    "5551234567", // missing +
    "+05551234567", // leading zero after +
    "+1555", // too short
    "+15551234567890123", // too long
    "+1 555 123 4567", // spaces
    "not-a-phone",
    "",
  ])("rejects non-E.164 phone %j with 400", async (phone) => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/verify/start").send({ phone });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
    expect(res.body.details).toBeDefined();
  });

  it("accepts a valid E.164 phone and returns pending (mock mode)", async () => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/verify/start").send({ phone: PHONE });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "pending", mock: true });
  });
});

describe("POST /api/verify/check", () => {
  it("approves code 000000 and upserts a verified user", async () => {
    const { app, db } = makeTestApp();
    const res = await request(app).post("/api/verify/check").send({ phone: PHONE, code: "000000" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.verified).toBe(true);

    const user = await db.getUserByPhone(PHONE);
    expect(user).not.toBeNull();
    expect(user!.phone_verified_at).toBeInstanceOf(Date);
  });

  it("rejects a wrong code with 400 invalid_code and creates no user", async () => {
    const { app, db } = makeTestApp();
    const res = await request(app).post("/api/verify/check").send({ phone: PHONE, code: "123456" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_code" });
    expect(await db.getUserByPhone(PHONE)).toBeNull();
  });

  it("rejects a malformed code with 400 validation_failed", async () => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/verify/check").send({ phone: PHONE, code: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });
});

describe("rate limiting on /api/verify/*", () => {
  it("returns 429 after exceeding the per-IP limit", async () => {
    const { app } = makeTestApp({
      verifyRateLimit: { max: 5, windowMs: 60_000 },
      verifyPhoneRateLimit: { max: 1000 },
    });

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/api/verify/start").send({ phone: PHONE });
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post("/api/verify/start").send({ phone: PHONE });
    expect(blocked.status).toBe(429);
  });

  it("returns 429 after exceeding the per-phone limit even from one IP", async () => {
    const { app } = makeTestApp({
      verifyRateLimit: { max: 1000 },
      verifyPhoneRateLimit: { max: 3, windowMs: 60_000 },
    });

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post("/api/verify/start").send({ phone: PHONE });
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post("/api/verify/start").send({ phone: PHONE });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("rate_limited");

    // A different phone is still allowed.
    const other = await request(app).post("/api/verify/start").send({ phone: "+15557654321" });
    expect(other.status).toBe(200);
  });
});
