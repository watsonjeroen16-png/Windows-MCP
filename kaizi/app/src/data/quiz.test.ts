import { describe, expect, it } from "vitest";

import { focusGoalOptions, QUIZ_LENGTH, QUIZ_QUESTIONS } from "./quiz";

describe("QUIZ_QUESTIONS", () => {
  it("has exactly 10 questions (personalization-spec.md section 1)", () => {
    expect(QUIZ_QUESTIONS).toHaveLength(10);
    expect(QUIZ_LENGTH).toBe(10);
  });

  it("only the availability question (Q5) is multi-select", () => {
    const multiKeys = QUIZ_QUESTIONS.filter((q) => q.multi).map((q) => q.key);
    expect(multiKeys).toEqual(["availability"]);
  });

  it("every question except the dynamic focusGoal (Q1) has a static option list", () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.key === "focusGoal") {
        expect(q.options).toBeUndefined();
      } else {
        expect(q.options).toBeDefined();
        expect(q.options!.length).toBeGreaterThan(0);
      }
    }
  });

  it("question keys match the backend's quizAnswersSchema field names verbatim", () => {
    expect(QUIZ_QUESTIONS.map((q) => q.key)).toEqual([
      "focusGoal",
      "startingPoint",
      "obstacle",
      "supportStyle",
      "availability",
      "motivationStyle",
      "pastAttempts",
      "confidence",
      "rhythm",
      "ninetyDayVision",
    ]);
  });

  it("keeps ids unique per question", () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.options === undefined) continue;
      const values = q.options.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe("focusGoalOptions", () => {
  it("returns the user's goals plus a trailing catch-all", () => {
    const opts = focusGoalOptions(["fitness", "discipline"]);
    expect(opts).toEqual([
      { value: "fitness", label: "Fitness" },
      { value: "discipline", label: "Discipline" },
      { value: "all", label: "All of it, equally" },
    ]);
  });

  it("still returns the catch-all when no goals were picked", () => {
    expect(focusGoalOptions([])).toEqual([{ value: "all", label: "All of it, equally" }]);
  });
});
