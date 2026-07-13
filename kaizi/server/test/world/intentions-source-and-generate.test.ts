/**
 * (1) intentions.source column — user-authored (default) vs
 *     companion-generated (explicit), per migration 003_personalization.sql.
 * (2) POST /api/intentions/generate — the new AI-generation endpoint
 *     (personalization-spec.md section 3.2), exercised in mock mode (no
 *     ANTHROPIC_API_KEY in tests, same convention as
 *     test/world/claude-chat.test.ts).
 */
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { makeWorldTestApp, verifiedAuthHeader } from "./helpers/make-world-app.js";

const PHONE = "+15551230099";

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe("Intentions — source column", () => {
  it("POST / (user-authored) defaults source to 'user'", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const today = new Date().toISOString().slice(0, 10);

    const res = await request(app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "Meditate", rewardGrowth: 5, scheduledFor: today });

    expect(res.status).toBe(201);
    expect(res.body.intention.source).toBe("user");
  });

  it("GET / round-trips the source field", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const today = new Date().toISOString().slice(0, 10);

    await request(app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "Meditate", rewardGrowth: 5, scheduledFor: today });

    const list = await request(app).get("/api/intentions").set("Authorization", auth);
    expect(list.body.intentions[0].source).toBe("user");
  });
});

describe("POST /api/intentions/generate — auth", () => {
  it("returns 401 with no Authorization header", async () => {
    const { app } = makeWorldTestApp();
    const res = await request(app).post("/api/intentions/generate");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/intentions/generate — validation", () => {
  it("rejects a count above the max", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .post("/api/intentions/generate")
      .set("Authorization", auth)
      .send({ count: 50 });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed scheduledFor", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .post("/api/intentions/generate")
      .set("Authorization", auth)
      .send({ scheduledFor: "not-a-date" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/intentions/generate — happy path (mock mode)", () => {
  it("generates the default count of intentions, all source: 'companion'", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    const res = await request(app).post("/api/intentions/generate").set("Authorization", auth).send({});

    expect(res.status).toBe(201);
    expect(res.body.intentions).toHaveLength(3); // DEFAULT_INTENTION_COUNT
    for (const intention of res.body.intentions) {
      expect(intention.source).toBe("companion");
      expect(typeof intention.title).toBe("string");
      expect(intention.title.length).toBeGreaterThan(0);
    }
  });

  it("honors an explicit count", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    const res = await request(app)
      .post("/api/intentions/generate")
      .set("Authorization", auth)
      .send({ count: 2 });

    expect(res.status).toBe(201);
    expect(res.body.intentions).toHaveLength(2);
  });

  it("persists generated intentions so a subsequent GET / returns them", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const today = new Date().toISOString().slice(0, 10);

    await request(app).post("/api/intentions/generate").set("Authorization", auth).send({});

    const list = await request(app).get("/api/intentions").set("Authorization", auth);
    expect(list.status).toBe(200);
    expect(list.body.scheduledFor).toBe(today);
    expect(list.body.intentions).toHaveLength(3);
    expect(list.body.intentions.every((i: { source: string }) => i.source === "companion")).toBe(true);
  });

  it("generates for a specific scheduledFor when given one", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    const res = await request(app)
      .post("/api/intentions/generate")
      .set("Authorization", auth)
      .send({ scheduledFor: "2099-01-01", count: 1 });

    expect(res.status).toBe(201);
    expect(res.body.scheduledFor).toBe("2099-01-01");
    expect(res.body.intentions[0].scheduled_for).toBe("2099-01-01");
  });

  it("returns 404 phone_not_found for a token whose phone has no user row", async () => {
    const { app, sessionTokens } = makeWorldTestApp();
    const auth = `Bearer ${sessionTokens.issue("+15550009999").token}`;
    const res = await request(app).post("/api/intentions/generate").set("Authorization", auth).send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("phone_not_found");
  });
});

describe("POST /api/intentions/generate — idempotency guard (cost control)", () => {
  it("a second call for the same scheduledFor short-circuits: 200, no new rows, no duplicate generation", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    const first = await request(app).post("/api/intentions/generate").set("Authorization", auth).send({});
    expect(first.status).toBe(201);
    expect(first.body.intentions).toHaveLength(3);

    const second = await request(app).post("/api/intentions/generate").set("Authorization", auth).send({});
    expect(second.status).toBe(200); // not 201 — nothing was created
    expect(second.body.intentions).toHaveLength(3); // same rows returned, not doubled
    expect(second.body.intentions.map((i: { id: string }) => i.id).sort()).toEqual(
      first.body.intentions.map((i: { id: string }) => i.id).sort()
    );

    const list = await request(app).get("/api/intentions").set("Authorization", auth);
    expect(list.body.intentions).toHaveLength(3); // not 6 — the second call did not append more rows
  });

  it("short-circuits even when the existing intentions for the day were user-authored, not companion-generated", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const today = new Date().toISOString().slice(0, 10);

    await request(app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "Manually added", rewardGrowth: 5, scheduledFor: today });

    const res = await request(app).post("/api/intentions/generate").set("Authorization", auth).send({});
    expect(res.status).toBe(200);
    expect(res.body.intentions).toHaveLength(1);
    expect(res.body.intentions[0].source).toBe("user");
  });

  it("a different scheduledFor still generates normally (guard is per-date, not global)", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    const first = await request(app)
      .post("/api/intentions/generate")
      .set("Authorization", auth)
      .send({ scheduledFor: "2099-01-01" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/intentions/generate")
      .set("Authorization", auth)
      .send({ scheduledFor: "2099-01-02" });
    expect(second.status).toBe(201); // different date, not short-circuited
  });
});
