/**
 * First-SMS templates — transcribed VERBATIM from
 * docs/design/onboarding-spec.md ("First-SMS Templates (backend uses verbatim)").
 *
 * Copy changes are a design-doc diff first; this file only mirrors the spec.
 *
 * Placeholders:
 *   {firstGoal} — user's first selected goal mapped to a lowercased noun
 *   {whyPhrase} — identityWhy compressed to a short clause (see deriveWhyPhrase)
 */

import type { Goal, Personality } from "../schemas.js";

export const SMS_TEMPLATES: Record<Personality, string> = {
  coach:
    "It's Kaizi — your coach. You told me why you're here: {whyPhrase}. That's our fuel. Day one starts with {firstGoal}. Text me back one small win you'll get before tonight. We build from there. Let's get to work.",
  tough_love:
    "Kaizi here. You said it yourself: {whyPhrase}. Words are cheap. {firstGoal} doesn't care how motivated you feel — it cares what you do. Text me the ONE thing you'll finish before sunset. No excuses, no essays.",
  mentor:
    "Hello — it's Kaizi. You wrote that {whyPhrase}. Keep that close; it's your compass when the path gets steep. We begin with {firstGoal}, one small promise at a time. Reply with the first step you'll take today, however small.",
  supportive:
    "Hi, it's Kaizi. I'm really glad you're here. You shared that {whyPhrase} — that took honesty, and I won't forget it. Let's start gently with {firstGoal}. What's one small thing you can do today? Whatever it is, I'm with you.",
  rival:
    "Kaizi here. So… {whyPhrase}? Bold. I've already logged my {firstGoal} progress today — have you? Didn't think so. Text me your first move. Every day one of us wins, and I don't plan on it being you. Prove me wrong.",
};

/** Spec: {firstGoal} maps goals to lowercased nouns. */
export const FIRST_GOAL_NOUNS: Record<Goal, string> = {
  fitness: "fitness",
  skin: "your skin",
  business: "your business",
  discipline: "discipline",
  learning: "learning",
};

/** Spec: fallback if {whyPhrase} derivation fails — never send a raw placeholder. */
export const WHY_PHRASE_FALLBACK = "you want to change";

/** Keep every rendered template comfortably under the 320-char cap. */
const WHY_PHRASE_MAX = 90;

/**
 * Compress identityWhy into a short clause per spec:
 * first sentence, lowercase first letter, trailing punctuation stripped.
 * Falls back to "you want to change" when derivation fails.
 */
export function deriveWhyPhrase(identityWhy: string | null | undefined): string {
  const trimmed = (identityWhy ?? "").trim();
  if (!trimmed) return WHY_PHRASE_FALLBACK;

  // First sentence: up to the first sentence terminator or newline.
  const match = trimmed.match(/^[^.!?\n]+/u);
  let phrase = (match ? match[0] : trimmed).trim();

  // Strip trailing punctuation/whitespace.
  phrase = phrase.replace(/[\s.!?,;:…"'“”‘’—–-]+$/u, "").trim();
  if (!phrase) return WHY_PHRASE_FALLBACK;

  // Lowercase the first letter.
  phrase = phrase.charAt(0).toLowerCase() + phrase.slice(1);

  // Compress overly long clauses at a word boundary.
  if (phrase.length > WHY_PHRASE_MAX) {
    const cut = phrase.slice(0, WHY_PHRASE_MAX);
    const lastSpace = cut.lastIndexOf(" ");
    phrase = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut)
      .replace(/[\s.!?,;:…"'“”‘’—–-]+$/u, "")
      .trim();
  }

  return phrase || WHY_PHRASE_FALLBACK;
}

export interface RenderInput {
  personality: Personality;
  firstGoal: Goal;
  identityWhy: string;
}

/** Hard cap on the rendered SMS body. */
export const SMS_MAX_LENGTH = 320;

/**
 * Render the personality template with placeholders substituted.
 * Guaranteed to contain no raw placeholders and to be <= SMS_MAX_LENGTH.
 */
export function renderWelcomeSms(input: RenderInput): string {
  const template = SMS_TEMPLATES[input.personality];
  const firstGoal = FIRST_GOAL_NOUNS[input.firstGoal];

  const substitute = (whyPhrase: string): string =>
    template.replaceAll("{whyPhrase}", whyPhrase).replaceAll("{firstGoal}", firstGoal);

  let body = substitute(deriveWhyPhrase(input.identityWhy));
  if (body.length > SMS_MAX_LENGTH) {
    // Defensive: fall back to the short canonical phrase rather than truncate copy.
    body = substitute(WHY_PHRASE_FALLBACK);
  }
  return body;
}
