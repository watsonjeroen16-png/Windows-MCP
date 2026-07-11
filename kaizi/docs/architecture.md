# Kaizi — Architecture (Onboarding MVP)

Status: living document. This document describes the **onboarding MVP** that
shipped first (founder directive, July 2026): the 7 onboarding frames plus the
supporting backend, with the app resting on the post-verification handoff
screen and the relationship continuing over SMS. That scope is complete and
covered below.

**Companion World build now underway.** Per founder decision (2026-07-11), a
second phase — the post-onboarding core app (living Companion World, real
companion chat, Intentions, customization, Reflection) — is now authorized and
in active development; see `design/world-build-plan.md` for its architecture,
sequencing, and status, and `design/world-spec.md` for the approved retention
mechanics it implements. Mission Hub, Progress, and Profile screens beyond
what `world-build-plan.md` scopes are still documented in `design/wireframes.md`
as future context only.

## System overview

```
┌─────────────────────┐        HTTPS         ┌──────────────────────┐
│  kaizi/app (Expo)   │ ──────────────────▶  │  kaizi/server        │
│  React Native + TS  │   /api/onboarding    │  Express + TS        │
│  7 onboarding       │   /api/verify/*      │  Zod validation      │
│  screens, Reanimated│   /api/sms/welcome   │  rate limiting       │
└─────────────────────┘                      └─────┬──────────┬─────┘
                                                   │          │
                                             PostgreSQL    Twilio
                                             (profiles,    (Verify +
                                              memory)      Messaging)
```

## Stack decisions (founder-fixed)

| Layer | Choice | Rationale |
|---|---|---|
| Mobile | React Native + Expo, TypeScript | Fast iteration, OTA updates, single codebase |
| Animation | React Native Reanimated + react-native-svg | Mockup's animation vocabulary as SVG/gradient loops; no paid assets |
| Navigation | Lightweight stack within a single onboarding flow | 7 linear screens; a full router is overkill at this scope |
| State | React context + reducer (`OnboardingProvider`) | One linear flow, one state shape; a store library adds nothing yet |
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

## API surface (complete, by design)

| Endpoint | Purpose |
|---|---|
| `POST /api/verify/start` | Begin Twilio Verify for an E.164 phone |
| `POST /api/verify/check` | Check a verification code |
| `POST /api/onboarding/profile` | Persist goals, identityWhy, companion, personality, environment, smsPrefs |
| `POST /api/sms/welcome` | Send the personality-toned first companion SMS |

Anything beyond these four endpoints was out of scope for the onboarding MVP.
The Companion World phase adds a second set of endpoints (chat, Intentions,
customization, journal) on an additive migration — see
`design/world-build-plan.md` for that surface.

## Security notes

- No real secrets in the repo; `.env.example` carries placeholders only.
- Verification codes are never stored; Twilio Verify owns the code lifecycle.
- Zod rejects malformed payloads before any DB or Twilio call.
- Helmet + CORS configured on the server; SMS body is template-interpolated
  with length caps (no user-controlled unbounded content to Twilio).
