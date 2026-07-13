/**
 * Daily intention generation — the new AI-generation service sketched in
 * docs/design/personalization-spec.md section 3.2, filling in the "current
 * generic pool" gap the spec identifies (routes/intentions.ts was plain CRUD
 * with no AI call in it at all).
 *
 *   - Official `@anthropic-ai/sdk`, same model as companion chat
 *     (claude-opus-4-8, per claude-chat.ts's own "do not substitute a
 *     cheaper model without an explicit founder decision" rule — this is
 *     exactly the kind of judgment call the spec says warrants it).
 *   - Structured output via `output_config: { format: { type: "json_schema", ... } }`
 *     so the response maps directly onto the same shape
 *     routes/intentions.ts's createIntentionSchema expects (title, subtitle,
 *     rewardGrowth) — avoids parsing free-text prose into intentions.
 *   - System prompt, per personalization-spec.md section 3.3's guidance for
 *     this call path specifically (different from chat's 3-block shape):
 *       1. A shared, user-agnostic instructions block — byte-identical
 *          across every user's generation call, `cache_control: {type:
 *          "ephemeral"}`. This is the one part of this prompt caching
 *          earns its keep on, per the spec: if callers run close together
 *          in time it can get cross-user cache reads.
 *       2. A per-user profile block (quiz digest + goals + identity_why) —
 *          deliberately NOT cache_control'd. Per spec: this call path is
 *          roughly once/day/user, so a per-user cache write has no matching
 *          read unless a future "regenerate today's intentions" feature
 *          calls it multiple times in quick succession for the same user.
 *          Not built here — don't cache speculatively.
 *   - Mock mode: if ANTHROPIC_API_KEY is unset, return a small canned pool
 *     selected by the user's first goal, same idea as claude-chat.ts /
 *     sms-templates.ts's mock conventions.
 *   - Never throws: any API/parse/validation failure degrades to the mock
 *     pool rather than surfacing an error, matching claude-chat.ts's
 *     resilience rule (a broken AI call should never break the app).
 */

import { z } from "zod";

import type { Companion, Goal, Personality } from "../schemas.js";

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 1024;
/** 2-3 per personalization-spec.md section 3.2 ("N intentions (2-3, TBD by product)"); 3 chosen as the concrete default until product decides otherwise (spec section 4, open question 3). */
export const DEFAULT_INTENTION_COUNT = 3;

const generatedIntentionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).optional(),
  rewardGrowth: z.number().int().min(0).max(10_000),
});

const generatedIntentionsSchema = z.array(generatedIntentionSchema).min(1);

export type GeneratedIntention = z.infer<typeof generatedIntentionSchema>;

export interface IntentionGenerationInput {
  companionName: string;
  species: Companion;
  personality: Personality;
  goals: Goal[];
  identityWhy: string;
  /** Pre-built by services/quiz-digest.ts's buildQuizProfileDigest; empty string if no quiz on file. */
  quizDigest: string;
  /** How many intentions to generate. Defaults to DEFAULT_INTENTION_COUNT. */
  count?: number;
}

/** Mock-mode pool, grouped by goal so a fallback still feels relevant. Mirrors claude-chat.ts's MOCK_REPLIES idea. */
const MOCK_POOL_BY_GOAL: Record<Goal, GeneratedIntention[]> = {
  fitness: [
    { title: "Move for 20 minutes", subtitle: "A walk counts", rewardGrowth: 10 },
    { title: "Stretch before bed", rewardGrowth: 5 },
    { title: "Drink a full bottle of water", rewardGrowth: 5 },
  ],
  skin: [
    { title: "Do your evening skincare routine", rewardGrowth: 5 },
    { title: "Apply SPF this morning", rewardGrowth: 5 },
    { title: "Drink water before your first coffee", rewardGrowth: 5 },
  ],
  business: [
    { title: "Spend 30 focused minutes on your top priority", rewardGrowth: 10 },
    { title: "Send one email you've been putting off", rewardGrowth: 5 },
    { title: "Review tomorrow's plan tonight", subtitle: "Five minutes, no more", rewardGrowth: 5 },
  ],
  discipline: [
    { title: "Make your bed", rewardGrowth: 5 },
    { title: "Do the one thing you're avoiding", rewardGrowth: 10 },
    { title: "Keep today's promise before noon", rewardGrowth: 5 },
  ],
  learning: [
    { title: "Read for 15 minutes", rewardGrowth: 5 },
    { title: "Practice one new thing for 10 minutes", rewardGrowth: 10 },
    { title: "Write down one thing you learned today", rewardGrowth: 5 },
  ],
};

