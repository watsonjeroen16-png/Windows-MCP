# Kaizi Onboarding Stack — Security Review

**Date:** 2026-07-11 · **Reviewer:** security agent · **Scope:** `kaizi/server/src/` (routes, middleware, services, db) and `kaizi/app/src/api` + phone/verification screens. Defensive review of first-party code.

**Overall posture:** solid for a pre-production build. Parameterized SQL throughout, Zod validation on every body, helmet, a generic error handler that never leaks stacks, per-IP *and* per-phone rate limiting on verify, `.env` gitignored with a placeholder-only `.env.example`, and no hardcoded secrets found. The material gaps are architectural: no session credential after verification, a fail-open mock mode (now guarded), and SMS-pumping economics.

One code change was applied during this review (see H-1). Full server test suite passes after the change: **59/59 tests, 5 files** (`npm test`), `tsc --noEmit` clean.

---

## High

### H-1. Fail-open mock verification: missing Twilio env vars silently accept code `000000` in production — FIXED (guard added)

- `kaizi/server/src/config.ts:33-38` — `mockMode` becomes `true` when *any* Twilio variable is missing.
- `kaizi/server/src/services/twilio.ts:37,48-51` — in mock mode, `checkVerification` approves the fixed code `000000` for **any phone number**.
- `kaizi/server/src/routes/verify.ts:45-52` — an approved check upserts a *verified* user.

A single missing/typo'd env var in a production deploy would let anyone "verify" any phone number with `000000`, mint verified users, and (via `/api/onboarding/profile` + `/api/sms/welcome`) write profiles and trigger SMS for phones they don't own. The only signal was a startup log line.

**Fix applied:** `kaizi/server/src/index.ts:15-23` now refuses to start (`process.exit(1)`) when `mockMode && NODE_ENV === "production"`. Dev/CI behavior is unchanged.
**Remaining recommendation:** set `NODE_ENV=production` in the production process manager (the guard depends on it), and alert on the `[kaizi] TWILIO MOCK MODE` log line as defense in depth.

### H-2. No authentication after verification — profile and welcome endpoints trust a bare phone number

- `kaizi/server/src/routes/onboarding.ts:15-42` — `POST /api/onboarding/profile` accepts any body whose `phone` matches a verified user, then **overwrites** that user's goals, `identityWhy`, companion, personality, environment, and SMS prefs.
- `kaizi/server/src/routes/sms.ts:30-72` — `POST /api/sms/welcome` similarly keyed by phone alone.
- `kaizi/app/src/api/client.ts:65-80` — the client sends no credential; there is none to send.

Verifying a code never yields a session token, so possession of someone's phone *number* (not their phone) is full write access to their profile and companion memory (`insertMemoryEntry`, onboarding.ts:47 — attacker-controlled `identityWhy` lands in the append-only memory that is later echoed into SMS bodies via `renderWelcomeSms`, sms.ts:65-69). `welcomed_at` limits the SMS itself to one send per user, but profile overwrite is unlimited and repeatable.

**Recommended fix (structural):** on `verify/check` approval, issue a short-lived signed token (JWT or random opaque token stored server-side) bound to the phone; require it as `Authorization: Bearer` on `/api/onboarding/profile` and `/api/sms/welcome`, and derive the phone from the token rather than the body. This is the single most important pre-production change after H-1.

---

## Medium

### M-1. SMS-pumping economics: per-IP/per-phone limits don't cap aggregate spend

- `kaizi/server/src/app.ts:58-62` and `kaizi/server/src/middleware/rate-limit.ts:10-18` — `/api/verify/*` is limited to 5/min **per IP** and 5/min **per phone**.

5/min/IP still allows ~7,200 Twilio Verify sends per IP per day, each costing money and each deliverable to attacker-chosen premium-rate numbers (classic SMS pumping / toll fraud). Distinct phones from a botnet are effectively uncapped. The per-phone limiter protects a victim's phone, not the Twilio bill.

**Recommended fix:** add (a) a much tighter per-phone daily cap on `/verify/start` (e.g. 5/day), (b) a global sends-per-hour circuit breaker with alerting, (c) enable Twilio Verify Fraud Guard and restrict Geo Permissions to launch countries, (d) consider a proof-of-work/attestation or CAPTCHA gate if abuse appears.

### M-2. Phone-number enumeration oracle on unauthenticated endpoints

- `kaizi/server/src/routes/onboarding.ts:20-33` — `404 phone_not_found` vs `409 phone_not_verified` vs `200`.
- `kaizi/server/src/routes/sms.ts:35-49` — `404 phone_not_found` vs `409 profile_missing` vs `409 already_welcomed`.

