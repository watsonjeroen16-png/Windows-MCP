import { describe, expect, it } from "vitest";

import {
  deriveWhyPhrase,
  FIRST_GOAL_NOUNS,
  renderWelcomeSms,
  SMS_MAX_LENGTH,
  SMS_TEMPLATES,
  WHY_PHRASE_FALLBACK,
} from "../src/services/sms-templates.js";
import { GOALS, PERSONALITIES } from "../src/schemas.js";

describe("deriveWhyPhrase", () => {
  it("takes the first sentence, lowercases the first letter, strips trailing punctuation", () => {
    expect(deriveWhyPhrase("I'm tired of almost. Because my kids are watching.")).toBe(
      "i'm tired of almost"
    );
  });

  it("strips trailing punctuation on a single sentence", () => {
    expect(deriveWhyPhrase("Because I promised myself!")).toBe("because I promised myself");
  });

  it("handles exclamation/question terminators", () => {
    expect(deriveWhyPhrase("My kids are watching? They deserve better.")).toBe(
      "my kids are watching"
    );
  });

  it("treats a newline as a sentence boundary", () => {
    expect(deriveWhyPhrase("Change starts now\nAnd never stops")).toBe("change starts now");
  });

  it("falls back when the input is empty or punctuation-only", () => {
    expect(deriveWhyPhrase("")).toBe(WHY_PHRASE_FALLBACK);
    expect(deriveWhyPhrase("   ")).toBe(WHY_PHRASE_FALLBACK);
    expect(deriveWhyPhrase("...!!!")).toBe(WHY_PHRASE_FALLBACK);
    expect(deriveWhyPhrase(null)).toBe(WHY_PHRASE_FALLBACK);
    expect(deriveWhyPhrase(undefined)).toBe(WHY_PHRASE_FALLBACK);
  });

  it("compresses very long first sentences at a word boundary", () => {
    const long = "Because " + "really ".repeat(40) + "want it";
    const phrase = deriveWhyPhrase(long);
    expect(phrase.length).toBeLessThanOrEqual(90);
    expect(phrase.endsWith("reall")).toBe(false); // no mid-word cut
  });
});

describe("SMS templates", () => {
  it("has a template for every personality and a noun for every goal", () => {
    for (const p of PERSONALITIES) expect(SMS_TEMPLATES[p]).toBeTruthy();
    for (const g of GOALS) expect(FIRST_GOAL_NOUNS[g]).toBeTruthy();
  });

  it("maps goals to the spec's lowercased nouns", () => {
    expect(FIRST_GOAL_NOUNS).toEqual({
      fitness: "fitness",
      skin: "your skin",
      business: "your business",
      discipline: "discipline",
      learning: "learning",
    });
  });

  it.each(PERSONALITIES)(
    "renders %s with placeholders substituted and within the length cap",
    (personality) => {
      const body = renderWelcomeSms({
        personality,
        firstGoal: "skin",
        identityWhy: "I'm tired of almost. Because my kids are watching.",
      });
      expect(body).not.toContain("{whyPhrase}");
      expect(body).not.toContain("{firstGoal}");
      expect(body).toContain("your skin");
      expect(body).toContain("i'm tired of almost");
      expect(body.length).toBeLessThanOrEqual(SMS_MAX_LENGTH);
    }
  );

  it.each(PERSONALITIES)(
    "renders %s under the cap even with a maximal identityWhy",
    (personality) => {
      const body = renderWelcomeSms({
        personality,
        firstGoal: "business",
        identityWhy: "b".repeat(280),
      });
      expect(body.length).toBeLessThanOrEqual(SMS_MAX_LENGTH);
      expect(body).not.toContain("{");
    }
  );

  it("never sends a raw placeholder when derivation fails", () => {
    const body = renderWelcomeSms({
      personality: "coach",
      firstGoal: "fitness",
      identityWhy: "!!!",
    });
    expect(body).toContain(WHY_PHRASE_FALLBACK);
    expect(body).not.toContain("{");
  });
});
