import request from "supertest";
import { describe, expect, it } from "vitest";

import { makeWorldTestApp, verifiedAuthHeader } from "./helpers/make-world-app.js";

const PHONE = "+15551230004";

describe("Customization — auth", () => {
  it("returns 401 with no Authorization header", async () => {
    const { app } = makeWorldTestApp();
    const res = await request(app).get("/api/customization");
    expect(res.status).toBe(401);
  });
});

describe("Customization — validation", () => {
  it("rejects an invalid companionSpecies", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .put("/api/customization")
      .set("Authorization", auth)
      .send({ companionSpecies: "unicorn", personality: "coach", environment: "dojo" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("rejects a missing field", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app)
      .put("/api/customization")
      .set("Authorization", auth)
      .send({ companionSpecies: "fox", personality: "coach" });
    expect(res.status).toBe(400);
  });
});

describe("Customization — GET fallback and PUT", () => {
  it("returns 404 not_customized with no customization and no onboarding profile", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const res = await request(app).get("/api/customization").set("Authorization", auth);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_customized");
  });

  it("falls back to the onboarding profile when no world customization exists yet", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const user = await db.getUserByPhone(PHONE);
    await db.upsertProfile(user!.id, {
      goals: ["fitness"],
      identityWhy: "Because I said I would.",
      companion: "lion",
      personality: "mentor",
      environment: "japanese_garden",
    });

    const res = await request(app).get("/api/customization").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("onboarding_profile");
    expect(res.body.customization).toMatchObject({
      companion_species: "lion",
      personality: "mentor",
      environment: "japanese_garden",
    });
  });

  it("PUT creates world customization; subsequent GET prefers it over the onboarding profile", async () => {
    const { app, db, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);
    const user = await db.getUserByPhone(PHONE);
    await db.upsertProfile(user!.id, {
      goals: ["fitness"],
      identityWhy: "Because I said I would.",
      companion: "lion",
      personality: "mentor",
      environment: "japanese_garden",
    });

    const putRes = await request(app)
      .put("/api/customization")
      .set("Authorization", auth)
      .send({ companionSpecies: "dragonkin", personality: "tough_love", environment: "space_colony" });
    expect(putRes.status).toBe(200);
    expect(putRes.body.customization).toMatchObject({
      companion_species: "dragonkin",
      personality: "tough_love",
      environment: "space_colony",
    });

    const getRes = await request(app).get("/api/customization").set("Authorization", auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.source).toBe("customization");
    expect(getRes.body.customization).toMatchObject({
      companion_species: "dragonkin",
      personality: "tough_love",
      environment: "space_colony",
    });
  });

  it("PUT again updates in place rather than creating a second row", async () => {
    const { app, db, worldDb, sessionTokens } = makeWorldTestApp();
    const auth = await verifiedAuthHeader(db, sessionTokens, PHONE);

    await request(app)
      .put("/api/customization")
      .set("Authorization", auth)
      .send({ companionSpecies: "fox", personality: "coach", environment: "dojo" });
    const secondPut = await request(app)
      .put("/api/customization")
      .set("Authorization", auth)
      .send({ companionSpecies: "dog", personality: "supportive", environment: "coastal_paradise" });

    expect(secondPut.status).toBe(200);
    expect(secondPut.body.customization.companion_species).toBe("dog");

    // Confirm no duplicate row was created — exactly one customization row
    // exists for this user in the underlying store.
    expect(worldDb.customizations.size).toBe(1);

    const getRes = await request(app).get("/api/customization").set("Authorization", auth);
    expect(getRes.body.customization.companion_species).toBe("dog");
  });
});