Anyone can probe arbitrary E.164 numbers and learn whether they belong to a Kaizi user and how far through onboarding they got — a PII disclosure in itself (membership in a behavior-change app) and a targeting aid for H-2. The verify endpoints are enumeration-safe (Twilio Verify responds uniformly); these two are not.

**Recommended fix:** after H-2's token auth, these distinctions become harmless (the caller already proved control of the phone). If tokens are deferred, collapse `phone_not_found` into the neighboring 409s or return a uniform 404.

### M-3. Rate limiting absent on `/api/onboarding/profile` and `/api/sms/welcome`

- `kaizi/server/src/app.ts:63-72` — only `/api/verify` is behind a limiter.

`/profile` performs 4+ DB statements per request and appends a `memory_entries` row every time `identityWhy` changes (onboarding.ts:46-48) — an attacker who knows one verified phone (or verified their own) can grow that table without bound, alternating two strings. `/welcome` is a cheap DB probe when it doesn't send.

**Recommended fix:** apply the existing `createVerifyIpRateLimit` (with its own budget, e.g. 10/min) to both routers; one line each in `app.ts`. Kept out of this review's applied changes only because it alters public behavior.

### M-4. CORS is wide open

- `kaizi/server/src/app.ts:43` — `app.use(cors())` sends `Access-Control-Allow-Origin: *` on every response.

For a native-app API this mostly doesn't matter (native fetch ignores CORS), but it means any website can call these unauthenticated endpoints from a visitor's browser — combining with M-1/M-2/H-2 to let a malicious page use its visitors as distributed callers. It also signals no origin policy exists for a future web client.

**Recommended fix:** either drop the `cors` middleware entirely (no browser client exists; same-origin default is then enforced by browsers) or pin `origin` to an explicit allowlist driven by env config.

### M-5. PII at rest: plaintext phone + duplicated `identity_why`, and no deletion path

- `kaizi/server/src/db/migrations/001_init.sql:8,17,32-38` — `users.phone`, `onboarding_profiles.identity_why`, and a second copy of every identity answer in append-only `memory_entries`; no retention or erasure mechanism anywhere in the stack.

