# Kaizi Server — Onboarding + Companion World API

Express + TypeScript backend. Two builds live in this codebase (see
`../docs/architecture.md`):

1. **Onboarding** (shipped): phone verification (Twilio Verify v2), profile
   persistence (PostgreSQL), and the personality-toned first companion SMS
   (Twilio Messaging) — four endpoints under `/api/verify`, `/api/onboarding`,
   `/api/sms`.
2. **Companion World** (shipped): Intentions (user-authored and AI-generated
   via `POST /api/intentions/generate`), companion chat (real Claude API),
   the onboarding personalization quiz (`POST /api/onboarding/quiz`),
   post-onboarding customization, and the Reflection journal — endpoint
   groups under `/api/intentions`, `/api/chat`, `/api/customization`,
   `/api/journal`, `/api/onboarding/quiz`, all requiring the same
   session-token auth as onboarding.

## Setup

Requires Node 20+.

```bash
cd kaizi/server
npm install
cp .env.example .env    # fill in values, or leave Twilio unset for mock mode
npm run dev             # tsx watch, http://localhost:4000
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run dev` | Run with tsx watch (restarts on change) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Vitest suite (mock mode, in-memory db — no Postgres/Twilio needed) |
| `npm run test:integration` | Same suite's Postgres-backed tests, against a real `DATABASE_URL` (opt-in, see below) |
| `npm run migrate` | Apply SQL migrations in `src/db/migrations/` to `DATABASE_URL` |
| `npm run typecheck` | `tsc --noEmit` |

### Testing against a real Postgres

`npm test` never needs a database — every route test runs against an
in-memory `Db` implementation (`test/helpers/memory-db.ts`). To additionally
exercise the real `pg`-backed implementation (`src/db/index.ts`) and the
actual SQL in `src/db/migrations/001_init.sql`:

```bash
docker run -d --name kaizi-pg -e POSTGRES_PASSWORD=kaizi -e POSTGRES_DB=kaizi -p 5432:5432 postgres:16
npm run migrate
npm run test:integration   # or: TEST_REAL_DB=1 npm test
```

`test/db-integration.test.ts` truncates its tables before each test and
walks the full HTTP flow (verify → profile → welcome) plus targeted checks
(atomic `markWelcomed` under concurrency, `ON DELETE CASCADE`, change
detection on `identityWhy`) through `createApp()` wired to the real `Db`.

## Mock mode

If **any** of `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_VERIFY_SERVICE_SID`, `TWILIO_MESSAGING_FROM` is unset, the server runs
in **mock mode** (announced at startup):

- `POST /api/verify/start` returns `{"status":"pending","mock":true}` — no SMS is sent.
- `POST /api/verify/check` approves only the code **`000000`**; anything else is
  `400 {"error":"invalid_code"}`.
- `POST /api/sms/welcome` logs the rendered SMS body and echoes it back as
  `{"status":"queued","mock":true,"body":"..."}` instead of sending.

Development and CI never require Twilio credentials or network access. The
server never crashes for lack of Twilio config.

