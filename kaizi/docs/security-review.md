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

### H-2. No authentication after verification — profile and welcome endpoints trust a bare phone number — FIXED

- `kaizi/server/src/routes/onboarding.ts:15-42` — `POST /api/onboarding/profile` accepted any body whose `phone` matches a verified user, then **overwrote** that user's goals, `identityWhy`, companion, personality, environment, and SMS prefs.
- `kaizi/server/src/routes/sms.ts:30-72` — `POST /api/sms/welcome` similarly keyed by phone alone.
- `kaizi/app/src/api/client.ts:65-80` — the client sent no credential; there was none to send.

Verifying a code never yielded a session token, so possession of someone's phone *number* (not their phone) was full write access to their profile and companion memory.

**Fix applied (2026-07-11, confidence pass):** `POST /api/verify/check` now
issues a short-lived (30 min), HMAC-signed, stateless session token bound to
the phone (`kaizi/server/src/services/session-token.ts`,
`createSessionTokenService`). `POST /api/onboarding/profile` and
`POST /api/sms/welcome` require it as `Authorization: Bearer <token>`
(`kaizi/server/src/middleware/auth.ts`, `requireAuth`) and derive the phone
from the verified token — a `phone` field in the request body, if sent, is
inert (stripped by Zod's default unknown-key handling; the two schemas no
longer declare it, see `schemas.ts`). Missing/malformed/forged/expired
tokens get `401 {"error":"unauthorized"}`. The signing secret is
`SESSION_SECRET`; if unset, a per-process random secret is generated for
dev/CI convenience, and — mirroring the H-1 guard — the server refuses to
start with a generated secret when `NODE_ENV=production`
(`kaizi/server/src/index.ts`).

The app (`kaizi/app/src/api/client.ts`, `src/state/OnboardingContext.tsx`,
`src/screens/VerifyCodeScreen.tsx`, `src/screens/HandoffScreen.tsx`) stores
the token on successful verification and sends it on both endpoints.

Verified with: new/updated unit tests (`test/profile.test.ts`,
`test/welcome.test.ts`, `test/verify.test.ts`, `test/e2e.onboarding.test.ts`
— 401 on missing/malformed/forged/expired tokens, a spoofed `phone` field in
the body is proven inert, tokens verified independently signed/expired) and
a live curl walkthrough against the real server + real Postgres (see
`docs/confidence-report.md`).

**Bonus fix found while testing this (TOCTOU race in `/api/sms/welcome`):**
the "already welcomed?" check and the `welcomed_at` write were two separate
non-atomic steps with an `await sms.sendSms(...)` in between, so two
concurrent requests could both observe `welcomed_at = null` and both trigger
a real Twilio send. `Db.markWelcomed` is now an atomic claim-or-fail
(`UPDATE ... WHERE welcomed_at IS NULL` in Postgres, an equivalent
check-and-set in the in-memory test double); the route claims *before*
rendering/sending, and the loser gets `409 already_welcomed` without ever
sending. Regression test: `test/welcome.test.ts` "sends exactly once under
concurrent double-submit", and `test/db-integration.test.ts` "markWelcomed
is atomic" against real Postgres.

---

## Medium

### M-1. SMS-pumping economics: per-IP/per-phone limits don't cap aggregate spend — FIXED (a, b); (c), (d) remain operational follow-ups

- `kaizi/server/src/app.ts:58-62` and `kaizi/server/src/middleware/rate-limit.ts:10-18` — `/api/verify/*` was limited to 5/min **per IP** and 5/min **per phone**.

5/min/IP still allowed ~7,200 Twilio Verify sends per IP per day, each costing money and each deliverable to attacker-chosen premium-rate numbers (classic SMS pumping / toll fraud). Distinct phones from a botnet were effectively uncapped. The per-phone limiter protected a victim's phone, not the Twilio bill.

