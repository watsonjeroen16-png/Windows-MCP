/**
 * Companion chat — real Claude API integration, per the architecture decided
 * in docs/design/world-build-plan.md ("Companion chat — architecture
 * decision"):
 *
 *   - Official `@anthropic-ai/sdk`, one call per companion message via
 *     `client.messages.create()` — a single-turn "answer as the companion"
 *     call, not an agentic tool-use loop.
 *   - Model: claude-opus-4-8 (do not substitute a cheaper model without an
 *     explicit founder decision).
 *   - Thinking off — this is a fast conversational reply, not a reasoning
 *     task, so the `thinking` param is omitted entirely.
 *   - max_tokens ~300 — short, speech-bubble-length replies.
 *   - System prompt: three blocks, per personalization-spec.md section 3.3
 *     (extends the original two-block design):
 *       1. Stable block (companion identity + personality voice) —
 *          `cache_control: {type: "ephemeral"}`. Repeats identically across
 *          a user's messages.
 *       2. Quiz-derived profile digest (personalization-spec.md section
 *          3.4) — its own `cache_control: {type: "ephemeral"}` breakpoint.
 *          Changes only when a user retakes the quiz or edits their
 *          goals/companion (rare), so it's cache-stable like block 1, but
 *          kept as a separate breakpoint so a chat turn that only changed
 *          today's unkept-intentions list still reads blocks 1+2 from
 *          cache. Omitted entirely (falls back to the old two-block shape)
 *          when there's no quiz digest for this user.
 *       3. Volatile block (today's unkept intentions, etc.) — no
 *          `cache_control`, per "stable content before the breakpoint,
 *          volatile content after."
 *     Screen-time (personalization-spec.md section 2) is cut by founder
 *     decision — there is no screen-time content anywhere in this prompt.
 *   - Cache diagnostics: `usage.cache_creation_input_tokens` /
 *     `usage.cache_read_input_tokens` are logged on every real API call
 *     (see logCacheUsage below) per personalization-spec.md section 3.3's
 *     instruction to verify empirically whether adding the quiz digest
 *     pushes the stable prefix over the model's cacheable-prefix minimum
 *     (see shared/prompt-caching.md: 4096 tokens for claude-opus-4-8),
 *     rather than assuming the existing cache_control marker was ever
 *     producing reads.
 *   - Mock mode: if ANTHROPIC_API_KEY is unset, return a canned in-voice
 *     line instead of calling the API — same idea as services/twilio.ts's
 *     mock mode, so the app and tests work with zero API key. Reads the key
 *     from process.env directly (not config.ts) per the task brief, since
 *     config.ts is one of the files this phase must not touch.
 */

import type { Companion, Personality } from "../schemas.js";

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 300;

/** Personality voice descriptions — mirrors app/src/data/personalities.ts's tag + sampleLine. */
const PERSONALITY_VOICE: Record<Personality, { tag: string; sampleLine: string; voice: string }> =
  {
    coach: {
      tag: "DRIVEN",
      sampleLine: "We've got a plan and today is step one — let's get to work.",
      voice:
        "Driven and plan-oriented. You speak like a coach: energetic, forward-looking, always turning talk into the next concrete step. Short, motivating sentences.",
    },
    tough_love: {
      tag: "UNFILTERED",
      sampleLine: "Nobody is coming to save you. Show me what you've got.",
      voice:
        "Unfiltered and blunt. You don't coddle — you call out excuses and demand action, but you're never cruel for its own sake. Terse, direct sentences.",
    },
    mentor: {
      tag: "WISE",
      sampleLine: "Every master was once a beginner who refused to quit.",
      voice:
        "Wise and reflective. You speak like a mentor: calm, a little philosophical, drawing on perspective rather than pressure. Measured sentences, occasional aphorism.",
    },
    supportive: {
      tag: "WARM",
      sampleLine:
        "I'm proud of you for showing up today. We'll take it one step at a time, together.",
      voice:
        "Warm and encouraging. You speak like a supportive friend: validating, patient, always on the user's side. Gentle sentences, genuine warmth.",
    },
    rival: {
      tag: "COMPETITIVE",
      sampleLine: "I've already finished my training today. Your move.",
      voice:
        "Competitive and needling. You speak like a rival: playful trash talk that's secretly motivating, framing progress as a contest you're both in. Punchy, competitive sentences.",
    },
  };

/** Small hardcoded mock-mode reply pool per personality — mirrors sms-templates.ts's mock idea. */
export const MOCK_REPLIES: Record<Personality, string[]> = {
  coach: [
    "Good — you showed up. Now let's turn that into today's win.",
    "That's the step one I wanted to hear. What's next on the list?",
    "Solid. Keep that momentum, we build on it tomorrow.",
  ],
  tough_love: [
    "Fine. Talk's done — now go prove it.",
    "That's a start. Don't let it be the whole story.",
    "I've heard the plan. Show me the follow-through.",
  ],
  mentor: [
    "Every step counts, even the small ones you don't notice yet.",
    "Patience with yourself is part of the discipline too.",
    "The path is long — what matters is that you keep walking it.",
  ],
  supportive: [
    "I'm really glad you told me that. I'm right here with you.",
    "You're doing better than you think you are — keep going.",
    "That took something to say. Thank you for trusting me with it.",
  ],
  rival: [
    "Not bad. But I already logged mine today — catch up.",
    "Cute effort. Let's see if you can keep it up tomorrow.",
    "I'll allow it. Don't get comfortable though.",
  ],
};

