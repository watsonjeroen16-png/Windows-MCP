/**
 * Canonical ids shared with the backend enums — snake_case, verbatim.
 *
 * Deviation note: onboarding-spec.md sketches these unions in camelCase
 * ('wolfPup', 'toughLove', ...). The backend contract (see build brief) is
 * snake_case, so snake_case is used end-to-end here to avoid a mapping layer.
 */

export const GOAL_IDS = ["fitness", "skin", "business", "discipline", "learning"] as const;
export type GoalId = (typeof GOAL_IDS)[number];

export const COMPANION_IDS = [
  "wolf_pup",
  "fox",
  "lion",
  "dog",
  "human_male",
  "human_female",
  "dragonkin",
] as const;
export type CompanionId = (typeof COMPANION_IDS)[number];

export const PERSONALITY_IDS = ["coach", "tough_love", "mentor", "supportive", "rival"] as const;
export type PersonalityId = (typeof PERSONALITY_IDS)[number];

export const ENVIRONMENT_IDS = [
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
export type EnvironmentId = (typeof ENVIRONMENT_IDS)[number];