The identity answer is sensitive by design ("Because my kids are watching…") and is stored twice, forever, keyed to a plaintext phone number. GDPR (the founder's market includes the EU) requires an erasure path; the `ON DELETE CASCADE` FKs help, but no code can delete a user.

**Recommended fix (structural):** add a delete-user path (even an internal script) exercising the cascades; document retention for `memory_entries`; enable Postgres disk encryption / encrypted backups; consider pgcrypto column encryption for `identity_why` if the threat model includes DB snapshot leaks. Storing the phone in plaintext is acceptable — it's needed to send SMS — but treat DB dumps accordingly.

---

## Low

### L-1. Mock SMS service logs full phone numbers and message bodies

- `kaizi/server/src/services/twilio.ts:45,50,54` — `verify start for ${phone}`, `SMS to ${to}:\n${body}` (body embeds the identity answer).

Dev-only by design, and H-1's guard now prevents mock mode in production, so this is downgraded to Low. Still, logs outlive intentions. Not auto-fixed because `test/welcome.test.ts:53` asserts the full phone appears in the mock log. **Recommended fix:** mask to last 4 digits (`+*******4567`) in mock log lines and update that one test assertion.

### L-2. `trust proxy` is unset — per-IP rate limiting degrades behind a reverse proxy

- `kaizi/server/src/app.ts:39-44` — no `app.set("trust proxy", ...)`; `express-rate-limit` keys on `req.ip`.

Behind the typical production LB/proxy every request shares the proxy's IP, so 5/min becomes a *global* limit (self-DoS) — or, if someone later sets `trust proxy` to `true` carelessly, `X-Forwarded-For` spoofing bypasses the limit entirely. **Recommended fix:** at deploy time set `app.set("trust proxy", 1)` (or the exact hop count) and verify `req.ip` reflects the client.

### L-3. In-memory rate limiter state: unbounded growth and lost on restart

- `kaizi/server/src/middleware/rate-limit.ts:26` — `PhoneRateLimiter.hits` map only prunes a phone's timestamps when that phone recurs; unique phone strings accumulate forever (bounded memory-growth DoS), and both limiters reset on process restart or fall apart with >1 replica.

**Recommended fix:** periodic sweep of stale entries (or an LRU cap) now; a Redis-backed store for both limiters when scaling past one process.

### L-4. Verify responses disclose internals (cosmetic)

- `kaizi/server/src/routes/verify.ts:24,41` — 429 bodies include `detail: "too many attempts for this phone"`, telling an attacker which of the two limiters fired; `verify.ts:52` echoes `mock: result.mock` and the internal `userId` to an unauthenticated caller.
- `kaizi/server/src/schemas.ts:50` — codes of 4–8 digits are accepted; Twilio Verify uses 6. Harmless (Twilio rejects others; mock only accepts `000000`) but tightening to `\d{6}` shrinks the surface.

**Recommended fix:** uniform `{"error":"rate_limited"}` without detail; drop `mock` from client responses; keep `userId` only if the app will use it (it currently doesn't — see `client.ts:98-114`).

### L-5. App: offline fallback fabricates verification success

- `kaizi/app/src/api/client.ts:99-103,117-124,131-138` — when the server is unreachable, `verifyCheck` approves code `000000` client-side and `submitProfile`/`sendWelcomeSms` resolve `ok: true`; `HandoffScreen.tsx:50-71` then shows "Number verified" while nothing was persisted server-side.

No server-side trust derives from this (the server never sees it), so it's a Low: users can silently complete onboarding into a void, and a shipped build retains a magic code path. **Recommended fix:** gate the mock fallback behind `__DEV__` so release builds surface network failures instead.

### L-6. Transport: API base URL is plain HTTP in the example config

- `kaizi/app/.env.example:4` — `EXPO_PUBLIC_API_URL=http://localhost:4000`; nothing enforces HTTPS.

Fine for localhost; in production the app would send phone numbers and identity answers cleartext if misconfigured. **Recommended fix:** reject non-`https` base URLs in release builds (one check in `client.ts`), terminate TLS at the LB.

---

## Verified non-findings

- **SQL injection:** every query in `kaizi/server/src/db/index.ts` and `migrate.ts` uses `$n` parameter binding, including the `text[]` goals array; no string-built SQL anywhere in scope.
- **Error/info leakage:** `kaizi/server/src/middleware/error.ts:24-30` logs stacks server-side only and returns constant `internal_error`/`bad_request` bodies; Twilio SDK exceptions (which carry `status`) map to a generic 400. Zod details (`validate.ts:12-18`) expose only field paths and validation messages.
- **Secrets:** no credentials in source (grep for SID/token/password patterns clean); `.env` is gitignored (`server/.gitignore:3`); `.env.example` contains placeholders only; Twilio config is read exclusively from env (`config.ts:28-31`). The app's `EXPO_PUBLIC_API_URL` is the only client env var and is non-secret by nature.
- **E.164 validation:** enforced with the same anchored regex on both sides — server `schemas.ts:4` (`/^\+[1-9]\d{6,14}$/`, trimmed) on all four endpoints via Zod, app `OnboardingContext.tsx:130` gating the send button; negative cases covered in `test/verify.test.ts:18-32`.
- **Code brute force:** 6-digit code at 5/min/IP + 5/min/phone (and Twilio Verify's own 5-check/10-min lockout in live mode) makes online brute force of ~10^6 codes impractical within a code's 10-minute TTL; the app additionally forces a fresh code after 5 failures (`VerifyCodeScreen.tsx:19,70-72`).
- **Request hardening:** helmet, `x-powered-by` disabled, 16 kb JSON body limit (`app.ts:41-44`); morgan `tiny` logs no request bodies, so phones/identity answers stay out of HTTP logs.

---

## Before production checklist

1. [ ] **Auth token after verification** (H-2): issue on `verify/check` approval; require on `/api/onboarding/profile` and `/api/sms/welcome`; take the phone from the token, not the body.
2. [ ] Set `NODE_ENV=production` in the prod process manager so the new mock-mode guard (H-1, `index.ts:15-23`) is active; alert on any `TWILIO MOCK MODE` log line.
3. [ ] SMS-pumping controls (M-1): per-phone daily cap on `/verify/start`, global send circuit breaker + spend alerts, Twilio Fraud Guard on, Geo Permissions restricted to launch countries.
4. [ ] Rate-limit `/api/onboarding` and `/api/sms` (M-3) and remove the enumeration oracle (M-2 — free once auth lands).
5. [ ] Pin or remove CORS (M-4).
6. [ ] Set `app.set("trust proxy", <hops>)` for the real topology and confirm `req.ip` (L-2); move limiter state to Redis if running >1 replica (L-3).
7. [ ] User deletion path + retention policy for `memory_entries`; encrypted DB storage/backups (M-5).
8. [ ] Gate the app's offline mock behind `__DEV__` and require an `https` API URL in release builds (L-5, L-6).
9. [ ] Tighten the code schema to `\d{6}`, drop `mock`/`detail` from client-facing verify responses (L-4); mask phones in mock logs (L-1).
10. [ ] Confirm `.env` is absent from the repo and CI secrets are injected via the deploy platform, never baked into images.
