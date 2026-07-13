/**
 * Builds the quiz-derived profile digest — the natural-language paragraph
 * fed into Claude's system prompt as the second, cache-stable block, per
 * docs/design/personalization-spec.md section 3.4.
 *
 * Shared by claude-chat.ts (companion chat) and intention-generator.ts
 * (daily intention generation) so both call paths describe a user's quiz
 * answers identically. Screen-time is cut (personalization-spec.md section
 * 2, void by founder decision) — this digest is quiz-only.
 */

import type { QuizAnswers } from "../schemas.js";

const STARTING_POINT_TEXT: Record<string, string> = {
  just_starting: "just starting out",
  restarting: "restarting after a break",
  consistent_level_up: "consistent and wanting to level up",
  already_disciplined: "already disciplined and refining the details",
};

const OBSTACLE_TEXT: Record<string, string> = {
  motivation_dips: "motivation dips",
  not_enough_time: "not enough time",
  dont_know_where_to_start: "not knowing where to start",
  distractions: "distractions — phone, social media",
  self_doubt: "self-doubt",
  inconsistency: "inconsistency",
};

const SUPPORT_STYLE_TEXT: Record<string, string> = {
  gentle_nudge: "a gentle nudge",
  direct: "direct — no sugar-coating",
  celebrate_wins: "celebrating the wins, skipping the guilt",
  hands_off: "mostly hands-off — only stepping in when asked",
};

const AVAILABILITY_TEXT: Record<string, string> = {
  early_morning: "early morning",
  midday: "midday",
  evening: "evening",
  late_night: "late night",
  varies: "varies day to day",
};

const MOTIVATION_STYLE_TEXT: Record<string, string> = {
  discipline_routine: "discipline and routine",
  visible_progress: "progress they can see",
  someone_in_corner: "having someone in their corner",
  competition: "a little competition",
};

const PAST_ATTEMPTS_TEXT: Record<string, string> = {
  never_tried: "never really tried something like this before",
  tried_apps_didnt_stick: "tried apps or trackers before but didn't stick with them",
  tried_with_person_helped: "tried with a person — a coach or friend — and it helped",
  know_what_works_dont_do_it: "knows what works, they just don't do it",
};

const CONFIDENCE_TEXT: Record<string, string> = {
  not_very: "not very confident",
  somewhat: "somewhat confident",
  fairly: "fairly confident",
  very: "very confident",
};

const RHYTHM_TEXT: Record<string, string> = {
  same_daily: "the same routine daily",
  flexible: "flexible, different every day",
  structured_weekdays_loose_weekends: "structured weekdays, loose weekends",
};

const NINETY_DAY_VISION_TEXT: Record<string, string> = {
  streak_proud_of: "a streak they're proud of",
  measurable_result: "a result they can measure",
  feeling_in_control: "feeling back in control",
  proof_of_followthrough: "proof they can follow through",
};

/**
 * Renders quiz answers into a short natural-language paragraph, per
 * personalization-spec.md section 3.4's example. Missing/skipped fields are
 * omitted from the sentence entirely (never rendered as "unknown") to avoid
 * training the model on a placeholder pattern. Returns "" if every field was
 * skipped, so callers can treat an empty digest as "no quiz block needed."
 */
export function buildQuizProfileDigest(answers: QuizAnswers | null | undefined): string {
  if (!answers) return "";

  const parts: string[] = [];

  // Focus goal and starting point share one sentence when both are present,
  // matching the spec's example ("...focused on {focusGoal}, starting from
  // '{startingPoint}'.") — built as one string, not stitched via array
  // mutation, so partial answers (either field alone) still read naturally.
  if (answers.focusGoal || answers.startingPoint) {
    const focus = answers.focusGoal
      ? answers.focusGoal === "all"
        ? "all of it, equally"
        : answers.focusGoal
      : null;
    const startingText = answers.startingPoint ? STARTING_POINT_TEXT[answers.startingPoint] : null;

    if (focus && startingText) {
      parts.push(`This user is focused on ${focus}, starting from ${startingText}.`);
    } else if (focus) {
      parts.push(`This user is focused on ${focus}.`);
    } else if (startingText) {
      parts.push(`This user is ${startingText}.`);
    }
  }

  if (answers.obstacle) {
    parts.push(`Their biggest obstacle is ${OBSTACLE_TEXT[answers.obstacle]}.`);
  }
  if (answers.supportStyle) {
    parts.push(`They want accountability delivered as: ${SUPPORT_STYLE_TEXT[answers.supportStyle]}.`);
  }
  if (answers.availability && answers.availability.length > 0) {
    const availabilityText = answers.availability.map((a) => AVAILABILITY_TEXT[a]).join(", ");
    parts.push(`They're usually free to focus ${availabilityText}.`);
  }
  if (answers.motivationStyle) {
    parts.push(`What keeps them going: ${MOTIVATION_STYLE_TEXT[answers.motivationStyle]}.`);
  }
  if (answers.pastAttempts) {
    parts.push(`Past attempts: they've ${PAST_ATTEMPTS_TEXT[answers.pastAttempts]}.`);
  }
  if (answers.confidence) {
    parts.push(`Confidence level: ${CONFIDENCE_TEXT[answers.confidence]}.`);
  }
  if (answers.rhythm) {
    parts.push(`Natural rhythm: ${RHYTHM_TEXT[answers.rhythm]}.`);
  }
  if (answers.ninetyDayVision) {
    parts.push(`A 90-day win looks like: ${NINETY_DAY_VISION_TEXT[answers.ninetyDayVision]}.`);
  }

  return parts.join(" ").trim();
}
