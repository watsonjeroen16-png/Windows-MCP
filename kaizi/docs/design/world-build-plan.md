# Kaizi — Companion World Build Plan

Scope: the post-onboarding core app — Home (living Companion World), real companion chat,
customization, Journey, Reflection. Builds on the approved `world-spec.md` mechanics and
the founder-approved v2 mockup. Vocabulary: **"Promise" → "Intention"** throughout, per
founder decision (2026-07-11).

Status: **backend surface built and wired** (2026-07-11). The Companion World Backend
Engineer built the migration, `WorldDb` interface, and the four routers below as new files
while the Confidence Engineer finished its onboarding hardening pass in parallel (per its
`PENDING_INTEGRATION.md`, to avoid two agents racing on `app.ts`/`index.ts`); those files
have since been wired in by hand (routers mounted, `WorldDb` constructed in `index.ts`,
`ANTHROPIC_API_KEY` documented in `.env.example`, per-IP rate limiting added), typechecked,
and verified end-to-end against real Postgres (migration `002_companion_world.sql` applied
cleanly after `001_init.sql`). See `kaizi/server/README.md` for the live endpoint contract.
**Mobile screens are still queued** — nothing in `kaizi/app` consumes this surface yet.

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

## New backend surface (built, wired, live)

- `GET /api/chat` / `POST /api/chat` — chat history / send a user message, get the
  companion's reply. Persists both sides to `chat_messages` (also feeds future "memory
  echo" retrieval per `world-spec.md` #3 — retrieval itself is not built yet, only storage).
  (Actual path is `/api/chat`, not the originally-sketched `/api/chat/message`.)
- `intentions` table + `GET/POST /api/intentions`, `POST /api/intentions/:id/keep` — daily
  habit/commitment instances (the renamed "Intentions" mechanic), replacing the onboarding
  schema's placeholder. No XP ledger yet — the client reads `reward_growth` off the
  returned intention.
- `companion_customization` table + `GET/PUT /api/customization` — species/appearance,
  personality, and environment become editable any time post-onboarding, not locked to the
  onboarding choice (founder's "more customization" ask). Falls back to the onboarding
  profile's original choice until the user customizes.
- `journal_entries` table + `GET/POST /api/journal` — Reflection screen entries; storage
  only for now, memory-echo retrieval not yet built.
- Extends existing Postgres schema additively (`002_companion_world.sql`); does not touch
  the onboarding tables. Applied and verified idempotent against real Postgres.
- All four groups require the same `Authorization: Bearer <token>` session auth as
  onboarding/sms, and are per-IP rate-limited (30/min default) — `/api/chat` calls the real
  Claude API per message once live, so it's a real-money abuse vector the same way
  unbounded `/api/verify/start` is for Twilio.
- **Known plan gaps** (not blocking this phase, but needed before `world-spec.md` #5/#6 can
  be built): no server-side "current activity" tracking, no persisted world-state/streak-
  milestone table. See `kaizi/docs/ep-notes.md`.

## New app screens (queued, not yet built)

Home (living world, real companion state) · Companion Chat (real AI, replacing the
mockup's static demo) · Intentions (renamed Promises screen) · Journey · Identity/Profile
with real customization · Reflection. Visual target: the enhanced garden mockup once the
Motion Designer's pass is approved. **The backend surface above is ready for these to
consume** — nothing in `kaizi/app` reaches it yet.

## Sequencing

1. ~~Confidence Engineer finishes onboarding hardening.~~ Done.
2. ~~Motion Designer's enhanced mockup approved by founder.~~ Mockup complete
   (`kaizi_v2_enhanced.html`); founder approval status not tracked in this doc.
3. ~~Backend: new migration + endpoints above, including the chat integration.~~ Done, wired,
   verified against real Postgres.
4. Mobile: new screens wired to the new endpoints, replacing the mockup's demo JS. **Not
   started.**
5. QA pass across the expanded app. **Not started** — depends on step 4.