const MOCK_FALLBACK: GeneratedIntention[] = [
  { title: "Take five minutes for yourself", rewardGrowth: 5 },
  { title: "Check in with your intentions today", rewardGrowth: 5 },
  { title: "Do one small thing that future-you will thank you for", rewardGrowth: 10 },
];

function pickMockIntentions(goals: Goal[], count: number): GeneratedIntention[] {
  const pool = goals.length > 0 ? (MOCK_POOL_BY_GOAL[goals[0]!] ?? MOCK_FALLBACK) : MOCK_FALLBACK;
  // Cycle the pool rather than truncating, so `count` > pool length still
  // returns `count` items instead of silently under-delivering.
  const result: GeneratedIntention[] = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[i % pool.length]!);
  }
  return result;
}

/** Shared, user-agnostic instructions — byte-identical across every user's call (see module header for why this is the cacheable block). */
function buildSharedInstructionsBlock(count: number): string {
  return [
    `You generate personalized daily "Intentions" for the Kaizi app — small, achievable daily commitments that build discipline and identity over time.`,
    `Generate exactly ${count} intentions for today, tailored to the specific user profile you're given.`,
    `Each intention should be concrete and completable in one sitting or one day — not vague ("be better") and not a multi-day project.`,
    `Vary the intentions across the user's stated goals when they have more than one; don't repeat the same idea with different wording.`,
    `rewardGrowth should be a small integer (typically 5-15) reflecting relative effort — a quick 2-minute action is lower, a more demanding one is higher.`,
    `Never mention screen time, phone usage, or app usage — that data is not available to you.`,
    `Respond only with the JSON array — no prose, no explanation.`,
  ].join("\n");
}

function buildUserProfileBlock(input: IntentionGenerationInput): string {
  const lines: string[] = [
    `Companion: ${input.companionName} (${input.species.replace(/_/g, " ")}), personality: ${input.personality}.`,
  ];
  if (input.goals.length > 0) {
    lines.push(`Goals: ${input.goals.join(", ")}.`);
  }
  if (input.identityWhy.trim().length > 0) {
    lines.push(`Why they're doing this: ${input.identityWhy.trim()}`);
  }
  if (input.quizDigest.trim().length > 0) {
    lines.push(input.quizDigest.trim());
  }
  return lines.join("\n");
}

const OUTPUT_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      rewardGrowth: { type: "integer" },
    },
    required: ["title", "rewardGrowth"],
    additionalProperties: false,
  },
} as const;

/**
 * Generates `count` personalized daily intentions, or falls back to a
 * goal-relevant mock pool when ANTHROPIC_API_KEY is unset or the API/parse
 * step fails. Never throws.
 */
export async function generateDailyIntentions(
  input: IntentionGenerationInput
): Promise<GeneratedIntention[]> {
  const count = input.count ?? DEFAULT_INTENTION_COUNT;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return pickMockIntentions(input.goals, count);
  }

  // Lazy import: mock-mode processes (and most tests) never load the SDK.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        // Block 1 — shared, user-agnostic, cacheable across users' calls.
        {
          type: "text",
          text: buildSharedInstructionsBlock(count),
          cache_control: { type: "ephemeral" },
        },
        // Block 2 — per-user, deliberately not cache_control'd (see module header).
        { type: "text", text: buildUserProfileBlock(input) },
      ],
      output_config: {
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Generate today's ${count} personalized intentions for this user now.`,
        },
      ],
    });

    // Reuse claude-chat.ts's cache-diagnostics logging convention so this
    // call path's cache behavior is verifiable the same way chat's is.
    const { logCacheUsage } = await import("./claude-chat.js");
    logCacheUsage(response.usage);

    const textBlock = response.content.find(
      (block): block is Extract<(typeof response.content)[number], { type: "text" }> =>
        block.type === "text"
    );
    if (!textBlock?.text) {
      return pickMockIntentions(input.goals, count);
    }

    const parsed: unknown = JSON.parse(textBlock.text);
    const result = generatedIntentionsSchema.safeParse(parsed);
    if (!result.success) {
      console.error("[intention-generator] model output failed validation:", result.error.message);
      return pickMockIntentions(input.goals, count);
    }
    return result.data;
  } catch (err) {
    console.error(
      "[intention-generator] generateDailyIntentions failed, falling back to mock pool:",
      err
    );
    return pickMockIntentions(input.goals, count);
  }
}
