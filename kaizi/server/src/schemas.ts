import { z } from "zod";

/** E.164: leading +, first digit 1-9, 7-15 digits total. */
export const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(E164_REGEX, "phone must be E.164, e.g. +15551234567");

export const GOALS = ["fitness", "skin", "business", "discipline", "learning"] as const;
export type Goal = (typeof GOALS)[number];

export const COMPANIONS = [
  "wolf_pup",
  "fox",
  "lion",
  "dog",
  "human_male",
  "human_female",
  "dragonkin",
] as const;
export type Companion = (typeof COMPANIONS)[number];

export const PERSONALITIES = ["coach", "tough_love", "mentor", "supportive", "rival"] as const;
export type Personality = (typeof PERSONALITIES)[number];

export const ENVIRONMENTS = [
  "cyber_city",
  "modern_apartment",
  "forest_village",
  "mountain_retreat",
  "dojo",
  "coastal_paradise",
  "fantasy_kingdom",
  "space_colony",
  "japanese_garden",
  "training_campus",
  "entrepreneur_district",
  "sky_islands",
] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const verifyStartSchema = z.object({
  phone: phoneSchema,
});

// Twilio Verify always issues 6-digit codes (mock mode's fixed approval code
// is also 6 digits, "000000"); tightened from a 4-8 digit range to shrink
// the brute-force/validation surface (see docs/security-review.md L-4).
export const verifyCheckSchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, "code must be 6 digits"),
});

// Note: profile/welcome no longer take `phone` in the body — the caller's
// identity is derived from their bearer session token (see
// middleware/auth.ts, services/session-token.ts). A `phone` field sent by
// an older client is simply stripped by Zod's default "unknown keys are
// dropped" behavior; it is never trusted. See docs/security-review.md H-2.
export const profileSchema = z.object({
  goals: z
    .array(z.enum(GOALS))
    .min(1, "select at least one goal")
    .max(5, "at most 5 goals")
    .refine((goals) => new Set(goals).size === goals.length, "goals must be unique"),
  identityWhy: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(10, "identityWhy must be at least 10 characters").max(280)),
  companion: z.enum(COMPANIONS),
  personality: z.enum(PERSONALITIES),
  environment: z.enum(ENVIRONMENTS),
  smsPrefs: z.object({
    morning: z.boolean(),
    evening: z.boolean(),
  }),
});

// Body is unused (phone comes from the bearer token) but kept as an object
// schema — accepts either an empty body or a stray `phone` (ignored) so
// older/offline-mock clients that still send one don't get a 400.
export const welcomeSchema = z.object({});

export type ProfileInput = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------------------
// Onboarding quiz (personalization-spec.md section 1). All 10 questions are
// chip-based and skippable — every field below is optional, matching the
// spec's "unanswered/skipped questions are simply absent" rule. Screen-time
// (spec section 2) is cut by founder decision and has no schema here.
//
// Q1 (focusGoal) is dynamic per spec section 1.3 — its chip options are the
// user's own goals[] from onboarding plus a literal "all of it" catch-all —
// so it's validated as one of the known GOALS or the literal "all" rather
// than a fixed enum of its own.
// ---------------------------------------------------------------------------

export const QUIZ_STARTING_POINTS = [
  "just_starting",
  "restarting",
  "consistent_level_up",
  "already_disciplined",
] as const;

export const QUIZ_OBSTACLES = [
  "motivation_dips",
  "not_enough_time",
  "dont_know_where_to_start",
  "distractions",
  "self_doubt",
  "inconsistency",
] as const;

export const QUIZ_SUPPORT_STYLES = [
  "gentle_nudge",
  "direct",
  "celebrate_wins",
  "hands_off",
] as const;

export const QUIZ_AVAILABILITY = [
  "early_morning",
  "midday",
  "evening",
  "late_night",
  "varies",
] as const;

export const QUIZ_MOTIVATION_STYLES = [
  "discipline_routine",
  "visible_progress",
  "someone_in_corner",
  "competition",
] as const;

export const QUIZ_PAST_ATTEMPTS = [
  "never_tried",
  "tried_apps_didnt_stick",
  "tried_with_person_helped",
  "know_what_works_dont_do_it",
] as const;

export const QUIZ_CONFIDENCE_LEVELS = ["not_very", "somewhat", "fairly", "very"] as const;

export const QUIZ_RHYTHMS = [
  "same_daily",
  "flexible",
  "structured_weekdays_loose_weekends",
] as const;

export const QUIZ_NINETY_DAY_VISIONS = [
  "streak_proud_of",
  "measurable_result",
  "feeling_in_control",
  "proof_of_followthrough",
] as const;

export const quizAnswersSchema = z
  .object({
    // Q1 — dynamic options (user's own goals[] + "all"), so it's a bounded
    // string rather than a z.enum of its own fixed set.
    focusGoal: z.enum([...GOALS, "all"]).optional(),
    startingPoint: z.enum(QUIZ_STARTING_POINTS).optional(), // Q2
    obstacle: z.enum(QUIZ_OBSTACLES).optional(), // Q3
    supportStyle: z.enum(QUIZ_SUPPORT_STYLES).optional(), // Q4
    availability: z
      .array(z.enum(QUIZ_AVAILABILITY))
      .min(1, "availability must have at least one selection")
      .max(QUIZ_AVAILABILITY.length)
      .refine((a) => new Set(a).size === a.length, "availability must be unique")
      .optional(), // Q5, multi-select
    motivationStyle: z.enum(QUIZ_MOTIVATION_STYLES).optional(), // Q6
    pastAttempts: z.enum(QUIZ_PAST_ATTEMPTS).optional(), // Q7
    confidence: z.enum(QUIZ_CONFIDENCE_LEVELS).optional(), // Q8
    rhythm: z.enum(QUIZ_RHYTHMS).optional(), // Q9
    ninetyDayVision: z.enum(QUIZ_NINETY_DAY_VISIONS).optional(), // Q10
  })
  .strict();

export type QuizAnswers = z.infer<typeof quizAnswersSchema>;

// POST /api/onboarding/quiz body. `skippedEntirely: true` (the "Skip quiz"
// affordance on card 1) records the quiz was declined without turning it
// into a 400 for an empty `answers` object — both are valid submissions.
export const submitQuizSchema = z.object({
  answers: quizAnswersSchema.default({}),
  skippedEntirely: z.boolean().optional().default(false),
});

export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;
