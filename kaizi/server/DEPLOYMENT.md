# Kaizi Server — Production Deployment (Railway)

This is a concrete, opinionated guide to deploying the Kaizi Express/Postgres
API to [Railway](https://railway.app). Railway is picked over Fly.io here
because the stack is a single small Node service + a managed Postgres add-on
with no need for multi-region or volume-heavy workloads — Railway's
git-push-to-deploy plus one-click Postgres provisioning gets a founder from
zero to a live URL with the least ceremony.

**You (the founder) need to do the account/credential parts yourself** — this
guide tells you exactly what to click and set, but nobody else can create your
Railway account, your Twilio account, or your Anthropic API key on your
behalf.

## 0. Prerequisites

- A [Railway](https://railway.app) account (GitHub login is easiest).
- This repository pushed to a GitHub repo Railway can access (or use the
  Railway CLI to deploy from a local checkout — see §5).
- Twilio Account SID, Auth Token, a Verify v2 Service SID, and a
  Messaging-capable phone number (see `kaizi/docs/GETTING-CREDENTIALS.md` §2
  for the beginner-friendly click-by-click steps, or `kaizi/docs/founder-guide.md`
  §6 for the same steps in the context of local dev — either way, just plug
  the real values in below instead of a `.env` file).
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
  (separate from any Claude.ai subscription) if you want live companion chat
  replies (`/api/chat`) instead of the mock canned-reply pool — see
  `kaizi/docs/GETTING-CREDENTIALS.md` §1 for click-by-click steps.

## 1. Create the Railway project and service

1. Railway dashboard → **New Project** → **Deploy from GitHub repo** → select
   this repository.
2. Because this is a monorepo, Railway will ask for the service's **root
   directory** — set it to `kaizi/server`. (Settings → General → Root
   Directory, if it's not prompted up front.)
3. Railway auto-detects the Dockerfile in `kaizi/server/Dockerfile` and builds
   with it (Settings → Build → Builder: **Dockerfile**, Dockerfile path:
   `Dockerfile`). This uses the exact multi-stage image also used for local
   dev via `docker-compose.yml` — same artifact in dev and prod.
4. Rename the service to something recognizable, e.g. `kaizi-server`.

## 2. Provision Postgres

1. In the same Railway project: **New** → **Database** → **Add PostgreSQL**.
2. Railway provisions a managed Postgres instance and exposes a
   `DATABASE_URL` reference variable on it automatically.
3. On the `kaizi-server` service, go to **Variables** and add a reference:
   `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (Railway's variable
   reference syntax; pick the Postgres service from the dropdown rather than
   typing it by hand so it stays in sync if Railway rotates credentials).

## 3. Set every required production environment variable

On the `kaizi-server` service → **Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | **Required.** The server's own boot check (`src/index.ts`) refuses to start with `NODE_ENV=production` unless Twilio creds are fully set AND `SESSION_SECRET` is explicitly set — this is a deliberate fail-closed guard, not a bug, so don't try to bypass it by leaving `NODE_ENV` unset. |
| `PORT` | leave unset | Railway injects its own `PORT` and the server already reads `process.env.PORT` (defaults to 4000) — don't hardcode a conflicting value. |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference variable from step 2, not a literal string. |
| `SESSION_SECRET` | a real random secret — **generate one, do not leave it default** | Generate locally: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Paste the output as the value. This signs post-verification session tokens (`src/services/session-token.ts`); losing/rotating it invalidates all outstanding sessions, so treat it like a password and store it in your password manager, not just in Railway. |
| `TWILIO_ACCOUNT_SID` | from Twilio Console → Account Info | Starts with `AC...`. |
| `TWILIO_AUTH_TOKEN` | from Twilio Console → Account Info | Treat as a secret. |
| `TWILIO_VERIFY_SERVICE_SID` | from Twilio Console → Verify → your service | Starts with `VA...`. |
| `TWILIO_MESSAGING_FROM` | your Twilio SMS-capable number (E.164, e.g. `+15551234567`) or a Messaging Service SID (`MG...`) | All four `TWILIO_*` vars are required together — the server falls back to mock mode if even one is missing, and in `NODE_ENV=production` that's a fatal boot error by design, not a silent downgrade. |
| `ANTHROPIC_API_KEY` | from console.anthropic.com | Optional but recommended for launch — without it, `/api/chat` degrades to a small in-voice canned-reply pool per personality instead of real Claude replies. |
| `KAIZI_ENFORCE_QUIET_HOURS` | `true` (recommended for production) | Refuses `/api/sms/welcome` sends 21:30–07:30 server-local time. Off by default; turn it on once you're sending real SMS to real users. |

Do **not** set `TEST_REAL_DB` — that's a test-only opt-in flag, irrelevant in
production.

## 4. Run the migration on first deploy

The compiled image ships `dist/db/migrate.js` (compiled from
`src/db/migrate.ts`, with the SQL files under `src/db/migrations/` copied
alongside it in the Dockerfile's build stage). Two ways to run it against the
Railway Postgres before traffic hits the app:

**Option A — Railway's pre-deploy command (recommended):**

Service → Settings → Deploy → **Custom Start Command** section has a
"Pre-deploy Command" field (or equivalent "Release Command" depending on your
Railway UI version) — set it to:

```
node dist/db/migrate.js
```

Railway runs this once per deploy, before swapping traffic to the new
release, using the same environment variables (so it sees `DATABASE_URL`).

**Option B — run it manually once, via the Railway CLI:**

```bash
npm i -g @railway/cli
railway login
railway link                      # select this project/service
railway run node dist/db/migrate.js
```

Either way, the migration runner is idempotent (`schema_migrations` table
tracks applied files) — safe to re-run on every deploy, including ones with
no new migrations.

## 5. Deploy

- **Git-based (recommended):** push to the branch Railway is tracking
  (typically `main`); Railway builds the Dockerfile and deploys automatically.
- **CLI (one-off or first deploy before wiring CI):**
  ```bash
  railway login
  railway link
  railway up
  ```

Railway assigns a public URL like `kaizi-server-production.up.railway.app`
(Settings → Networking → **Generate Domain** if one isn't assigned yet). Point
the mobile app's `EXPO_PUBLIC_API_URL` at this URL (must be `https://` — the
app's release-build gate refuses a plain-HTTP base URL, see
`kaizi/app/README.md`).

## 6. Post-deploy smoke-test checklist

Run these against your real Railway URL (`$URL` below) after every deploy,
especially the first one:

1. **Health check:**
   ```bash
   curl https://$URL/health
   # expect: {"ok":true}
   ```
2. **Boot log sanity** — in the Railway dashboard's deploy logs, confirm you
   see `[kaizi] Twilio LIVE mode` (not `MOCK MODE`) and no `FATAL` lines. If
   you see a `FATAL` line about mock verification or a generated
   `SESSION_SECRET`, a required env var from §3 is missing — the deploy
   should actually fail to boot in that case (fail-closed by design), so a
   "successful" deploy with a FATAL log line means Railway is still serving
   the *previous* release; fix the variable and redeploy.
3. **Migration applied:**
   ```bash
   railway run psql $DATABASE_URL -c "select name from schema_migrations order by name;"
   # expect: 001_init.sql, 002_companion_world.sql
   ```
4. **Real verification flow (mock-mode-off check)** — use a phone number you
   control that's allowed to receive SMS from your Twilio account (verified
   number if still on a Twilio trial):
   ```bash
   curl -X POST https://$URL/api/verify/start \
     -H 'content-type: application/json' \
     -d '{"phone":"+1XXXXXXXXXX"}'
   # expect: {"status":"pending"} with mock NOT present/true — and a real SMS
   # should arrive on the phone within seconds.
   ```
   Then check the code from the SMS:
   ```bash
   curl -X POST https://$URL/api/verify/check \
     -H 'content-type: application/json' \
     -d '{"phone":"+1XXXXXXXXXX","code":"<code from SMS>"}'
   # expect: {"status":"approved","verified":true,"token":"...","expiresAt":"..."}
   # (000000 must NOT work here — if it does, TWILIO_* isn't actually wired
   # and the server silently fell back to mock mode)
   ```
5. **End-to-end profile + welcome SMS**, using the token from the previous
   step:
   ```bash
   curl -X POST https://$URL/api/onboarding/profile \
     -H 'content-type: application/json' \
     -H "Authorization: Bearer <token>" \
     -d '{"goals":["fitness"],"identityWhy":"Because I am ready to change.","companion":"fox","personality":"coach","environment":"japanese_garden","smsPrefs":{"morning":true,"evening":true}}'

   curl -X POST https://$URL/api/sms/welcome \
     -H 'content-type: application/json' \
     -H "Authorization: Bearer <token>" -d '{}'
   # expect: {"status":"queued", ...} with mock NOT present, and a real
   # companion SMS arrives on the phone.
   ```
6. **Rate limiting alive:** hammer `/api/verify/start` 6+ times in a minute
   from the same IP and confirm the 6th returns `429 {"error":"rate_limited"}`
   rather than hanging or 500ing.
7. **Chat, if `ANTHROPIC_API_KEY` is set:** `POST /api/chat` with a valid
   session token and confirm the reply isn't from the small canned pool (i.e.
   it's clearly a real generated response, not one of the few stock lines).

If any of these fail, check the Railway deploy logs first — the server never
crashes silently; startup failures and request errors are logged with enough
context to diagnose (see `kaizi/server/README.md` for the full error-code
reference).

## What this guide does not (and cannot) do for you

This guide describes the steps; it does not and cannot provision Railway
infrastructure, create Twilio/Anthropic accounts, or generate/store secrets on
your behalf — those require **your own** Railway account, Twilio account, and
Anthropic API key, plus you making the judgment call on the actual
`SESSION_SECRET` value and where it's safely stored. See
`kaizi/docs/DEPLOYMENT-READINESS.md` for the single consolidated list of every
credential/account this project needs from you across both the server and the
mobile app.
