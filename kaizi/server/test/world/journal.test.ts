import request from "supertest";
import { describe, expect, it } from "vitest";

import { makeWorldTestApp, verifiedAuthHeader } from "./helpers/make-world-app.js";

const PHONE = "+15551230005";

describe("Journal — auth", () => {
  it("returns 401 with no Authorization header", async () => {
    const { app } = makeWorldTestApp();
    const res = await request(app).get("/api/journal");
    expect(res.status).toBe(401);
  });
});

describe("Journal — validation", () => {
  it("rejects an empty entry", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app).post("/api/journal").set("Authorization", auth).send({ content: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("rejects an over-long entry", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .post("/api/journal")
      .set("Authorization", auth)
      .send({ content: "x".repeat(4001) });
    expect(res.status).toBe(400);
  });
});

describe("Journal — CRUD", () => {
  it("creates entries and lists them newest-first", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    const first = await request(app)
      .post("/api/journal")
      .set("Authorization", auth)
      .send({ content: "Today I felt proud of myself." });
    expect(first.status).toBe(201);
    expect(first.body.entry.content).toBe("Today I felt proud of myself.");

    const second = await request(app)
      .post("/api/journal")
      .set("Authorization", auth)
      .send({ content: "A harder day, but I showed up." });
    expect(second.status).toBe(201);

    const listRes = await request(app).get("/api/journal").set("Authorization", auth);
    expect(listRes.status).toBe(200);
    expect(listRes.body.entries).toHaveLength(2);
    // Newest first.
    expect(listRes.body.entries[0].id).toBe(second.body.entry.id);
    expect(listRes.body.entries[1].id).toBe(first.body.entry.id);
  });

  it("scopes entries per user", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const ownerAuth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const otherAuth = await verifiedAuthHeader(db, sessionTokens, "+15559990006");

    await request(app)
      .post("/api/journal")
      .set("Authorization", ownerAuth)
      .send({ content: "Only mine." });

    const otherList = await request(app).get("/api/journal").set("Authorization", otherAuth);
    expect(otherList.body.entries).toHaveLength(0);
  });
});
