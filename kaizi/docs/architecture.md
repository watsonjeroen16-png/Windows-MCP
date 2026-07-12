# Kaizi — Architecture

Status: living document. **As of 2026-07-12, both phases described below are
built and verified.** This document originally described only the
**onboarding MVP** (founder directive, July 2026): the 7 onboarding frames
plus the supporting backend, with the app resting on the post-verification
handoff screen and the relationship continuing over SMS. Onboarding is now
8 screens (a 10-question personalization quiz was added as step 4, per
`design/personalization-spec.md`; screen-time opt-in was designed but cut by
the founder — see that doc's §2), and the app no longer rests on the handoff
screen — it continues into the **Companion World** restructure.

**Companion World.** Per founder decision (2026-07-11), the post-onboarding
core app (living Companion World, real companion chat, Intentions,
customization, Reflection) was authorized; see `design/world-build-plan.md`
for its backend architecture and `design/world-spec.md` for the approved
retention mechanics. That backend is now consumed by the **World/You
restructure** (`design/app-restructure-v3.md`, 2026-07-12): World is the
app's only home (zone travel strip, companion, chat FAB, intentions pouch),
You is a deliberate side trip (Progress/Companion/Settings tabs), and Chat/
Intentions/Reflection are contextual bottom sheets over the world rather than
separate screens or tabs — the flat Mission Hub/Progress/Profile screen set
in `design/wireframes.md` was superseded by this restructure, not built as
originally sketched there. Verified end-to-end against real Postgres,
zero functional bugs (`../docs/confidence-report-v3.md`).

## System overview

```
┌───────────────────────┐        HTTPS         ┌──────────────────────┐
│  kaizi/app (Expo)     │ ──────────────────▶  │  kaizi/server        │
│  React Native + TS    │   /api/verify/*      │  Express + TS        │
│  8 onboarding screens  │   /api/onboarding/*  │  Zod validation      │
│  (incl. quiz) + World/ │   /api/sms/welcome   │  rate limiting       │
│  You (zones, sheets)   │   /api/intentions/*  │  session-token auth  │
│  Reanimated            │   /api/chat          │                      │
│                        │   /api/customization │                      │
│                        │   /api/journal       │                      │
└───────────────────────┘                      └─────┬──────────┬─────┘
                                                   │          │
                                       PostgreSQL      Twilio + Claude API
                                       (profiles, quiz,  (Verify + Messaging,
                                        world, memory)    companion chat/gen)
```

## Stack decisions (founder-fixed)

| Layer | Choice | Rationale |
|---|---|---|
| Mobile | React Native + Expo, TypeScript | Fast iteration, OTA updates, single codebase |
| Animation | React Native Reanimated + react-native-svg | Mockup's animation vocabulary as SVG/gradient loops; no paid assets |
| Navigation | Lightweight stack within onboarding; two-destination (World/You) + contextual sheets post-onboarding | 8 linear onboarding screens, then World-as-home with You as a side trip — no persistent tab bar (`design/app-restructure-v3.md` §3); a full router is still overkill at this scope |
| State | React context + reducer (`OnboardingProvider`, `WorldProvider`) | Two flows, two state shapes; a store library still adds nothing yet |
| Backend | Node.js + Express, TypeScript | Small API surface, team familiarity |
| Validation | Zod at every request boundary | Shared, typed schemas; E.164 enforcement |
| DB | PostgreSQL, plain SQL migrations | `users`, `onboarding_profiles`, `sms_preferences`, `memory_entries` |
| Phone verification | Twilio Verify v2 | Purpose-built, handles code lifecycle/resend; we never store codes |
| First SMS | Twilio Messaging | Personality-toned template chosen server-side |

## Key decisions

1. **Mock-first external services.** When Twilio env vars are absent the server
   runs a deterministic mock (verify accepts `000000`, SMS is logged). The app
   likewise falls back to an in-app mock API when the server is unreachable.
   Development and CI never require credentials or network.

2. **Phone number is the only contact detail.** No email, no auth provider at
   this stage. A user row is keyed by verified E.164 phone. This is a product
   decision (SMS-first companion) and a privacy posture.

3. **Identity answer seeds companion memory.** The "Why are you doing this?"
   response is written to `memory_entries` at profile creation — the memory
   system exists from the user's first minute, and the first SMS references it.

4. **First SMS is server-rendered from design-owned templates.** The five
   personality templates live in the design spec and are transcribed verbatim
   into the server; copy changes are a design-doc diff, not a code refactor.

5. **Rate limiting on verify endpoints.** Twilio Verify costs money per attempt
   and is an abuse vector; `/api/verify/*` is rate-limited per IP and per phone.

6. **Companions/environments are stylized SVG compositions**, defined
   shape-by-shape in the onboarding spec — premium look with zero licensed
   assets, animated with Reanimated loops per the mockup vocabulary.

## API surface

**Onboarding (original MVP scope):**

| Endpoint | Purpose |
|---|---|
| `POST /api/verify/start` | Begin Twilio Verify for an E.164 phone |
| `POST /api/verify/check` | Check a verification code; issues the session token every other endpoint below requires |
| `POST /api/onboarding/profile` | Persist goals, identityWhy, companion, personality, environment, smsPrefs |
| `POST /api/onboarding/quiz` | Persist the 10-question personalization quiz (or a full skip) — `design/personalization-spec.md` §1 |
| `POST /api/sms/welcome` | Send the personality-toned first companion SMS |

**Companion World (built and wired, see `design/world-build-plan.md` for the
full contract):**

| Endpoint | Purpose |
|---|---|
| `GET/POST /api/intentions`, `POST /api/intentions/:id/keep` | Daily intentions — list, create (manual, `source:"user"`), keep |
| `POST /api/intentions/generate` | AI-generate personalized intentions via Claude, persisted as `source:"companion"` — idempotent per user/day (see `security-review.md`'s 2026-07-12 addendum) |
| `GET/POST /api/chat` | Companion chat history / send a message, real Claude API reply |
| `GET/PUT /api/customization` | Companion species/personality/environment, editable post-onboarding |
| `GET/POST /api/journal` | Reflection journal entries |

All Companion World routes and `/api/onboarding/*` require the
`Authorization: Bearer <session-token>` issued by `verify/check`; the world
routes are additionally rate-limited (30/min/IP, shared across all four).

## Security notes

- No real secrets in the repo; `.env.example` carries placeholders only.
- Verification codes are never stored; Twilio Verify owns the code lifecycle.
- Zod rejects malformed payloads before any DB or Twilio call — quiz answers
  are strictly enum-validated (no free-text quiz fields), closing off any
  JSONB/prompt-injection surface from the quiz specifically.
- Helmet is configured on the server. **CORS middleware was removed entirely
  (2026-07-12, M-4 fix)** — the only client is the native Expo app, and
  native `fetch` ignores CORS, so an open `Access-Control-Allow-Origin: *`
  served no purpose and was a real (if narrow) exposure; see
  `security-review.md` M-4.
- SMS body is template-interpolated with length caps (no user-controlled
  unbounded content to Twilio); chat/journal bodies are length-capped
  server-side (2000/4000 chars) regardless of client-side limits.
- Full findings and fix history: `security-review.md` (original 2026-07-11
  pass plus a 2026-07-12 addendum scoped to the quiz and
  `/api/intentions/generate` routes).