## Environment

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 4000) |
| `DATABASE_URL` | Postgres connection string |
| `TWILIO_*` | Twilio credentials; leave unset (or commented out in `.env`) for mock mode — all four required together for live mode |
| `KAIZI_ENFORCE_QUIET_HOURS` | `true` to refuse welcome sends 21:30–07:30 server-local (default off) |
| `SESSION_SECRET` | HMAC secret for signing post-verification session tokens. If unset, a random per-process secret is generated (dev only — tokens invalidate on restart, and the server refuses to start with a generated secret when `NODE_ENV=production`). |
| `ANTHROPIC_API_KEY` | Claude API key for real companion chat replies (`/api/chat`). Leave unset for mock mode — canned in-voice replies, no network call, no key required for dev/CI. Get one at [console.anthropic.com](https://console.anthropic.com) (separate from any Claude subscription). |

## Endpoints

All bodies are JSON and validated with Zod; validation failures return
`400 {"error":"validation_failed","details":[...]}`. Phone numbers are E.164
(`^\+[1-9]\d{6,14}$`). `/api/verify/*`, `/api/onboarding/*`, and `/api/sms/*`
are each rate-limited per IP (5/min); `/api/verify/*` additionally has a
per-phone guard (5/min) and a per-phone daily cap (5/day) on `/start`, plus a
global circuit breaker (300 sends/hour, shared with `/api/sms/welcome`) that
trips on abnormal aggregate volume. The Companion World routes
(`/api/intentions` incl. `/generate`, `/api/chat`, `/api/customization`,
`/api/journal`) share **one** per-IP limiter instance (30/min by default,
aggregate across all four, not 30/min each) — `/api/chat` and
`/api/intentions/generate` both call the real (paid) Claude API per request,
so this budget is real-money-relevant, not just abuse-relevant.
`/api/intentions/generate` additionally caps real spend to one Claude call
per user per calendar day via an idempotency guard (see that endpoint's docs
below). Any of these return `429 {"error":"rate_limited"}` or
`503 {"error":"circuit_open"}` when tripped.

### Authentication

Every endpoint under `/api/onboarding/*` (`profile`, `quiz`), `/api/sms/*`,
and all four Companion World route groups (`/api/intentions` incl.
`/generate`, `/api/chat`, `/api/customization`, `/api/journal`) require a
session token: `Authorization: Bearer <token>`. The token is issued by
`POST /api/verify/check` on approval, is bound to the verified phone, and
expires after 30 minutes. These endpoints derive the phone from the
token — **not** from the request body — so a bare phone number is no longer
sufficient to read or write someone else's data. A missing, malformed,
forged, or expired token gets `401 {"error":"unauthorized"}`.

### `GET /health`

```bash
curl http://localhost:4000/health
# {"ok":true}
```

### `POST /api/verify/start`

Begin phone verification.

```bash
curl -X POST http://localhost:4000/api/verify/start \
  -H 'content-type: application/json' \
  -d '{"phone":"+15551234567"}'
# {"status":"pending","mock":true}
```

### `POST /api/verify/check`

Check the code. On approval the user row is created/updated with
`phone_verified_at = now()`, and a session token is issued.

```bash
curl -X POST http://localhost:4000/api/verify/check \
  -H 'content-type: application/json' \
  -d '{"phone":"+15551234567","code":"000000"}'
# {"status":"approved","verified":true,
#  "token":"<session-token>","expiresAt":"2026-07-11T23:45:03.553Z"}
# wrong code -> 400 {"error":"invalid_code"} (no token issued)
```

(`userId` and `mock` are deliberately not in this response — the app never
reads either, and echoing them to an unauthenticated caller was cosmetic
internal-state disclosure; see `docs/security-review.md` L-4.)

### `POST /api/onboarding/profile`

Persist the onboarding answers. Requires `Authorization: Bearer <token>`
from `verify/check` (`401 unauthorized` without one). Requires a verified
phone for that token: `404 phone_not_found` if the phone has never verified,
`409 phone_not_verified` if a user row exists but is unverified. Re-posting
updates the profile (`200`, `created:false`); first save is `201`. The
`identityWhy` answer also seeds a `memory_entries` row
(`kind: "identity_why"`); a changed answer appends a new memory entry.

```bash
curl -X POST http://localhost:4000/api/onboarding/profile \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer <token from verify/check>' \
  -d '{
    "goals": ["fitness", "discipline"],
    "identityWhy": "Because I am tired of almost. Because my kids are watching.",
    "companion": "fox",
    "personality": "coach",
    "environment": "japanese_garden",
    "smsPrefs": {"morning": true, "evening": true}
  }'
# 201 {"ok":true,"userId":"<uuid>","created":true}
```

Enums:

- `goals` (1–5, unique): `fitness | skin | business | discipline | learning`
- `companion`: `wolf_pup | fox | lion | dog | human_male | human_female | dragonkin`
- `personality`: `coach | tough_love | mentor | supportive | rival`
- `environment`: `cyber_city | modern_apartment | forest_village | mountain_retreat | dojo | coastal_paradise | fantasy_kingdom | space_colony | japanese_garden | training_campus | entrepreneur_district | sky_islands`
- `identityWhy`: 10–280 chars, trimmed

### `POST /api/onboarding/quiz`

Persist the 10-question onboarding personalization quiz
(`docs/design/personalization-spec.md` §1), or record a full skip. Same
auth/verification requirements as `/profile` (`401`/`404 phone_not_found`/
`409 phone_not_verified`). Body: `{ answers: {...all 10 fields optional...},
skippedEntirely?: boolean }` — every answer field is a strict `z.enum` (no
free text anywhere in the quiz), so there's no injection surface into the
`answers` JSONB column. Upsert semantics matching `/profile`: re-posting
**replaces** the whole `answers` object (not a merge) and updates the same
row (`200`, `created:false`); first save is `201`.

```bash
curl -X POST http://localhost:4000/api/onboarding/quiz \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer <token from verify/check>' \
  -d '{
    "answers": {
      "focusGoal": "fitness",
      "startingPoint": "restarting",
      "obstacle": "motivation_dips",
      "supportStyle": "direct",
      "availability": ["early_morning", "evening"],
      "motivationStyle": "visible_progress",
      "pastAttempts": "tried_apps_didnt_stick",
      "confidence": "fairly",
      "rhythm": "flexible",
      "ninetyDayVision": "measurable_result"
    }
  }'
# 201 {"ok":true,"userId":"<uuid>","created":true,"skippedEntirely":false}
```

### `POST /api/sms/welcome`

Render the personality template (verbatim from the design spec,
`src/services/sms-templates.ts`) and send the first companion SMS. Requires
`Authorization: Bearer <token>` from `verify/check` (`401 unauthorized`
without one). Refuses with `409 profile_missing` if onboarding isn't
complete, `409 already_welcomed` on a repeat call (`welcomed_at` is tracked
via an atomic claim, so two concurrent calls can't both send), `404
phone_not_found` for unknown phones.

```bash
curl -X POST http://localhost:4000/api/sms/welcome \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer <token from verify/check>' \
  -d '{}'
# mock mode: {"status":"queued","mock":true,"body":"It's Kaizi — your coach. ..."}
```

Template placeholders: `{firstGoal}` is the first selected goal mapped to a
lowercased noun (`fitness`, `your skin`, `your business`, `discipline`,
`learning`); `{whyPhrase}` is the `identityWhy` compressed to its first
sentence, first letter lowercased, trailing punctuation stripped — falling back
to "you want to change" if derivation fails. Rendered bodies are capped at 320
chars and never contain a raw placeholder.

## Companion World endpoints

Four more endpoint groups, all requiring `Authorization: Bearer <token>` from
`verify/check` (same as onboarding/sms; `401 unauthorized` without one), all
per-IP rate-limited (30/min by default, tighter than verify's 5/min but not
unbounded — `/api/chat` calls the real Claude API per message once
`ANTHROPIC_API_KEY` is set, so an unmetered rate is a real-money abuse vector).
Additive schema (`src/db/migrations/002_companion_world.sql`) — no onboarding
table is touched.

### `GET /api/intentions` / `POST /api/intentions` / `POST /api/intentions/:id/keep`

Daily habit/commitment instances (the renamed "Promises" mechanic). `GET`
takes an optional `?date=YYYY-MM-DD` (defaults to today) and returns that
day's intentions for the authenticated user. `POST` creates one (`title`,
optional `subtitle`, `rewardGrowth` 0–10000, `scheduledFor` YYYY-MM-DD) with
status `pending` and `source: "user"` (DB column default). `POST /:id/keep`
atomically transitions `pending -> kept` (claim-or-fail, same pattern as
`markWelcomed`) — `409 not_keepable` if the intention is missing, not owned
by the caller, or already kept/missed.

### `POST /api/intentions/generate`

AI-generate personalized intentions for a day (`docs/design/
personalization-spec.md` §3.2) — calls the real Claude API
(`claude-opus-4-8`, same as chat) via `src/services/intention-generator.ts`,
structured-output JSON matching the intention shape, built from the user's
goals + identity "why" + quiz-derived digest (mock mode: a goal-relevant
canned pool when `ANTHROPIC_API_KEY` is unset). Persists each result with
`source: "companion"`. Body: `{ count?: 1-5, scheduledFor?: YYYY-MM-DD }`,
both optional (`count` defaults to 3, `scheduledFor` to today).

**Idempotent per user/day (2026-07-12 security fix):** if intentions already
exist for the requested `scheduledFor` (of either source), this returns them
as-is (`200`, no new rows, no Claude call) instead of generating again —
caps real API spend to at most one generation per user per day and prevents
duplicate rows from a repeat call. First generation for a day is `201`.

```bash
curl -X POST http://localhost:4000/api/intentions/generate \
  -H 'content-type: application/json' \
  -H 'Authorization: Bearer <token from verify/check>' \
  -d '{}'
# 201 {"intentions":[{...,"source":"companion"} x3],"scheduledFor":"2026-07-12"}
# calling again same day -> 200, same rows returned, nothing new created
```

### `GET /api/chat` / `POST /api/chat`

Companion chat. `GET` returns recent messages (oldest first, `?limit=` capped
at 200, default 50). `POST` (`content`, 1–2000 chars) persists the user's
message, calls `getCompanionReply` (`src/services/claude-chat.ts`) — real
`claude-opus-4-8` via `@anthropic-ai/sdk` when `ANTHROPIC_API_KEY` is set, a
small in-voice canned-reply pool per personality otherwise (mock mode, mirrors
`services/twilio.ts`) — persists the reply, and returns both messages. The
system prompt is **three cache-breakpointed blocks** as of
`personalization-spec.md` §3.3: (1) stable companion identity/voice, (2) a
quiz-derived profile digest (its own cache breakpoint, only present when the
user has quiz data on file), (3) a volatile memory digest (goals, identity
"why", today's unkept intentions, never cached). A live API error degrades to
the mock reply rather than surfacing a 500.

### `GET /api/customization` / `PUT /api/customization`

Mutable post-onboarding companion appearance/personality/environment — unlike
onboarding's one-time choice, this can change any time. `GET` returns the
current row if one exists, else falls back to the original onboarding profile
choice (`source: "onboarding_profile"` vs `"customization"` in the response),
or `404 not_customized` if neither exists. `PUT` (`companionSpecies`,
`personality`, `environment` — same enums as onboarding) upserts the full
record.

### `GET /api/journal` / `POST /api/journal`

Reflection entries (`content`, 1–4000 chars). `GET` returns recent entries
newest-first (`?limit=`, capped at 200, default 50); storage only for now —
the "memory echo" retrieval described in `docs/design/world-spec.md` #3 is not
yet built.

## Database

PostgreSQL, plain SQL migrations in `src/db/migrations/`. Apply with:

```bash
DATABASE_URL=postgres://postgres:kaizi@localhost:5432/kaizi npm run migrate
```

Tables: `users` (phone-keyed identity, `phone_verified_at`, `welcomed_at`),
`onboarding_profiles`, `sms_preferences`, `memory_entries` (append-only
companion memory, seeded by onboarding) from `001_init.sql`; `intentions`,
`chat_messages`, `companion_customization`, `journal_entries` from
`002_companion_world.sql` (additive, FKs to `users`, never touches an
onboarding table). Applied migrations are tracked in `schema_migrations`.

The onboarding route layer depends only on the `Db` interface
(`src/db/types.ts`); the Companion World route layer depends only on the
`WorldDb` interface (`src/db/world-types.ts`). Tests inject in-memory
implementations of both (`test/helpers/memory-db.ts`,
`src/db/world-memory.ts`), so `npm test` needs no database.

## Security notes

- No secrets in the repo; `.env.example` is placeholders only.
- Verification codes are never stored — Twilio Verify owns the code lifecycle.
- Helmet + CORS enabled; JSON error handler never leaks stack traces.
- SMS bodies are template-interpolated with a hard length cap.
- `/api/onboarding/profile` and `/api/sms/welcome` require a short-lived
  signed session token issued by `verify/check`; the phone is derived from
  the token, never trusted from the request body (see `src/middleware/auth.ts`,
  `src/services/session-token.ts`, and `docs/security-review.md` H-2).
- SMS-pumping guards: per-phone daily cap on `verify/start` and a shared
  global circuit breaker across all outbound sends (`src/middleware/rate-limit.ts`,
  `docs/security-review.md` M-1).

See `docs/security-review.md` for the full review and current status of all findings.
