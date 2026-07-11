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

describe("malformed requests", () => {
  it("returns 400 for unparseable JSON, not a 500", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/verify/start")
      .set("content-type", "application/json")
      .send("{not valid json");
    expect(res.status).toBe(400);
  });

  it("treats a non-JSON content-type body as empty and fails validation cleanly", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/verify/start")
      .set("content-type", "text/plain")
      .send(JSON.stringify({ phone: PHONE }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("rejects a JSON array body with 400, not a 500", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/verify/start")
      .set("content-type", "application/json")
      .send("[1,2,3]");
    expect(res.status).toBe(400);
  });

  it("rejects a body over the 16kb limit with 413", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/verify/start")
      .set("content-type", "application/json")
      .send({ phone: PHONE, pad: "x".repeat(20_000) });
    expect(res.status).toBe(413);
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
    "+१५५५१२३४५६७", // Devanagari digits — \d in the regex is ASCII-only
    "+15551234567;DROP TABLE users;--", // injection-shaped, still just an invalid phone string
    "+1555123456７", // trailing fullwidth digit (not ASCII \d)
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
  it("approves code 000000, upserts a verified user, and issues a session token", async () => {
    const { app, db, sessionTokens } = makeTestApp();
    const res = await request(app).post("/api/verify/check").send({ phone: PHONE, code: "000000" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.verified).toBe(true);
    expect(typeof res.body.token).toBe("string");
    expect(typeof res.body.expiresAt).toBe("string");

    const user = await db.getUserByPhone(PHONE);
    expect(user).not.toBeNull();
    expect(user!.phone_verified_at).toBeInstanceOf(Date);

    // The issued token verifies and is bound to this phone.
    expect(sessionTokens.verify(res.body.token)).toBe(PHONE);
  });

  it("rejects a wrong code with 400 invalid_code, creates no user, and issues no token", async () => {
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

  it("issues a fresh, independently-valid token on each successful check (replay of an old code is impossible; re-verifying reissues)", async () => {
    const { app } = makeTestApp();
    const first = await request(app).post("/api/verify/check").send({ phone: PHONE, code: "000000" });
    const second = await request(app).post("/api/verify/check").send({ phone: PHONE, code: "000000" });
    expect(first.body.token).not.toBe(second.body.token);
  });

  it("concurrent checks with one right and one wrong code leave the user consistently verified (no partial state)", async () => {
    const { app, db } = makeTestApp();
    const [right, wrong] = await Promise.all([
      request(app).post("/api/verify/check").send({ phone: PHONE, code: "000000" }),
      request(app).post("/api/verify/check").send({ phone: PHONE, code: "999999" }),
    ]);
    expect(right.status).toBe(200);
    expect(wrong.status).toBe(400);

    const user = await db.getUserByPhone(PHONE);
    expect(user).not.toBeNull();
    expect(user!.phone_verified_at).toBeInstanceOf(Date);
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

  it("returns 429 after exceeding the per-phone DAILY cap (SMS-pumping guard, M-1)", async () => {
    const { app } = makeTestApp({
      verifyRateLimit: { max: 1000 },
      verifyPhoneRateLimit: { max: 1000 },
      verifyPhoneDailyRateLimit: { max: 2, windowMs: 24 * 60 * 60 * 1000 },
    });

    for (let i = 0; i < 2; i++) {
      const res = await request(app).post("/api/verify/start").send({ phone: PHONE });
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post("/api/verify/start").send({ phone: PHONE });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("rate_limited");

    // A different phone is unaffected by this phone's daily cap.
    const other = await request(app).post("/api/verify/start").send({ phone: "+15557654321" });
    expect(other.status).toBe(200);
  });

  it("trips the global send circuit breaker once aggregate volume crosses the threshold, across distinct phones", async () => {
    const { app } = makeTestApp({
      verifyRateLimit: { max: 1000 },
      verifyPhoneRateLimit: { max: 1000 },
      verifyPhoneDailyRateLimit: { max: 1000 },
      globalSendLimit: { max: 3, windowMs: 60 * 60 * 1000 },
    });

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/api/verify/start")
        .send({ phone: `+1555000${1000 + i}` });
      expect(res.status).toBe(200);
    }
    // 4th distinct phone still gets refused — the breaker is global, not per-phone.
    const blocked = await request(app).post("/api/verify/start").send({ phone: "+15559999999" });
    expect(blocked.status).toBe(503);
    expect(blocked.body.error).toBe("circuit_open");
  });
});
