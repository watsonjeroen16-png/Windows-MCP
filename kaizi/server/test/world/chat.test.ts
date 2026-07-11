import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { MOCK_REPLIES } from "../../src/services/claude-chat.js";
import { makeWorldTestApp, verifiedAuthHeader } from "./helpers/make-world-app.js";

const PHONE = "+15551230003";

describe("Chat — auth", () => {
  it("returns 401 with no Authorization header", async () => {
    const { app } = makeWorldTestApp();
    const res = await request(app).post("/api/chat").send({ content: "hi" });
    expect(res.status).toBe(401);
  });
});

describe("Chat — validation", () => {
  it("rejects an empty message", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app).post("/api/chat").set("Authorization", auth).send({ content: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("rejects an over-long message", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", auth)
      .send({ content: "x".repeat(2001) });
    expect(res.status).toBe(400);
  });
});

describe("Chat — mock mode (no ANTHROPIC_API_KEY in tests)", () => {
  beforeEach(() => {
    // Make sure the test environment never accidentally calls the real API.
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("stores the user message and returns an in-voice companion reply", async () => {
    const { app, db, worldDb, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", auth)
      .send({ content: "I kept my promise today" });

    expect(res.status).toBe(201);
    expect(res.body.userMessage).toMatchObject({ role: "user", content: "I kept my promise today" });
    expect(res.body.companionMessage.role).toBe("companion");
    expect(typeof res.body.companionMessage.content).toBe("string");
    expect(res.body.companionMessage.content.length).toBeGreaterThan(0);

    // Default personality (no onboarding profile, no customization) is
    // "supportive" — the reply must come from that personality's mock pool.
    expect(MOCK_REPLIES.supportive).toContain(res.body.companionMessage.content);

    const user = await db.getUserByPhone(PHONE);
    const stored = await worldDb.listChatMessages(user!.id);
    expect(stored).toHaveLength(2);
    expect(stored[0]!.role).toBe("user");
    expect(stored[1]!.role).toBe("companion");
  });

  it("uses the personality from companion_customization when set", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    await request(app)
      .put("/api/customization")
      .set("Authorization", auth)
      .send({ companionSpecies: "wolf_pup", personality: "rival", environment: "dojo" });

    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", auth)
      .send({ content: "Let's go" });

    expect(res.status).toBe(201);
    expect(MOCK_REPLIES.rival).toContain(res.body.companionMessage.content);
  });

  it("GET returns chat history oldest-first", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    await request(app).post("/api/chat").set("Authorization", auth).send({ content: "first" });
    await request(app).post("/api/chat").set("Authorization", auth).send({ content: "second" });

    const res = await request(app).get("/api/chat").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(4); // 2 user + 2 companion
    expect(res.body.messages[0].content).toBe("first");
    expect(res.body.messages[2].content).toBe("second");
  });
});
