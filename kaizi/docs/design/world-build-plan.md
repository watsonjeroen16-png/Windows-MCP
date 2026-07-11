# Kaizi — Companion World Build Plan

Scope: the post-onboarding core app — Home (living Companion World), real companion chat,
customization, Journey, Reflection. Builds on the approved `world-spec.md` mechanics and
the founder-approved v2 mockup. Vocabulary: **"Promise" → "Intention"** throughout, per
founder decision (2026-07-11).

Status: **planning complete, build queued** — waiting on the Confidence Engineer to finish
its onboarding hardening pass (still editing `kaizi/server`) before starting backend work
here, to avoid two agents racing on the same files.

---

## Companion chat — architecture decision

**Real AI via the Claude API**, per founder decision. Concretely:

- **Model:** `claude-opus-4-8` (current default per Anthropic guidance — do not substitute
  a cheaper model without an explicit founder decision to do so later for cost reasons).
- **SDK:** official `@anthropic-ai/sdk` (TypeScript), added to `kaizi/server`. One call per
  companion message via `client.messages.create()` — this is a single-turn "answer as the
  companion" call, not an agentic tool-use loop, so no Tool Runner needed.
- **Thinking:** off (`thinking` omitted) — this is a conversational companion reply, not a
  reasoning task; keeps latency and cost down for a chat product.
- **System prompt, built per user:** companion name + species + chosen personality's voice
  (from `kaizi/app/src/data/personalities.ts`, already written for onboarding) + current
  environment/world flavor + a compact memory digest (goals, identity "why", recent
  reflection entries, unkept intentions today). Kept short and factual — not a transcript
  dump — to control token cost.
- **Prompt caching:** the stable part of the system prompt (personality voice + companion
  identity) gets `cache_control: {type: "ephemeral"}` since it repeats identically across
  a user's messages; the volatile memory digest goes after the cache breakpoint.
- **Mock mode:** same pattern as Twilio — if `ANTHROPIC_API_KEY` is unset, the server
  returns a canned response drawn from the personality's existing quote pool
  (`kaizi_v2_enhanced.html`'s per-activity quotes are a good source) instead of calling the
  API, so local development and CI never require a live key.
- **Cost control:** `max_tokens` capped low (~300) — companion replies are short,
  speech-bubble-length text, not essays.

**What the founder needs to provide:** an `ANTHROPIC_API_KEY` from
[console.anthropic.com](https://console.anthropic.com) (Anthropic Console — separate from
any Claude subscription), added to `kaizi/server/.env`. Real-money cost note: this is a
per-message API charge once live, distinct from Twilio's per-SMS cost — worth watching
usage once real users exist. Nothing is blocked without it; mock mode covers all
development and testing.

## New backend surface (queued, not yet built)

- `POST /api/chat/message` — send a user message, get the companion's reply. Persists both
  sides to a new `chat_messages` table (also feeds "memory echo" retrieval per
  `world-spec.md` #3).
- `intentions` table + endpoints — daily habit/commitment instances (the renamed
  "Intentions" mechanic), replacing the onboarding schema's placeholder.
- `companion_customization` table + endpoints — species/appearance, personality, and
  environment become editable any time post-onboarding, not locked to the onboarding
  choice (founder's "more customization" ask).
- `journal_entries` table — Reflection screen entries, also feeds memory echoes.
- Extends existing Postgres schema additively (new migration file); does not touch the
  onboarding tables.

## New app screens (queued, not yet built)

Home (living world, real companion state) · Companion Chat (real AI, replacing the
mockup's static demo) · Intentions (renamed Promises screen) · Journey · Identity/Profile
with real customization · Reflection. Visual target: the enhanced garden mockup once the
Motion Designer's pass is approved.

## Sequencing

1. Confidence Engineer finishes onboarding hardening (in progress).
2. Motion Designer's enhanced mockup approved by founder (in progress).
3. Backend: new migration + endpoints above, including the chat integration.
4. Mobile: new screens wired to the new endpoints, replacing the mockup's demo JS.
5. QA pass across the expanded app.
