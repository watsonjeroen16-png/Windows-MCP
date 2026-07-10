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

export const verifyCheckSchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{4,8}$/, "code must be 4-8 digits"),
});

export const profileSchema = z.object({
  phone: phoneSchema,
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

export const welcomeSchema = z.object({
  phone: phoneSchema,
});

export type ProfileInput = z.infer<typeof profileSchema>;
