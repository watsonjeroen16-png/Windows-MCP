import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildSystemBlocks, getCompanionReply, logCacheUsage, MOCK_REPLIES } from "../../src/services/claude-chat.js";

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

describe("buildSystemBlocks — three-block cache_control pattern (personalization-spec.md section 3.3)", () => {
  const BASE_INPUT = {
    personality: "coach" as const,
    companionName: "Fox",
    species: "fox" as const,
    memoryDigest: "Goals: fitness",
    userMessage: "hi",
  };

  it("falls back to the original two-block shape when quizDigest is absent", () => {
    const blocks = buildSystemBlocks(BASE_INPUT);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1]!.cache_control).toBeUndefined();
  });

  it("falls back to two blocks when quizDigest is an empty/whitespace-only string", () => {
    expect(buildSystemBlocks({ ...BASE_INPUT, quizDigest: "" })).toHaveLength(2);
    expect(buildSystemBlocks({ ...BASE_INPUT, quizDigest: "   " })).toHaveLength(2);
  });

  it("adds a second cache_control breakpoint for the quiz digest when present", () => {
    const blocks = buildSystemBlocks({ ...BASE_INPUT, quizDigest: "This user is focused on fitness." });
    expect(blocks).toHaveLength(3);
    // Block 1: stable companion identity, cached.
    expect(blocks[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[0]!.text).toContain("Fox");
    // Block 2: quiz digest, its own cache breakpoint.
    expect(blocks[1]!.cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1]!.text).toBe("This user is focused on fitness.");
    // Block 3: volatile memory digest, never cached.
    expect(blocks[2]!.cache_control).toBeUndefined();
    expect(blocks[2]!.text).toContain("fitness");
  });

  it("never puts a cache_control marker on the final (volatile) block", () => {
    const withoutQuiz = buildSystemBlocks(BASE_INPUT);
    const withQuiz = buildSystemBlocks({ ...BASE_INPUT, quizDigest: "digest text" });
    expect(withoutQuiz.at(-1)!.cache_control).toBeUndefined();
    expect(withQuiz.at(-1)!.cache_control).toBeUndefined();
  });

  it("never mentions screen time anywhere in the assembled blocks (section 2 is cut)", () => {
    const blocks = buildSystemBlocks({ ...BASE_INPUT, quizDigest: "This user is focused on fitness." });
    const allText = blocks.map((b) => b.text).join("\n").toLowerCase();
    expect(allText).not.toContain("screen time");
  });
});

describe("logCacheUsage — cache diagnostics (personalization-spec.md section 3.3)", () => {
  it("logs a cache HIT when cache_read_input_tokens > 0", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logCacheUsage({ input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 500 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toContain("cache HIT");
    spy.mockRestore();
  });

  it("logs a cache WRITE with no prior read when only cache_creation_input_tokens > 0", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logCacheUsage({ input_tokens: 10, cache_creation_input_tokens: 4200, cache_read_input_tokens: 0 });
    expect(spy.mock.calls[0]![0]).toContain("cache WRITE");
    spy.mockRestore();
  });

  it("logs 'not cached' when both cache fields are zero/null", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logCacheUsage({ input_tokens: 10, cache_creation_input_tokens: null, cache_read_input_tokens: null });
    expect(spy.mock.calls[0]![0]).toContain("not cached");
    spy.mockRestore();
  });
});