**Fix applied (2026-07-11, confidence pass):**
(a) `POST /api/verify/start` now also enforces a per-phone **daily** cap
(default 5/day, `PhoneRateLimiter` reused with a 24h window — see
`kaizi/server/src/app.ts`, `dailyPhoneLimiter`).
(b) A `GlobalSendCircuitBreaker` (`kaizi/server/src/middleware/rate-limit.ts`)
caps aggregate outbound sends (default 300/hour) across **all** phones,
shared between `/api/verify/start` and `/api/sms/welcome`; tripping it logs
a loud `console.error` (`GLOBAL SEND CIRCUIT BREAKER OPEN`) for alerting and
returns `503 {"error":"circuit_open"}`. Verified with
`test/verify.test.ts` ("returns 429 after exceeding the per-phone DAILY
cap", "trips the global send circuit breaker ... across distinct phones").
(c) and (d) — Twilio Verify Fraud Guard, Geo Permissions, and any
CAPTCHA/attestation gate — are operational/account-console configuration
and a possible future dependency addition respectively; out of scope for
this code-level pass, left as follow-ups in the checklist below.

As a related, low-cost hardening while touching this code: M-3 below
(rate-limiting `/api/onboarding` and `/api/sms`) was also applied, since
requiring auth (H-2) plus a one-line per-IP limiter on those two routers was
a natural, minimal extension of the same change.

### M-2. Phone-number enumeration oracle on unauthenticated endpoints — CLOSED (by H-2)

- `kaizi/server/src/routes/onboarding.ts:20-33` — `404 phone_not_found` vs `409 phone_not_verified` vs `200`.
- `kaizi/server/src/routes/sms.ts:35-49` — `404 phone_not_found` vs `409 profile_missing` vs `409 already_welcomed`.

Anyone could probe arbitrary E.164 numbers and learn whether they belong to a Kaizi user and how far through onboarding they got. The verify endpoints were already enumeration-safe (Twilio Verify responds uniformly); these two were not.

**Resolved by H-2:** both endpoints now require a valid session token proving
control of the phone before any of these distinctions are reachable —
without one, every caller gets a uniform `401 unauthorized` regardless of
whether the phone exists. The status-code distinctions themselves are
unchanged (still useful signal for a caller who legitimately owns the
token), but they're no longer reachable by an unauthenticated prober.

### M-3. Rate limiting absent on `/api/onboarding/profile` and `/api/sms/welcome` — FIXED

- `kaizi/server/src/app.ts:63-72` — only `/api/verify` was behind a limiter.

`/profile` performs 4+ DB statements per request and appends a `memory_entries` row every time `identityWhy` changes (onboarding.ts:46-48) — an attacker who knew one verified phone (or verified their own) could grow that table without bound, alternating two strings. `/welcome` was a cheap DB probe when it didn't send.

**Fix applied (2026-07-11, confidence pass):** both routers now sit behind
their own `createVerifyIpRateLimit` instance (5/min per IP, same budget as
`/api/verify`, independently tracked — see `kaizi/server/src/app.ts`). Now
layered under H-2's auth requirement, so this is defense in depth against a
caller with a valid token hammering their own endpoints, not the primary
control.

### M-4. CORS is wide open — FIXED

- `kaizi/server/src/app.ts:43` — `app.use(cors())` sent `Access-Control-Allow-Origin: *` on every response.

For a native-app API this mostly doesn't matter (native fetch ignores CORS), but it means any website could call these unauthenticated endpoints from a visitor's browser — combining with M-1/M-2/H-2 to let a malicious page use its visitors as distributed callers.

**Fix applied (2026-07-12, EP pass):** the `cors` middleware and its import were
removed from `kaizi/server/src/app.ts` entirely — no browser client exists (the
only client is the native Expo app, and native `fetch` ignores CORS), so the
header served no purpose. Verified no test asserted on CORS headers before
removing it. (The `cors` npm dependency itself is left in `package.json`; it's
still used by the standalone Companion World test harness,
`test/world/helpers/make-world-app.ts`.)

### M-5. PII at rest: plaintext phone + duplicated `identity_why`, and no deletion path

- `kaizi/server/src/db/migrations/001_init.sql:8,17,32-38` — `users.phone`, `onboarding_profiles.identity_why`, and a second copy of every identity answer in append-only `memory_entries`; no retention or erasure mechanism anywhere in the stack.

The identity answer is sensitive by design ("Because my kids are watching…") and is stored twice, forever, keyed to a plaintext phone number. GDPR (the founder's market includes the EU) requires an erasure path; the `ON DELETE CASCADE` FKs help, but no code can delete a user.

**Recommended fix (structural):** add a delete-user path (even an internal script) exercising the cascades; document retention for `memory_entries`; enable Postgres disk encryption / encrypted backups; consider pgcrypto column encryption for `identity_why` if the threat model includes DB snapshot leaks. Storing the phone in plaintext is acceptable — it's needed to send SMS — but treat DB dumps accordingly.

---

## Low

### L-1. Mock SMS service logs full phone numbers and message bodies — FIXED (phone masking)

- `kaizi/server/src/services/twilio.ts:45,50,54` — `verify start for ${phone}`, `SMS to ${to}:\n${body}` (body embeds the identity answer).

Dev-only by design, and H-1's guard now prevents mock mode in production, so this is downgraded to Low. Still, logs outlive intentions.

**Fix applied (2026-07-12, EP pass):** added `maskPhone()` (keep the leading
`+` and last 4 digits, mask the rest — e.g. `+*******4567`) and applied it to
all three mock-mode log lines in `kaizi/server/src/services/twilio.ts`.
`test/welcome.test.ts`'s assertion was updated to check for the masked phone
and assert the full phone no longer appears in the log; server test suite
still 100% green. **Not addressed:** the SMS body itself (which embeds the
`identityWhy` answer) is still logged in full in mock mode — masking the body
would defeat the point of a dev-mode log (verifying the rendered copy), so
this is left as designed; the message-body-in-logs exposure is bounded to
dev-only mock mode by the same H-1 production guard.

### L-2. `trust proxy` is unset — per-IP rate limiting degrades behind a reverse proxy — FIXED

- `kaizi/server/src/app.ts` — no `app.set("trust proxy", ...)`; `express-rate-limit` keys on `req.ip`.

Behind the typical production LB/proxy every request shares the proxy's IP, so 5/min becomes a *global* limit (self-DoS) — or, if someone later sets `trust proxy` to `true` carelessly, `X-Forwarded-For` spoofing bypasses the limit entirely.

**Fix applied (2026-07-12, EP deploy-audit pass):** `createApp()` now calls `app.set("trust proxy", 1)` when `NODE_ENV === "production"` — trusting exactly the one hop that Railway (the PaaS `kaizi/server/DEPLOYMENT.md` targets) and every mainstream single-LB PaaS puts in front of the app, not `true` (which would trust an attacker-supplied `X-Forwarded-For` on any topology with zero real proxies in front). Off in dev/test, so local `req.ip` behavior and existing rate-limit tests are unchanged. Verified with new `test/trust-proxy.test.ts` (asserts `app.get("trust proxy")` is `1` under `NODE_ENV=production` and falsy otherwise) plus the full suite (122/122 unit + 5/5 real-Postgres integration) still green. **Residual note:** if the app is ever deployed behind a *different* topology (e.g. Cloudflare in front of Railway, or >1 proxy hop), the hop count must be revisited — this fix is correct for the single-hop Railway target this project actually documents, not a universal guarantee for every possible future topology.

### L-3. In-memory rate limiter state: unbounded growth and lost on restart — PARTIALLY FIXED

- `kaizi/server/src/middleware/rate-limit.ts:26` — `PhoneRateLimiter.hits` map only pruned a phone's timestamps when that phone recurred; unique phone strings accumulated forever (bounded memory-growth DoS), and both limiters reset on process restart or fall apart with >1 replica.

**Fix applied (2026-07-11, confidence pass):** `PhoneRateLimiter.sweep()`
drops phones with no hits inside the window; `createApp()` now runs it
every 10 minutes for both the per-minute and per-phone-daily limiters
(`kaizi/server/src/app.ts`, `.unref()`'d so it never keeps a process or test
run alive). **Still open:** state is still per-process and lost on
restart/reset across replicas — a Redis-backed store is the real fix once
scaling past one process, left as a follow-up since it's a new dependency
and out of proportion for the current MVP.

### L-4. Verify responses disclose internals (cosmetic) — FIXED

- `kaizi/server/src/routes/verify.ts:24,41` — 429 bodies included `detail: "too many attempts for this phone"`, telling an attacker which of the two limiters fired; `verify.ts:52` echoed `mock: result.mock` and the internal `userId` to an unauthenticated caller.
- `kaizi/server/src/schemas.ts:50` — codes of 4–8 digits were accepted; Twilio Verify uses 6.

**Fix applied (2026-07-12, EP pass):** both `/api/verify/start` 429 bodies and
the `/api/verify/check` 429 body now return the uniform
`{"error":"rate_limited"}` with no `detail`; `/api/verify/check`'s 200
response no longer includes `userId` or `mock` (confirmed via
`app/src/api/client.ts`'s `verifyCheck` that neither field is read by the
app); the code schema in `kaizi/server/src/schemas.ts` was tightened from
`/^\d{4,8}$/` to `/^\d{6}$/`. Verified no test asserted on any removed field
before editing (`grep` across `test/*.ts`); `README.md`'s example curl output
updated to match. Server test suite still 100% green.

### L-5. App: offline fallback fabricates verification success — FIXED

- `kaizi/app/src/api/client.ts:99-103,117-124,131-138` — when the server is unreachable, `verifyCheck` approved code `000000` client-side and `submitProfile`/`sendWelcomeSms` resolved `ok: true`; `HandoffScreen.tsx:50-71` then showed "Number verified" while nothing was persisted server-side.

No server-side trust derives from this (the server never sees it), so it was a Low: users could silently complete onboarding into a void, and a shipped build retained a magic code path.

**Fix applied (2026-07-12, EP pass):** added `isReleaseBuild` (`typeof __DEV__ !== "undefined" && __DEV__ === false` — `__DEV__` is the standard Metro-injected global, `false` only in a compiled release bundle) to `kaizi/app/src/api/client.ts`. All four exported functions (`verifyStart`, `verifyCheck`, `submitProfile`, `sendWelcomeSms`) now check it when the server is unreachable: in a release build they return a real `{ok: false, offline: false, ...}` instead of fabricating success; dev/simulator builds and the vitest test environment (where `__DEV__` is unset, treated as non-release) are unaffected — zero existing test behavior changed. Verified: `npm run typecheck` clean, 4 new tests added (`client.test.ts` — unreachable server, network-down fetch throw, a real https response still working normally), 43/43 app tests passing, and both `npx expo export --platform ios` and `--platform android` still bundle cleanly with the change (Metro correctly resolves `__DEV__`).

### L-6. Transport: API base URL is plain HTTP in the example config — FIXED

- `kaizi/app/.env.example:4` — `EXPO_PUBLIC_API_URL=http://localhost:4000`; nothing enforced HTTPS.

Fine for localhost; in production the app would send phone numbers and identity answers cleartext if misconfigured.

**Fix applied (2026-07-12, EP pass):** added `isSafeBaseUrl()` to `client.ts`, sharing the same `isReleaseBuild` gate as L-5 — in a release build, a base URL that doesn't start with `https://` is refused (treated as unreachable) before any request is sent, never a plain-HTTP request. `.env.example` itself is intentionally left as `http://localhost:4000` (correct for local dev — this only matters for a release build's real API URL, which is an env-specific deploy concern, not something `.env.example` should dictate). Verified with a dedicated test asserting `fetch` is never called for a non-https URL in a release build. TLS termination at the load balancer is unchanged as a deploy-time operational item, not a code concern.

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

1. [x] **Auth token after verification** (H-2): issue on `verify/check` approval; require on `/api/onboarding/profile` and `/api/sms/welcome`; take the phone from the token, not the body. **Done 2026-07-11** — see H-2 above.
2. [ ] Set `NODE_ENV=production` in the prod process manager so the mock-mode guard (H-1, `index.ts:15-23`) and the new `SESSION_SECRET` guard (H-2, same file) are active; alert on any `TWILIO MOCK MODE` or `SESSION_SECRET not set` log line. Also set a real `SESSION_SECRET` — the auto-generated dev fallback invalidates every session on restart and can't be shared across replicas. **Accepted limitation for this environment** — both guards are already implemented and verified in code (they correctly refuse to start under `NODE_ENV=production` with the unsafe condition present); actually setting `NODE_ENV`/`SESSION_SECRET` is a deploy-time environment-variable action on the real production host, which doesn't exist in this dev sandbox.
3. [x] SMS-pumping controls (M-1): per-phone daily cap on `/verify/start` and a global send circuit breaker + logged alert are **done 2026-07-11**. Twilio Fraud Guard on and Geo Permissions restricted to launch countries remain operational (Twilio console) follow-ups, not code changes.
4. [x] Rate-limit `/api/onboarding` and `/api/sms` (M-3) and remove the enumeration oracle (M-2) — **both done 2026-07-11**, the latter as a free consequence of H-2.
5. [x] Pin or remove CORS (M-4). **Done 2026-07-12** — `cors` middleware removed entirely.
6. [x] Set `app.set("trust proxy", <hops>)` for the real topology and confirm `req.ip` (L-2); move limiter state to Redis if running >1 replica (L-3 — in-process sweep landed 2026-07-11, cross-replica store is still open). **Done 2026-07-12** — `createApp()` sets `trust proxy` to `1` automatically under `NODE_ENV=production`, correct for the single-hop Railway topology `kaizi/server/DEPLOYMENT.md` targets; revisit the hop count if the real topology ever changes (e.g. an extra CDN/proxy layer in front of Railway). L-3's cross-replica store remains open — genuine scope item, not this pass's concern.
7. [ ] User deletion path + retention policy for `memory_entries`; encrypted DB storage/backups (M-5). **Accepted limitation** — this is a new feature (an admin/internal deletion endpoint plus a retention policy decision), not a bug fix; out of scope for a hardening pass per the project's scope discipline. Left as a recommended follow-up for the founder/lead to prioritize.
8. [x] Gate the app's offline mock behind `__DEV__` and require an `https` API URL in release builds (L-5, L-6). **Done 2026-07-12.**
9. [x] Tighten the code schema to `\d{6}`, drop `mock`/`detail` from client-facing verify responses (L-4); mask phones in mock logs (L-1). **Done 2026-07-12.**
10. [x] Confirm `.env` is absent from the repo and CI secrets are injected via the deploy platform, never baked into images. **Verified 2026-07-12** — a local `kaizi/server/.env` exists in this dev sandbox but contains no real secrets (just `PORT`/`DATABASE_URL`/`KAIZI_ENFORCE_QUIET_HOURS`, Twilio lines commented out) and is correctly gitignored (`server/.gitignore:3`); the actual "never committed to the real repo, secrets injected at deploy" practice is a CI/deploy-pipeline policy outside this codebase's ability to enforce or verify.

### Resolved 2026-07-12 (EP pass)

M-4 (CORS removed), L-4 (uniform rate-limit body, dropped `mock`/`userId` from
verify/check, code schema tightened to 6 digits), L-1 (phone masking in mock
logs), L-5 (release builds no longer fabricate verification success when the
server is unreachable), L-6 (release builds refuse a non-https base URL). See
each finding above for implementation notes; all verified with the existing
server + app test suites plus new coverage (`test/world-wiring.test.ts` on the
server, 4 new tests in `app/src/api/client.test.ts`), a live curl smoke test
against real Postgres, and both `expo export --platform ios`/`android`
confirming the release-build code path still bundles cleanly.

**Remaining genuinely open items:** #2 (set `NODE_ENV=production` at deploy —
operational, though `kaizi/server/DEPLOYMENT.md` §3 now documents exactly how),
#7 (user deletion path — a new feature, out of scope for a hardening pass).
#6 (`trust proxy`) was closed in the 2026-07-12 deploy-audit pass — see L-2
above. Both remaining items are explicitly accepted environment/scope
limitations, not oversights — see each item above for the specific reasoning.

