import request from "supertest";
import { describe, expect, it } from "vitest";

import { makeWorldTestApp, verifiedAuthHeader } from "./helpers/make-world-app.js";

const PHONE = "+15551230001";

describe("Intentions — auth", () => {
  it("returns 401 with no Authorization header", async () => {
    const { app } = makeWorldTestApp();
    const res = await request(app).get("/api/intentions");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("returns 401 on POST /api/intentions with no header", async () => {
    const { app } = makeWorldTestApp();
    const res = await request(app)
      .post("/api/intentions")
      .send({ title: "Meditate", rewardGrowth: 5, scheduledFor: "2026-07-11" });
    expect(res.status).toBe(401);
  });
});

describe("Intentions — validation", () => {
  it("rejects an empty title", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "", rewardGrowth: 5, scheduledFor: "2026-07-11" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("rejects a malformed scheduledFor", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "Meditate", rewardGrowth: 5, scheduledFor: "07/11/2026" });
    expect(res.status).toBe(400);
  });

  it("rejects a negative rewardGrowth", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "Meditate", rewardGrowth: -1, scheduledFor: "2026-07-11" });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed ?date query param on GET", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .get("/api/intentions?date=not-a-date")
      .set("Authorization", auth);
    expect(res.status).toBe(400);
  });
});

describe("Intentions — CRUD", () => {
  it("creates an intention and returns it under today's list", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const today = new Date().toISOString().slice(0, 10);

    const createRes = await request(app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "Walk 10 minutes", subtitle: "Just outside", rewardGrowth: 10, scheduledFor: today });
    expect(createRes.status).toBe(201);
    expect(createRes.body.intention).toMatchObject({
      title: "Walk 10 minutes",
      subtitle: "Just outside",
      reward_growth: 10,
      scheduled_for: today,
      status: "pending",
    });

    const listRes = await request(app).get("/api/intentions").set("Authorization", auth);
    expect(listRes.status).toBe(200);
    expect(listRes.body.scheduledFor).toBe(today);
    expect(listRes.body.intentions).toHaveLength(1);
    expect(listRes.body.intentions[0].id).toBe(createRes.body.intention.id);
  });

  it("does not return an intention scheduled for a different date", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    await request(app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "Future thing", rewardGrowth: 5, scheduledFor: "2099-01-01" });

    const today = new Date().toISOString().slice(0, 10);
    const listRes = await request(app).get("/api/intentions").set("Authorization", auth);
    expect(listRes.body.scheduledFor).toBe(today);
    expect(listRes.body.intentions).toHaveLength(0);

    const futureRes = await request(app)
      .get("/api/intentions?date=2099-01-01")
      .set("Authorization", auth);
    expect(futureRes.body.intentions).toHaveLength(1);
  });

  it("marks an intention kept exactly once", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const today = new Date().toISOString().slice(0, 10);

    const createRes = await request(app)
      .post("/api/intentions")
      .set("Authorization", auth)
      .send({ title: "Read 5 pages", rewardGrowth: 15, scheduledFor: today });
    const id = createRes.body.intention.id as string;

    const keepRes = await request(app).post(`/api/intentions/${id}/keep`).set("Authorization", auth);
    expect(keepRes.status).toBe(200);
    expect(keepRes.body.intention.status).toBe("kept");
    expect(keepRes.body.intention.kept_at).not.toBeNull();

    // A second keep on the same intention is refused, not double-applied.
    const secondKeepRes = await request(app)
      .post(`/api/intentions/${id}/keep`)
      .set("Authorization", auth);
    expect(secondKeepRes.status).toBe(409);
    expect(secondKeepRes.body.error).toBe("not_keepable");
  });

  it("returns 409 keeping an unknown intention id", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .post("/api/intentions/00000000-0000-0000-0000-000000000000/keep")
      .set("Authorization", auth);
    expect(res.status).toBe(409);
  });

  it("does not let one user keep another user's intention", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const ownerAuth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const otherAuth = await verifiedAuthHeader(db, sessionTokens, "+15559990002");
    const today = new Date().toISOString().slice(0, 10);

    const createRes = await request(app)
      .post("/api/intentions")
      .set("Authorization", ownerAuth)
      .send({ title: "Owner's intention", rewardGrowth: 5, scheduledFor: today });
    const id = createRes.body.intention.id as string;

    const res = await request(app).post(`/api/intentions/${id}/keep`).set("Authorization", otherAuth);
    expect(res.status).toBe(409);
  });
});