export interface CompanionReplyInput {
  personality: Personality;
  companionName: string;
  species: Companion;
  /** Compact digest: goals, identity "why", today's unkept intentions, etc. Kept short. */
  memoryDigest: string;
  userMessage: string;
  /**
   * Quiz-derived profile digest (personalization-spec.md section 3.4),
   * already rendered to text by services/quiz-digest.ts's
   * buildQuizProfileDigest — this module doesn't build it itself, to keep
   * the chat/quiz concerns decoupled. Optional/empty is a normal state (no
   * quiz on file, or the user skipped it) and simply omits the second
   * system block, falling back to the original two-block shape.
   */
  quizDigest?: string;
}

/** One system-prompt block, in the shape the Anthropic SDK expects. */
export interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/** Deterministic-but-varied pick so mock mode isn't always the same line, without needing randomness. */
function pickMockReply(personality: Personality, userMessage: string): string {
  const pool = MOCK_REPLIES[personality];
  let hash = 0;
  for (let i = 0; i < userMessage.length; i++) {
    hash = (hash * 31 + userMessage.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length]!;
}

function buildStableSystemBlock(input: CompanionReplyInput): string {
  const voice = PERSONALITY_VOICE[input.personality];
  return [
    `You are ${input.companionName}, a ${input.species.replace(/_/g, " ")} companion in the Kaizi app.`,
    `Kaizi helps people keep small daily promises ("Intentions") to build discipline and identity over time.`,
    `Your personality is "${voice.tag}": ${voice.voice}`,
    `Example of your voice (do not repeat verbatim, just match the register): "${voice.sampleLine}"`,
    `Reply as ${input.companionName} in 1-3 short sentences, speech-bubble length. Never break character, never mention you are an AI or a language model.`,
  ].join("\n");
}

/**
 * Builds the full system-block array for a companion chat call — pure and
 * exported so its shape (block count, cache_control placement, ordering) is
 * unit-testable without a live API call. See CompanionReplyInput.quizDigest
 * for why block 2 is conditional.
 */
export function buildSystemBlocks(input: CompanionReplyInput): SystemBlock[] {
  const stableBlock = buildStableSystemBlock(input);
  const memoryBlock =
    input.memoryDigest.trim().length > 0
      ? `Here is what you remember about this user right now (keep it in mind, don't recite it verbatim):\n${input.memoryDigest.trim()}`
      : "You don't have any stored memory about this user yet.";
  const quizDigest = input.quizDigest?.trim();

  const blocks: SystemBlock[] = [
    // Block 1 — stable companion identity/voice, unchanged from the
    // original two-block design. Repeats identically across this user's
    // messages, so it gets its own cache breakpoint.
    { type: "text", text: stableBlock, cache_control: { type: "ephemeral" } },
  ];

  if (quizDigest && quizDigest.length > 0) {
    // Block 2 — quiz-derived profile digest (personalization-spec.md
    // section 3.4). Also cache_control'd: quiz answers change only on a
    // quiz retake or a goals/companion edit, which is rare, so this block
    // is stable across a large number of chat turns just like block 1. Its
    // own breakpoint means a turn that only changed block 3 (today's unkept
    // intentions) still gets a cache read on everything before it.
    blocks.push({ type: "text", text: quizDigest, cache_control: { type: "ephemeral" } });
  }

  // Final block — volatile memory digest (today's unkept intentions, etc.),
  // no cache_control, per "stable content before the breakpoint, volatile
  // content after."
  blocks.push({ type: "text", text: memoryBlock });

  return blocks;
}

/**
 * Logs cache_creation_input_tokens / cache_read_input_tokens from a real API
 * response, per personalization-spec.md section 3.3's instruction to verify
 * empirically (not assume) whether prompt caching is actually firing —
 * adding the quiz digest block may be what first pushes the stable prefix
 * over the model's cacheable-prefix minimum (4096 tokens for
 * claude-opus-4-8; see shared/prompt-caching.md). Exported so it can be
 * unit-tested independent of a live API call.
 */
export function logCacheUsage(usage: {
  input_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): void {
  const created = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  console.log(
    `[claude-chat] cache usage — input_tokens=${usage.input_tokens} ` +
      `cache_creation_input_tokens=${created} cache_read_input_tokens=${read} ` +
      `(${read > 0 ? "cache HIT" : created > 0 ? "cache WRITE, no prior read" : "not cached — below minimum prefix or no cache_control effect"})`
  );
}

/**
 * Call the Claude API for a single companion reply, or fall back to a mock
 * in-voice line when ANTHROPIC_API_KEY is unset.
 */
export async function getCompanionReply(input: CompanionReplyInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return pickMockReply(input.personality, input.userMessage);
  }

  // Lazy import: mock-mode processes (and most tests) never load the SDK.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemBlocks(input),
      messages: [{ role: "user", content: input.userMessage }],
    });

    logCacheUsage(response.usage);

    const textBlock = response.content.find(
      (block): block is Extract<(typeof response.content)[number], { type: "text" }> =>
        block.type === "text"
    );
    const text = textBlock?.text?.trim();
    return text && text.length > 0 ? text : pickMockReply(input.personality, input.userMessage);
  } catch (err) {
    // Never let a companion chat call take the app down — degrade to an
    // in-voice mock line rather than surfacing a raw API error to the user.
    console.error("[claude-chat] getCompanionReply failed, falling back to mock reply:", err);
    return pickMockReply(input.personality, input.userMessage);
  }
}
