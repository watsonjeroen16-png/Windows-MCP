/**
 * Regression coverage for the Companion World routers actually being mounted
 * on the shared createApp() (src/app.ts) — as opposed to only being reachable
 * through the standalone harness in test/world/helpers/make-world-app.ts.
 * Locks in the manual wiring applied from PENDING_INTEGRATION.md (routers +
 * worldDb + auth + per-IP rate limit) so a future refactor of app.ts can't
 * silently unmount one of these without a test failing.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { authHeaderFor, makeTestApp } from "./helpers/make-app.js";

const PHONE = "+15556660001";

describe("Companion World routes mounted on the shared app", () => {
  it("requires auth on all four world routes", async () => {
    const ctx = makeTestApp();
    const results = await Promise.all([
      request(ctx.app).get("/api/intentions"),
      request(ctx.app).post("/api/chat").send({ content: "hi" }),
      request(ctx.app).get("/api/customization"),
      request(ctx.app).post("/api/journal").send({ content: "hi" }),
    ]);
    for (const res of results) {
      expect(res.status).toBe(401);
    }
  });

  it("intentions: create then list round-trips through the real app + worldDb", async () => {
    const ctx = makeTestApp();
    await ctx.db.upsertVerifiedUser(PHONE);
    const auth = authHeaderFor(ctx.sessionTokens, PHONE);

    const create = await request(ctx.app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "Drink water", rewardGrowth: 5, scheduledFor: "2026-07-11" });
    expect(create.status).toBe(201);
    expect(create.body.intention.title).toBe("Drink water");

    const list = await request(ctx.app)
      .get("/api/intentions?date=2026-07-11")
      .set("Authorization", auth);
    expect(list.status).toBe(200);
    expect(list.body.intentions).toHaveLength(1);
  });

  it("chat: send returns a mock companion reply (no ANTHROPIC_API_KEY in tests)", async () => {
    const ctx = makeTestApp();
    await ctx.db.upsertVerifiedUser(PHONE);
    const auth = authHeaderFor(ctx.sessionTokens, PHONE);

    const res = await request(ctx.app).post("/api/chat").set("Authorization", auth).send({ content: "hello" });
    expect(res.status).toBe(201);
    expect(typeof res.body.companionMessage.content).toBe("string");
    expect(res.body.companionMessage.content.length).toBeGreaterThan(0);
  });

  it("customization: 404 not_customized before any onboarding profile or customization exists", async () => {
    const ctx = makeTestApp();
    await ctx.db.upsertVerifiedUser(PHONE);
    const auth = authHeaderFor(ctx.sessionTokens, PHONE);

    const res = await request(ctx.app).get("/api/customization").set("Authorization", auth);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_customized");
  });

  it("journal: create then list round-trips", async () => {
    const ctx = makeTestApp();
    await ctx.db.upsertVerifiedUser(PHONE);
    const auth = authHeaderFor(ctx.sessionTokens, PHONE);

    const create = await request(ctx.app)
      .post("/api/journal")
      .set("Authorization", auth)
      .send({ content: "Today felt different." });
    expect(create.status).toBe(201);

    const list = await request(ctx.app).get("/api/journal").set("Authorization", auth);
    expect(list.status).toBe(200);
    expect(list.body.entries).toHaveLength(1);
  });

  it("is rate-limited per IP (worldRateLimit)", async () => {
    const ctx = makeTestApp({ worldRateLimit: { max: 2, windowMs: 60_000 } });
    await ctx.db.upsertVerifiedUser(PHONE);
    const auth = authHeaderFor(ctx.sessionTokens, PHONE);

    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(ctx.app).get("/api/journal").set("Authorization", auth);
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 429]);
  });
});
