/**
 * The 10-question onboarding quiz (personalization-spec.md section 1.3).
 * All chip-based, all skippable, single-select auto-advance except Q5
 * (availability, multi-select with an explicit Continue).
 *
 * Option `value`s are the exact enum strings the backend's
 * `quizAnswersSchema` (kaizi/server/src/schemas.ts) expects for
 * `POST /api/onboarding/quiz` — chosen to match verbatim so submission is a
 * direct passthrough with no translation layer. `label` is the on-screen
 * chip text (spec section 1.3's canonical copy).
 */
import { GOAL_IDS, GOAL_LABELS, type GoalId } from "./ids";

export type QuizQuestionKey =
  | "focusGoal"
  | "startingPoint"
  | "obstacle"
  | "supportStyle"
  | "availability"
  | "motivationStyle"
  | "pastAttempts"
  | "confidence"
  | "rhythm"
  | "ninetyDayVision";

export interface QuizOption {
  value: string;
  label: string;
}

export interface QuizQuestion {
  key: QuizQuestionKey;
  eyebrow: string;
  title: string;
  subtitle?: string;
  multi: boolean;
  /** Static option list; absent for Q1, which is built dynamically from goals[]. */
  options?: readonly QuizOption[];
}

/** Q1's options are the user's selected goals[] plus a catch-all — spec section 1.3. */
export function focusGoalOptions(goals: readonly GoalId[]): QuizOption[] {
  return [
    ...goals.map((g) => ({ value: g, label: GOAL_LABELS[g] })),
    { value: "all", label: "All of it, equally" },
  ];
}

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    key: "focusGoal",
    eyebrow: "GETTING TO KNOW YOU",
    title: "Of what you're building, what matters most right now?",
    multi: false,
    // options resolved dynamically at render time via focusGoalOptions()
  },
  {
    key: "startingPoint",
    eyebrow: "YOUR STARTING LINE",
    title: "Where are you starting from?",
    multi: false,
    options: [
      { value: "just_starting", label: "Just starting out" },
      { value: "restarting", label: "Restarting after a break" },
      { value: "consistent_level_up", label: "Consistent, want to level up" },
      { value: "already_disciplined", label: "Already disciplined, refining the details" },
    ],
  },
  {
    key: "obstacle",
    eyebrow: "BE HONEST",
    title: "What gets in your way most?",
    multi: false,
    options: [
      { value: "motivation_dips", label: "Motivation dips" },
      { value: "not_enough_time", label: "Not enough time" },
      { value: "dont_know_where_to_start", label: "Don't know where to start" },
      { value: "distractions", label: "Distractions — phone, social media" },
      { value: "self_doubt", label: "Self-doubt" },
      { value: "inconsistency", label: "Inconsistency" },
    ],
  },
  {
    key: "supportStyle",
    eyebrow: "HOW WE PUSH",
    title: "When you're behind, how do you want to hear it?",
    subtitle: "This is about how hard we push — you'll pick their voice next.",
    multi: false,
    options: [
      { value: "gentle_nudge", label: "A gentle nudge" },
      { value: "direct", label: "Direct — no sugar-coating" },
      { value: "celebrate_wins", label: "Celebrate the wins, skip the guilt" },
      { value: "hands_off", label: "Mostly hands-off — I'll ask when I need it" },
    ],
  },
  {
    key: "availability",
    eyebrow: "YOUR SCHEDULE",
    title: "When are you usually free to focus?",
    multi: true,
    options: [
      { value: "early_morning", label: "Early morning" },
      { value: "midday", label: "Midday" },
      { value: "evening", label: "Evening" },
      { value: "late_night", label: "Late night" },
      { value: "varies", label: "It varies day to day" },
    ],
  },
  {
    key: "motivationStyle",
    eyebrow: "WHAT DRIVES YOU",
    title: "What actually keeps you going?",
    multi: false,
    options: [
      { value: "discipline_routine", label: "Discipline & routine" },
      { value: "visible_progress", label: "Progress I can see" },
      { value: "someone_in_corner", label: "Someone in my corner" },
      { value: "competition", label: "A little competition" },
    ],
  },
  {
    key: "pastAttempts",
    eyebrow: "NO JUDGMENT",
    title: "Have you tried something like this before?",
    multi: false,
    options: [
      { value: "never_tried", label: "Never really tried" },
      { value: "tried_apps_didnt_stick", label: "Tried apps or trackers, didn't stick" },
      {
        value: "tried_with_person_helped",
        label: "Tried with a person — coach, friend — and it helped",
      },
      { value: "know_what_works_dont_do_it", label: "I know what works, I just don't do it" },
    ],
  },
  {
    key: "confidence",
    eyebrow: "BE HONEST, AGAIN",
    title: "How confident do you feel about actually sticking with this?",
    multi: false,
    options: [
      { value: "not_very", label: "Not very" },
      { value: "somewhat", label: "Somewhat" },
      { value: "fairly", label: "Fairly" },
      { value: "very", label: "Very" },
    ],
  },
  {
    key: "rhythm",
    eyebrow: "YOUR RHYTHM",
    title: "What's your natural rhythm?",
    multi: false,
    options: [
      { value: "same_daily", label: "Same routine daily" },
      { value: "flexible", label: "Flexible, different every day" },
      {
        value: "structured_weekdays_loose_weekends",
        label: "Structured weekdays, loose weekends",
      },
    ],
  },
  {
    key: "ninetyDayVision",
    eyebrow: "LOOKING AHEAD",
    title: "In 90 days, what would feel like a real win?",
    multi: false,
    options: [
      { value: "streak_proud_of", label: "A streak I'm proud of" },
      { value: "measurable_result", label: "A result I can measure" },
      { value: "feeling_in_control", label: "Feeling back in control" },
      { value: "proof_of_followthrough", label: "Proof I can follow through" },
    ],
  },
];

export const QUIZ_LENGTH = QUIZ_QUESTIONS.length;

/** GOAL_IDS re-export so screens don't need a second import for the fallback grid. */
export { GOAL_IDS };
