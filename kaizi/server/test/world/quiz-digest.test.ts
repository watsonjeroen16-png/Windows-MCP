import { describe, expect, it } from "vitest";

import { buildQuizProfileDigest } from "../../src/services/quiz-digest.js";

describe("buildQuizProfileDigest", () => {
  it("returns an empty string for null/undefined/empty answers", () => {
    expect(buildQuizProfileDigest(null)).toBe("");
    expect(buildQuizProfileDigest(undefined)).toBe("");
    expect(buildQuizProfileDigest({})).toBe("");
  });

  it("renders a full set of answers as one natural-language paragraph", () => {
    const digest = buildQuizProfileDigest({
      focusGoal: "fitness",
      startingPoint: "restarting",
      obstacle: "distractions",
      supportStyle: "direct",
      availability: ["early_morning", "evening"],
      motivationStyle: "visible_progress",
      pastAttempts: "tried_apps_didnt_stick",
      confidence: "fairly",
      rhythm: "flexible",
      ninetyDayVision: "streak_proud_of",
    });

    expect(digest).toContain("focused on fitness");
    expect(digest).toContain("starting from restarting after a break");
    expect(digest).toContain("distractions");
    expect(digest).toContain("direct");
    expect(digest).toContain("early morning, evening");
    expect(digest).toContain("progress they can see");
    expect(digest).toContain("fairly confident");
    expect(digest).toContain("flexible, different every day");
    expect(digest).toContain("a streak they're proud of");
    // Not raw JSON / camelCase leaking into the prose.
    expect(digest).not.toContain("focusGoal");
    expect(digest).not.toContain("{");
  });

  it("omits missing/skipped fields entirely rather than rendering 'unknown'", () => {
    const digest = buildQuizProfileDigest({ focusGoal: "discipline", confidence: "very" });
    expect(digest).toContain("focused on discipline");
    expect(digest).toContain("very confident");
    expect(digest).not.toMatch(/unknown/i);
    expect(digest).not.toContain("undefined");
    expect(digest).not.toContain("null");
  });

  it("renders the 'all of it, equally' catch-all for focusGoal: 'all'", () => {
    const digest = buildQuizProfileDigest({ focusGoal: "all" });
    expect(digest).toContain("all of it, equally");
  });

  it("never mentions screen time (personalization-spec.md section 2 is cut)", () => {
    const digest = buildQuizProfileDigest({
      focusGoal: "fitness",
      startingPoint: "restarting",
      obstacle: "distractions",
      supportStyle: "direct",
      availability: ["evening"],
      motivationStyle: "competition",
      pastAttempts: "never_tried",
      confidence: "not_very",
      rhythm: "same_daily",
      ninetyDayVision: "measurable_result",
    });
    expect(digest.toLowerCase()).not.toContain("screen time");
    expect(digest.toLowerCase()).not.toContain("usage");
  });

  it("handles startingPoint alone (no focusGoal) without a dangling comma", () => {
    const digest = buildQuizProfileDigest({ startingPoint: "already_disciplined" });
    expect(digest).toBe("This user is already disciplined and refining the details.");
  });
});
