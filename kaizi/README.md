# Kaizi

**Build a life that builds you back.**

Kaizi is an AI companion disguised as a self-improvement platform. Users create a
personalized companion (appearance, personality, environment) that coaches them
toward the person they want to become — through daily promises, check-ins, and a
long-term memory of their goals, wins, and struggles. Retention comes from the
relationship, not the todo list.

This repository contains two phases. **Shipped:** the onboarding flow MVP — a
7-screen mobile onboarding (goals, identity, companion, personality, environment,
SMS setup with phone verification) backed by an API that persists the profile and
sends the companion's first personalized SMS. **In progress:** the Companion World
backend (Intentions, real companion chat via the Claude API, post-onboarding
customization, Reflection journal — see `docs/design/world-build-plan.md`) is built
and wired into the server; the Expo screens that consume it are not started yet.

**New to the project?** Start with the
**[Founder Guide](docs/founder-guide.md)** — a friendly, step-by-step
walkthrough from a blank machine to completing onboarding on your phone and
receiving the companion's first SMS (mock mode and real Twilio mode).

## Monorepo layout

```
kaizi/
├── app/        Expo (React Native + TypeScript) mobile app — onboarding screens
├── server/     Node.js + Express (TypeScript) API — onboarding (profile, Twilio
│               Verify, first SMS) + Companion World (Intentions, chat, customization,
│               journal — see server/README.md)
├── docs/
│   ├── design/     Mockups, wireframes, onboarding spec, design tokens,
│   │               world-build-plan.md, world-spec.md
│   ├── architecture.md
│   ├── founder-guide.md      Step-by-step run-it-yourself guide (onboarding)
│   ├── qa-report.md          Onboarding QA pass
│   ├── security-review.md    Security review + fix log
│   └── ep-notes.md           Known gaps between the plan and what's buildable today
└── README.md   (this file)
```

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (local or Docker)
- (Optional) Twilio account with a Verify service and a Messaging-capable phone
  number. **The server runs fully offline in mock mode when Twilio env vars are
  absent** — verification codes are accepted as `000000` and SMS sends are logged
  instead of sent.

## Running the server

```bash
cd kaizi/server
cp .env.example .env         # fill in Postgres + (optionally) Twilio values
npm install
npm run migrate              # apply SQL migrations to Postgres (both onboarding + Companion World)
npm run dev                  # starts on http://localhost:4000
npm test                     # unit + endpoint tests (Twilio + Claude API mocked)
```

### Postgres quick start (Docker)

```bash
docker run -d --name kaizi-pg -e POSTGRES_PASSWORD=kaizi -e POSTGRES_DB=kaizi -p 5432:5432 postgres:16
```

### Twilio env setup

| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Account SID from the Twilio console |
| `TWILIO_AUTH_TOKEN` | Auth token |
| `TWILIO_VERIFY_SERVICE_SID` | Verify v2 service SID (`VA...`) for phone verification |
| `TWILIO_MESSAGING_FROM` | E.164 number (or Messaging Service SID) the companion texts from |

Mock mode activates when **any** of the four is unset — all four are required
for live Twilio mode (development without Twilio needs none of them).

## Running the app

```bash
cd kaizi/app
npm install
npm start                    # Expo dev server; press i / a or scan QR
npm run typecheck            # tsc --noEmit
npm test                     # pure-logic unit tests (reducer, validators, formatters)
```

Set `EXPO_PUBLIC_API_URL` (see `kaizi/app/.env.example`) to point at the server.
Without a reachable server the app falls back to an in-app mock API so the full
onboarding flow can be exercised offline.

## Design source of truth

- Onboarding mockup: `docs/design/kaizi_mvp_mockup.html`
- Companion World mockups: `docs/design/kaizi_v2_mockup.html` (founder-provided
  foundation), `docs/design/kaizi_v2_enhanced.html` (animation/motion pass)
- Wireframes: `docs/design/wireframes.md`
- Onboarding spec: `docs/design/onboarding-spec.md`
- Companion World spec + retention mechanics: `docs/design/world-spec.md`,
  `docs/design/v2-retention-proposals.md`, `docs/design/world-build-plan.md`
- Tokens: `docs/design/tokens.md`

Aesthetic in one line: dark ink grounds, cream/sand/gold accents, Cormorant
Garamond serif for meaning, Inter sans for structure, glassmorphism cards, quiet
zen-garden motion. The product speaks in "promises", not tasks.