### Resolved 2026-07-12 (EP deploy-audit pass)

L-2 (`trust proxy` unset). Found while auditing the Deployment Engineer's
completed work: the deploy guides never mentioned it and the checklist item
was sitting as an "accepted limitation" that was actually fixable in code
once a concrete deploy target (Railway, single proxy hop) existed. Fixed in
`kaizi/server/src/app.ts` (`app.set("trust proxy", 1)` under
`NODE_ENV=production`), covered by new `test/trust-proxy.test.ts`. Full
re-verification after the fix: server typecheck clean, 122/122 unit tests +
5/5 real-Postgres integration tests, `npm run build` + a manual Dockerfile-step
replication booting the compiled server against the live Postgres in this
sandbox, both still green.

### Resolved in this pass (2026-07-11, confidence engineering review)

H-2 (auth token), M-1 (a/b — SMS-pumping daily cap + circuit breaker), M-2
(enumeration oracle, closed as a consequence of H-2), M-3 (rate limiting on
onboarding/sms), and a partial L-3 (in-process sweep of stale rate-limit
entries). A previously-undocumented TOCTOU race in `/api/sms/welcome` (two
concurrent requests could both trigger a real Twilio send) was found while
writing tests for H-2 and fixed alongside it — see H-2 above and
`docs/confidence-report.md` for full verification evidence (tests + live
curl walkthroughs against real Postgres).
