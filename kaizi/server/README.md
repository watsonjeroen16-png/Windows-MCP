# Kaizi Server — Onboarding API

Express + TypeScript backend for the Kaizi onboarding flow. Four endpoints, by
design (see `../docs/architecture.md`): phone verification (Twilio Verify v2),
profile persistence (PostgreSQL), and the personality-toned first companion SMS
(Twilio Messaging). Nothing else.

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

## Endpoints

All bodies are JSON and validated with Zod; validation failures return
`400 {"error":"validation_failed","details":[...]}`. Phone numbers are E.164
(`^\+[1-9]\d{6,14}$`). `/api/verify/*`, `/api/onboarding/*`, and `/api/sms/*`
are each rate-limited per IP (5/min); `/api/verify/*` additionally has a
per-phone guard (5/min) and a per-phone daily cap (5/day) on `/start`, plus a
global circuit breaker (300 sends/hour, shared with `/api/sms/welcome`) that
trips on abnormal aggregate volume. Any of these return
`429 {"error":"rate_limited"}` or `503 {"error":"circuit_open"}` when tripped.

### Authentication

`POST /api/onboarding/profile` and `POST /api/sms/welcome` require a session
token: `Authorization: Bearer <token>`. The token is issued by
`POST /api/verify/check` on approval, is bound to the verified phone, and
expires after 30 minutes. These two endpoints derive the phone from the
token — **not** from the request body — so a bare phone number is no longer
sufficient to read or write someone else's onboarding data. A missing,
malformed, forged, or expired token gets `401 {"error":"unauthorized"}`.

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
# {"status":"approved","verified":true,"userId":"<uuid>","mock":true,
#  "token":"<session-token>","expiresAt":"2026-07-11T23:45:03.553Z"}
# wrong code -> 400 {"error":"invalid_code"} (no token issued)
```

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

## Database

PostgreSQL, plain SQL migrations in `src/db/migrations/`. Apply with:

```bash
DATABASE_URL=postgres://postgres:kaizi@localhost:5432/kaizi npm run migrate
```

Tables: `users` (phone-keyed identity, `phone_verified_at`, `welcomed_at`),
`onboarding_profiles`, `sms_preferences`, `memory_entries` (append-only
companion memory, seeded by onboarding). Applied migrations are tracked in
`schema_migrations`.

The route layer depends only on the `Db` interface (`src/db/types.ts`); tests
inject an in-memory implementation, so `npm test` needs no database.

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
