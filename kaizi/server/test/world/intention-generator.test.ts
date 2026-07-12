import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_INTENTION_COUNT,
  generateDailyIntentions,
} from "../../src/services/intention-generator.js";

describe("generateDailyIntentions — mock mode (ANTHROPIC_API_KEY unset)", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("never calls the real API and returns DEFAULT_INTENTION_COUNT items by default", async () => {
    const result = await generateDailyIntentions({
      companionName: "Fox",
      species: "fox",
      personality: "coach",
      goals: ["fitness"],
      identityWhy: "Because I want this.",
      quizDigest: "",
    });
    expect(result).toHaveLength(DEFAULT_INTENTION_COUNT);
    for (const item of result) {
      expect(typeof item.title).toBe("string");
      expect(item.title.length).toBeGreaterThan(0);
      expect(Number.isInteger(item.rewardGrowth)).toBe(true);
      expect(item.rewardGrowth).toBeGreaterThanOrEqual(0);
    }
  });

  it("honors an explicit count, cycling the pool if count exceeds it", async () => {
    const result = await generateDailyIntentions({
      companionName: "Fox",
      species: "fox",
      personality: "coach",
      goals: ["fitness"],
      identityWhy: "",
      quizDigest: "",
      count: 7,
    });
    expect(result).toHaveLength(7);
  });

  it("picks a goal-relevant pool based on the user's first goal", async () => {
    const fitnessResult = await generateDailyIntentions({
      companionName: "Fox",
      species: "fox",
      personality: "coach",
      goals: ["fitness"],
      identityWhy: "",
      quizDigest: "",
      count: 3,
    });
    const businessResult = await generateDailyIntentions({
      companionName: "Fox",
      species: "fox",
      personality: "coach",
      goals: ["business"],
      identityWhy: "",
      quizDigest: "",
      count: 3,
    });
    // Different goal pools should not be identical.
    expect(fitnessResult.map((i) => i.title)).not.toEqual(businessResult.map((i) => i.title));
  });

  it("falls back to the generic pool when goals is empty", async () => {
    const result = await generateDailyIntentions({
      companionName: "Fox",
      species: "fox",
      personality: "coach",
      goals: [],
      identityWhy: "",
      quizDigest: "",
    });
    expect(result).toHaveLength(DEFAULT_INTENTION_COUNT);
  });

  it("is deterministic for the same input (no live network dependency)", async () => {
    const input = {
      companionName: "Fox",
      species: "fox" as const,
      personality: "coach" as const,
      goals: ["fitness"] as const,
      identityWhy: "Because I want this.",
      quizDigest: "",
    };
    const first = await generateDailyIntentions({ ...input, goals: [...input.goals] });
    const second = await generateDailyIntentions({ ...input, goals: [...input.goals] });
    expect(first).toEqual(second);
  });

  it("treats an empty ANTHROPIC_API_KEY as unset (whitespace-only)", async () => {
    process.env.ANTHROPIC_API_KEY = "   ";
    const result = await generateDailyIntentions({
      companionName: "Fox",
      species: "fox",
      personality: "coach",
      goals: ["fitness"],
      identityWhy: "",
      quizDigest: "",
    });
    expect(result).toHaveLength(DEFAULT_INTENTION_COUNT);
    delete process.env.ANTHROPIC_API_KEY;
  });
});
