# Kaizi Founder Guide — Run the Onboarding End-to-End

This guide walks you from a blank machine to completing Kaizi's 7-screen
onboarding on your own phone and receiving the companion's first SMS. No prior
backend experience needed — every command is copy-pasteable, and there's a
troubleshooting section at the end for when something doesn't cooperate.

**Two ways to run it:**

| Mode | Twilio account? | What happens with SMS | Good for |
|---|---|---|---|
| **Mock mode** (default) | No | Verification accepts the code `000000`; the "first SMS" is printed in the server terminal instead of sent | First run, demos, development |
| **Real mode** | Yes | A real verification code and a real companion SMS arrive on your phone | The full magic moment |

Start in mock mode — it takes about 10 minutes. Switching to real mode later
is just filling in four values in a `.env` file.

---

## 1. Prerequisites

You need four things installed / available:

1. **Node.js 20 or newer** — download from [nodejs.org](https://nodejs.org)
   (the LTS installer is fine). Check with:

   ```bash
   node -v     # should print v20.x or higher
   ```

   npm comes bundled with Node, so `npm -v` should work too.

2. **PostgreSQL 15+** — the database. Easiest is Docker (next section gives a
   one-liner). If you'd rather install Postgres natively
   ([postgresql.org/download](https://www.postgresql.org/download/)), that
   works too.

3. **Docker Desktop** (only if you take the Docker route for Postgres) —
   [docker.com](https://www.docker.com/products/docker-desktop/).

4. **Expo Go on your phone** — free app, search "Expo Go" in the App Store
   (iOS) or Play Store (Android). This is how you'll run the Kaizi app on a
   real device without building anything.

One more thing that trips people up later, so note it now: **your phone and
your computer must be on the same Wi-Fi network**, and the app will talk to
the server via your computer's local IP address (not `localhost`). More on
that in step 4.

All commands below are run from the repository root.

---

## 2. Step 1 — Postgres and migrations

The server stores the onboarding profile in Postgres. This is needed in
**both** mock and real mode.

### Option A: Docker (recommended)

```bash
docker run -d --name kaizi-pg \
  -e POSTGRES_PASSWORD=kaizi \
  -e POSTGRES_DB=kaizi \
  -p 5432:5432 \
  postgres:16
```

That starts a Postgres 16 container whose connection string is exactly the
server's default (`postgres://postgres:kaizi@localhost:5432/kaizi`), so you
won't need to configure anything.

If you've run this before and Docker complains the name `kaizi-pg` is already
in use, the container already exists — just start it:

```bash
docker start kaizi-pg
```

### Option B: Native Postgres

Create a database named `kaizi` and note your username/password. Then set
`DATABASE_URL` in `kaizi/server/.env` (copy it from `.env.example` first):

```
DATABASE_URL=postgres://YOUR_USER:YOUR_PASSWORD@localhost:5432/kaizi
```

### Apply the migrations

This creates the tables (`users`, `onboarding_profiles`, `sms_preferences`,
`memory_entries`):

```bash
cd kaizi/server
npm install
npm run migrate
```

You should see the migration file(s) listed as applied. Running it again
later is safe — already-applied migrations are skipped.

---

## 3. Step 2 — Start the server (mock mode)

Here's the nice part: **the server needs zero Twilio configuration to run.**
If any Twilio environment variable is missing, it starts in mock mode — no
network calls, no credentials, no crashes.

```bash
cd kaizi/server
npm run dev
```

You should see:

```
[kaizi] TWILIO MOCK MODE — one or more Twilio env vars are missing.
[kaizi]   verify: code "000000" approves; SMS bodies are logged, not sent.
[kaizi] onboarding API listening on http://localhost:4000
```

What mock mode means in practice:

- "Send verification code" succeeds instantly, but no SMS is sent.
- The only code that verifies is **`000000`** (six zeros). Anything else is
  politely rejected, just like a wrong code in real mode.
- The companion's first SMS is rendered from the real personality template
  and **printed in this terminal** instead of being sent.

Quick sanity check from another terminal:

```bash
curl http://localhost:4000/health
# {"ok":true}
```

(Optional: `npm test` runs the server's test suite — it needs neither
Postgres nor Twilio, so it's a good "is my Node setup healthy?" check.)

Leave the server running and open a new terminal for the next step.

---

## 4. Step 3 — Start the app and open it on your phone

### Find your computer's local IP address

Because the app runs on your phone, `localhost` would mean *the phone
itself* — you need your computer's address on the Wi-Fi network:

- **macOS:** `ipconfig getifaddr en0`
- **Windows:** `ipconfig` → look for "IPv4 Address" (e.g. `192.168.1.23`)
- **Linux:** `hostname -I`

It usually looks like `192.168.x.x` or `10.x.x.x`.

### Point the app at the server

```bash
cd kaizi/app
npm install
cp .env.example .env
```

Edit `kaizi/app/.env` and replace `localhost` with your IP:

```
EXPO_PUBLIC_API_URL=http://192.168.1.23:4000
```

> **Heads-up:** if this URL is unset or the server can't be reached, the app
> silently falls back to a built-in mock API (it only logs a console
> warning). The flow will still "work", but nothing reaches your server or
> database. If your walkthrough succeeds suspiciously without the server
> terminal ever logging a request, this is what happened — see
> Troubleshooting.

### Start Expo and open on the phone

```bash
npm start
```

A QR code appears in the terminal. On **iOS**, scan it with the Camera app;
on **Android**, open Expo Go and scan from there. The Kaizi welcome screen
should load on your phone within a few seconds.

(Simulators work too — press `i` for iOS Simulator or `a` for an Android
emulator in the Expo terminal — but the phone experience is the real one.
Note that on a simulator running on the same computer, `localhost` in the
URL is fine.)

---

## 5. Step 4 — Walk the onboarding

Seven screens, strictly linear, with a progress-dot trail at the top from
screen 2 onward. Back is always available (your answers are preserved).

1. **Welcome** — tap **Begin**.
2. **Goals** — pick one to five goals (fitness, skin, business, discipline,
   learning). Your *first* pick matters most: it's woven into the first SMS.
3. **Identity** — write *why* you want this, in your own words (at least 10
   characters). The first sentence of this answer also gets woven into the
   SMS, so write something real.
4. **Companion** — choose who walks with you: wolf pup, fox, lion, dog,
   human, or dragonkin.
5. **Personality** — choose how they speak to you: coach, tough love,
   mentor, supportive, or rival. This selects the SMS template.
6. **Environment** — pick your companion's world (twelve scenes, from
   japanese garden to space colony).
7. **SMS setup** — three sub-screens:
   - **Phone**: enter your real mobile number (it's validated as an
     international-format number, e.g. `+15551234567`).
   - **Verify**: enter the 6-digit code.
     - *Mock mode:* no SMS arrives — type **`000000`**.
     - *Real mode:* type the code Twilio texted you.
   - **Handoff**: the terminal screen. On arrival, your profile is saved to
     Postgres and the companion's first SMS is triggered automatically.

**Where's my first SMS?** In mock mode, look at the server terminal — you'll
see the fully rendered message body logged there, personalized with your
first goal and your "why". In real mode, it arrives on your phone. Either
way: that message *is* the product. The app rests on the handoff screen by
design — the relationship continues over SMS.

To run the flow again with the same phone number, note that the server
remembers it already welcomed you (a repeat send returns a benign
"already welcomed"). Easiest reset: use a different phone number, or wipe the
database (`docker rm -f kaizi-pg`, then redo Step 1).

---

## 6. Going real — Twilio setup

Ready for actual SMS? You need a Twilio account and four values.

### 6.1 Create the account

1. Sign up at [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
   (free trial; no credit card to start, and trial credit covers plenty of
   test messages).
2. Verify your email and your personal phone number during signup.

> **Trial account limits to know about:** a trial account can only send SMS
> **to phone numbers you've verified in the Twilio console** (yours is
> verified from signup — perfect for this guide), and messages carry a short
> "Sent from a Twilio trial account" prefix. Upgrading removes both limits.

### 6.2 Get your Account SID and Auth Token

Both are on the front page of the
[Twilio Console](https://console.twilio.com) under **Account Info**:

- **Account SID** — starts with `AC...`
- **Auth Token** — click to reveal. Treat it like a password.

### 6.3 Create a Verify service (for the verification code)

1. In the console, go to **Explore Products → Verify** (or search "Verify").
2. **Services → Create new Service**. Name it something like `Kaizi` — this
   name appears in the verification SMS.
3. Copy the **Service SID** — starts with `VA...`.

That's it — Verify handles code generation, sending, expiry, and checking.

### 6.4 Get a sending number (for the companion's SMS)

1. In the console, go to **Phone Numbers → Manage → Buy a number** (on
   trial, you'll be offered a free trial number).
2. Make sure the number has the **SMS** capability, and pick one in your
   country if possible.
3. Copy it in international format, e.g. `+15551234567`.

(If you already use a Twilio **Messaging Service**, its `MG...` SID works
here too — the server accepts either.)

### 6.5 Fill in the server `.env`

```bash
cd kaizi/server
cp .env.example .env    # skip if you already have one
```

Edit `kaizi/server/.env`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_real_auth_token
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_MESSAGING_FROM=+15551234567
```

All **four** must be set — if any one is missing, the server stays in mock
mode (that's a safety feature, not a bug). Never commit this file.

### 6.6 Restart and confirm

Stop the server (Ctrl+C) and `npm run dev` again. You should now see:

```
[kaizi] Twilio LIVE mode — Verify + Messaging calls will hit Twilio.
```

Re-run the onboarding on your phone with your real number: the verification
code arrives by SMS, and after the handoff screen, so does your companion's
first message.

---

## 7. Troubleshooting

### "Everything worked but nothing hit my server / database"

The app fell back to its built-in offline mock. Causes, in order of
likelihood:

- `EXPO_PUBLIC_API_URL` still says `localhost` — a phone can't reach your
  computer via `localhost`. Use your computer's LAN IP (Step 3).
- Phone and computer are on **different networks** (e.g. phone on cellular,
  or a guest Wi-Fi). Put both on the same Wi-Fi.
- Your firewall is blocking inbound connections to port 4000. Allow Node, or
  temporarily disable the firewall to confirm.
- You edited `.env` while Expo was running. Env values are baked in at start
  — stop Expo and restart with a cleared cache: `npx expo start -c`.

Quick test from the phone: open `http://YOUR_IP:4000/health` in the phone's
browser. If you don't see `{"ok":true}`, the phone can't reach the server.

### Server won't start / crashes on a request

- **`ECONNREFUSED ... 5432` or "relation \"users\" does not exist"** —
  Postgres isn't running, or migrations weren't applied. `docker start
  kaizi-pg`, then `npm run migrate` in `kaizi/server`.
- **"password authentication failed"** — your `DATABASE_URL` doesn't match
  your Postgres credentials. The default expects user `postgres`, password
  `kaizi`, database `kaizi` (which the Docker one-liner creates).
- **Port 4000 already in use** — something else is on it. Set `PORT=4001`
  in `kaizi/server/.env` and update `EXPO_PUBLIC_API_URL` to match.
- **Port 5432 already in use** (Docker) — you have another Postgres
  running. Either use it (adjust `DATABASE_URL`) or map the container to a
  different port, e.g. `-p 5433:5432` and
  `DATABASE_URL=postgres://postgres:kaizi@localhost:5433/kaizi`.

### Verification problems

- **"That code isn't right" in mock mode** — the only accepted code is
  exactly `000000` (six zeros).
- **No code arrives in real mode** — confirm the server logged
  `Twilio LIVE mode` at startup (if it says MOCK MODE, one of the four
  Twilio vars is missing or misspelled). On a trial account, the destination
  number must be verified in the Twilio console.
- **"rate_limited" / things stop responding after several tries** — the
  verify endpoints allow 5 requests per minute per IP (plus a per-phone
  guard). Wait a minute and try again.

### First SMS problems

- **No SMS after the handoff screen (real mode)** — check the Twilio console
  under **Monitor → Logs → Messaging** for the error:
  - *Error 21608:* trial account texting an unverified number — verify your
    number in the console or upgrade.
  - *Auth errors (20003):* wrong Account SID / Auth Token.
  - Nothing logged at all: the request likely never reached Twilio — check
    the server terminal for errors.
- **"already_welcomed"** — the server sends the first SMS only once per
  phone number, ever. Use a fresh number or reset the database (Step 5).
- **Sends refused at night** — if you set `KAIZI_ENFORCE_QUIET_HOURS=true`,
  the server refuses welcome sends between 21:30 and 07:30 (server-local
  time). It's off by default; leave it off while testing.

### Expo / app problems

- **QR code scan does nothing / can't connect** — same-network issue again.
  As a fallback, tunnel mode works across networks: `npx expo start
  --tunnel` (slower, but reliable).
- **Expo Go says the project's SDK is unsupported** — the app uses Expo SDK
  57; update Expo Go from the app store.
- **`npm install` or `npm start` errors** — check `node -v` is 20+. When in
  doubt, delete `node_modules` and `npm install` again.

Still stuck? The deeper references are `kaizi/server/README.md` (exact API
contract, every error code) and `kaizi/app/README.md` (app structure and
environment behavior).
