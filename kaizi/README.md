# Kaizi

**Build a life that builds you back.**

Kaizi is an AI companion disguised as a self-improvement platform. Users create a
personalized companion (appearance, personality, environment) that coaches them
toward the person they want to become — through daily promises, check-ins, and a
long-term memory of their goals, wins, and struggles. Retention comes from the
relationship, not the todo list.

This repository currently contains the **onboarding flow MVP**: a 7-screen mobile
onboarding (goals, identity, companion, personality, environment, SMS setup with
phone verification) backed by an API that persists the profile and sends the
companion's first personalized SMS.

**New to the project?** Start with the
**[Founder Guide](docs/founder-guide.md)** — a friendly, step-by-step
walkthrough from a blank machine to completing onboarding on your phone and
receiving the companion's first SMS (mock mode and real Twilio mode).

## Monorepo layout

```
kaizi/
├── app/        Expo (React Native + TypeScript) mobile app — onboarding screens
├── server/     Node.js + Express (TypeScript) API — profile, Twilio Verify, first SMS
├── docs/
│   ├── design/     Mockup, wireframes, onboarding spec, design tokens
│   ├── architecture.md
│   └── founder-guide.md   Step-by-step run-it-yourself guide
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
npm run migrate              # apply SQL migrations to Postgres
npm run dev                  # starts on http://localhost:4000
npm test                     # unit + endpoint tests (Twilio mocked)
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
```

Set `EXPO_PUBLIC_API_URL` (see `kaizi/app/.env.example`) to point at the server.
Without a reachable server the app falls back to an in-app mock API so the full
onboarding flow can be exercised offline.

## Design source of truth

- Interactive mockup: `docs/design/kaizi_mvp_mockup.html`
- Wireframes: `docs/design/wireframes.md`
- Onboarding spec: `docs/design/onboarding-spec.md`
- Tokens: `docs/design/tokens.md`

Aesthetic in one line: dark ink grounds, cream/sand/gold accents, Cormorant
Garamond serif for meaning, Inter sans for structure, glassmorphism cards, quiet
zen-garden motion. The product speaks in "promises", not tasks.
