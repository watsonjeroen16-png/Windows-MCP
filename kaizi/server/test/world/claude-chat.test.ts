import { beforeEach, describe, expect, it } from "vitest";

import { getCompanionReply, MOCK_REPLIES } from "../../src/services/claude-chat.js";

describe("getCompanionReply — mock mode (ANTHROPIC_API_KEY unset)", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("never calls the real API and returns an in-voice line per personality", async () => {
    for (const personality of Object.keys(MOCK_REPLIES) as Array<keyof typeof MOCK_REPLIES>) {
      const reply = await getCompanionReply({
        personality,
        companionName: "Fox",
        species: "fox",
        memoryDigest: "",
        userMessage: "How am I doing?",
      });
      expect(MOCK_REPLIES[personality]).toContain(reply);
    }
  });

  it("is deterministic for the same input (no live network dependency)", async () => {
    const input = {
      personality: "coach" as const,
      companionName: "Wolf Pup",
      species: "wolf_pup" as const,
      memoryDigest: "Goals: fitness",
      userMessage: "I finished my workout",
    };
    const first = await getCompanionReply(input);
    const second = await getCompanionReply(input);
    expect(first).toBe(second);
  });

  it("treats an empty ANTHROPIC_API_KEY as unset (whitespace-only)", async () => {
    process.env.ANTHROPIC_API_KEY = "   ";
    const reply = await getCompanionReply({
      personality: "mentor",
      companionName: "Dog",
      species: "dog",
      memoryDigest: "",
      userMessage: "hello",
    });
    expect(MOCK_REPLIES.mentor).toContain(reply);
    delete process.env.ANTHROPIC_API_KEY;
  });
});
