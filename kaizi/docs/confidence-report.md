# Kaizi Onboarding — Confidence Report

- **Date:** 2026-07-11
- **Role:** Confidence Engineer (onboarding scope only)
- **Mandate:** turn "should work" into "verified working" by actually running things, not by reading code and inferring. Everything below was executed in this sandbox and the raw output inspected; nothing here is inference from source alone unless explicitly labeled a limitation.

## Verdict

All six checklist items were closed with real evidence. Two real, previously-undetected bugs were found and fixed along the way (a broken mock-mode default in `.env.example`, and a TOCTOU race in `/api/sms/welcome`). Both required security findings (H-2, M-1) are implemented, tested against real Postgres, and verified live. Final state: **server 87 tests (82 always-on + 5 opt-in real-Postgres), app 39 tests, both typecheck clean.**

---

## 1. Real Postgres, not the in-memory test double — VERIFIED

Docker's CLI was present but its daemon wasn't running and image pulls were blocked by the sandbox's egress policy (`docker pull postgres:16` → 403/Forbidden through the proxy). Instead, a **native `postgresql-16` server package was already installed** in the sandbox (`dpkg -l | grep postgres` confirmed `postgresql-16`, not just the client). Used that:

- Started it for real: `pg_ctlcluster 16 main start` → `pg_lsclusters` showed `online`.
- Created the `postgres`/`kaizi` role and `kaizi` database matching the project's default `DATABASE_URL`.
- Ran `npm run migrate` in `kaizi/server` **for real** against it: `Applied migrations: 001_init.sql`. Re-running printed `No pending migrations.` (idempotency confirmed).
- Diffed the live schema (`\d` on every table) against `src/db/migrations/001_init.sql` — exact match: `users`, `onboarding_profiles`, `sms_preferences`, `memory_entries`, `schema_migrations`, all columns/types/defaults/FKs/indexes as written.
- Wired the **full server test suite** against this real Postgres: added `test/db-integration.test.ts` (new, gated behind `TEST_REAL_DB=1` so `npm test` still needs no database) plus a `test:integration` npm script. It builds `createApp()` with the real `createPgDb()` implementation (not the in-memory double) and drives full HTTP requests through it. **5/5 passing**, covering: the full verify→profile→welcome HTTP flow with real rows persisted and read back, `ON DELETE CASCADE` actually removing dependent rows, atomic `markWelcomed` under real concurrent writes, `identityWhy` change-detection via a real second `UPDATE`, and a SQL-injection-shaped `identityWhy` stored as inert literal text.
- The **existing in-memory-backed suite still passes unmodified in spirit** (74 → 82 tests after adversarial additions, still zero Postgres/Twilio dependency) — `npm test` remains safe for CI with no DB.

No environment-imposed limitation here — real Postgres, real schema, real queries, real concurrency, all exercised.

## 2. Android export — VERIFIED

`npx expo export --platform android` (delegated to a subagent, then independently re-run twice more by me after later code changes) completed cleanly every time: exit 0, produced `dist/_expo/static/js/android/*.hbc` (Hermes bytecode, ~2.8MB), `dist/metadata.json` with `fileMetadata.android`, and all 7 font assets. No code changes were needed — it worked on the first attempt. Re-verified again after the auth-token app changes and after adding the app's vitest setup; still clean both times. `npx expo export --platform ios` was also re-run (not just the earlier claim) and is clean.

## 3. Founder guide accuracy — VERIFIED, ONE REAL BUG FOUND AND FIXED

Ran the mock-mode quickstart commands from `docs/founder-guide.md` for real, against the real Postgres above, with a real running server process:

**Bug found:** both `kaizi/README.md` and `kaizi/server/README.md` instruct `cp .env.example .env` as the very first setup step and claim this yields mock mode. But `kaizi/server/.env.example` shipped **non-empty placeholder values** for all four `TWILIO_*` variables (`ACxxx...`, `VAxxx...`, etc.) — so a literal copy put the server into **live Twilio mode with garbage credentials**, not mock mode as documented. Confirmed by actually running it: server printed `Twilio LIVE mode` instead of the documented `TWILIO MOCK MODE` banner. **Fixed** by commenting out the four `TWILIO_*` lines in `.env.example` (`kaizi/server/.env.example`); re-ran `cp .env.example .env` + `npm run dev` and got the correct `TWILIO MOCK MODE` banner. Updated `docs/founder-guide.md` section 6.5 to note the lines now ship commented out.

With that fixed, walked the exact curl sequence end-to-end against the real server + real Postgres:
`GET /health` → `verify/start` → `verify/check` (code `000000`) → `onboarding/profile` → `sms/welcome`. Every response shape matched the docs exactly (`{"ok":true}`, `{"status":"pending","mock":true}`, `{"status":"approved","verified":true,...}`, `{"ok":true,"userId":...,"created":true}`, `{"status":"queued","mock":true,"body":"..."}`), and the data was independently confirmed to have landed in the real Postgres tables via `psql`, and the SMS body was independently confirmed printed in the server's stdout log.

**Quiet-hours behavior** was also tested live (not just read): set `KAIZI_ENFORCE_QUIET_HOURS=true`, confirmed the real server-local clock (23:03) fell inside the documented 21:30–07:30 window, and `sms/welcome` correctly returned `409 {"error":"quiet_hours","detail":"no sends between 21:30 and 07:30"}` exactly as documented.

## 4. Two open security findings — BOTH CLOSED, verified with tests + live curl

### H-2 — no post-verification auth token

Implemented a stateless, HMAC-signed, short-lived (30 min) session token:

- `kaizi/server/src/services/session-token.ts` — `createSessionTokenService`, constant-time signature comparison, expiry embedded in the signed payload.
- `POST /api/verify/check` now issues `{ token, expiresAt }` on approval (`kaizi/server/src/routes/verify.ts`).
- `kaizi/server/src/middleware/auth.ts` — `requireAuth` middleware requires `Authorization: Bearer <token>` on `/api/onboarding/profile` and `/api/sms/welcome`; the phone is derived from the verified token (`req.authPhone`), **never** from the request body. Both schemas (`profileSchema`, `welcomeSchema`) no longer declare a `phone` field — Zod's default unknown-key stripping makes a spoofed `phone` in the body inert, proven by a dedicated test (`profile.test.ts`: "ignores a `phone` field in the body").
- `SESSION_SECRET` env var; if unset, a per-process random secret is generated for dev/CI, and — mirroring the existing H-1 mock-mode guard — the server **refuses to start** with a generated secret when `NODE_ENV=production` (`kaizi/server/src/index.ts`).
- App side: `kaizi/app/src/api/client.ts`, `src/state/OnboardingContext.tsx`, `src/screens/VerifyCodeScreen.tsx`, `src/screens/HandoffScreen.tsx` all updated to carry and send the token.

**Verified with:** new/updated unit tests (401 on missing/malformed/forged-signature/expired tokens; token-vs-body-phone spoofing proven inert; fresh token issued on every successful check) and a live curl walkthrough — unauthenticated `POST /api/onboarding/profile` → `401 {"error":"unauthorized","detail":"missing bearer token"}`; the full authenticated flow succeeding end-to-end against real Postgres.

**Bonus bug found while writing these tests:** `POST /api/sms/welcome`'s "already welcomed?" check and its `welcomed_at` write were two separate non-atomic steps with an `await sms.sendSms(...)` in between — two concurrent requests could both observe `welcomed_at = null` and both trigger a real Twilio send (a genuine double-send bug, not hypothetical — reproduced with a concurrent-request test before the fix). **Fixed:** `Db.markWelcomed` is now an atomic claim-or-fail (`UPDATE ... WHERE welcomed_at IS NULL` in Postgres; an equivalent check-and-set in the in-memory test double), and the route claims *before* rendering/sending. Regression tests: `welcome.test.ts` ("sends exactly once under concurrent double-submit" — asserts exactly one `200`/one `409` and exactly one mock-log send line) and `db-integration.test.ts` ("markWelcomed is atomic" against real concurrent writes to a real Postgres row).

### M-1 — SMS-pumping economics

- Per-phone **daily** cap on `POST /api/verify/start` (default 5/day), independent of the existing per-minute cap (`PhoneRateLimiter` reused with a 24h window).
- A `GlobalSendCircuitBreaker` (default 300/hour) shared across `/api/verify/start` and `/api/sms/welcome` — trips on aggregate volume across **all** phones (not per-phone), logs a loud `console.error` for alerting, returns `503 {"error":"circuit_open"}`.
- As a natural, low-cost extension of the same change: applied the existing per-IP limiter to `/api/onboarding` and `/api/sms` too (closes M-3), and confirmed M-2 (phone-enumeration oracle) is now unreachable by an unauthenticated caller as a free consequence of H-2.
- Also wired the previously-dead `PhoneRateLimiter.sweep()` method into a periodic `unref()`'d interval, partially closing L-3 (unbounded in-memory growth).

**Verified with:** dedicated tests exercising the daily cap and the circuit breaker (including that the breaker is genuinely *global* — trips across distinct phone numbers, not per-phone).

`docs/security-review.md` updated in place: H-2, M-1, M-2, M-3 marked FIXED with implementation notes and file references; L-3 marked PARTIALLY FIXED; the "before production" checklist checkboxes updated to reflect what's actually done vs. still open (CORS, trust-proxy, Redis-backed cross-replica limiter state, GDPR deletion path, etc. remain explicitly open — not silently claimed as done).

## 5. Adversarial edge-case pass — VERIFIED, real bugs fixed

Actually attempted to break the flow, not just imagined ways it might break:

- **Malformed/duplicate requests:** unparseable JSON, wrong `Content-Type`, JSON array instead of object, oversized (>16kb) body — all confirmed live via curl and then codified as regression tests. All fail cleanly (400/413), none 500s.
- **Phone edge-case formatting:** non-ASCII/homoglyph digits (Devanagari, fullwidth), injection-shaped strings, spacing/missing-plus variants — all correctly rejected by the existing E.164 regex; added as explicit regression cases.
- **SQL-injection-shaped `identityWhy`:** sent `Robert'); DROP TABLE users; --` through the real authenticated flow against real Postgres — stored as an inert literal string, `users` table intact. Verified live via curl+psql, then codified as a `db-integration.test.ts` regression test.
- **Concurrent verify attempts:** one right code + one wrong code fired concurrently at the same phone — user ends up correctly and fully verified, no partial state (new test).
- **Double-submitting the profile:** concurrent identical `POST /api/onboarding/profile` calls with the same token — idempotent, no duplicate memory entry (new test).
- **Concurrent welcome double-submit:** the TOCTOU race described under H-2 above — found, fixed, regression-tested against both the in-memory double and real Postgres.
- **Expired/reused tokens:** expired-token test (negative TTL) → `401`; a token signed with a different secret → `401`; the same valid token reused across `profile` then `welcome` in the same session → intentionally allowed (that's the point of a session token) and verified working.

## 6. Final full verification pass

| Package | `npm run typecheck` | `npm test` |
|---|---|---|
| `kaizi/server` | clean (`tsc --noEmit`, 0 errors) | **82/82 passing** (5 files), plus **5/5 passing** in the opt-in real-Postgres suite (`npm run test:integration`, not counted in the default run) — **87 tests total** |
| `kaizi/app` | clean (`tsc --noEmit`, 0 errors) | **39/39 passing** (3 files) — app previously had **no test script at all** (`npm test` would have failed with "missing script"); added a minimal vitest setup covering the pure logic the original QA report specifically flagged as untested (`onboardingReducer`, `isValidE164`, `isIdentityWhyValid`, `PhoneInput.formatNational`/the QA-fixed trunk-zero bug now extracted into a testable `stripTrunkZero`, and the new `api/client.ts` auth-token paths) |

Both `expo export --platform ios` and `--platform android` re-confirmed clean after all app-side changes (auth wiring + new test files).

---

## Accepted limitations (environment-imposed, not resolved here)

- **Real Twilio (live mode) was never exercised with actual credentials.** No Twilio account/credentials are available in this sandbox, and outbound network to Twilio wasn't attempted. Mock mode was exhaustively tested for real; the live-mode code path (`createRealSmsService` in `kaizi/server/src/services/twilio.ts`) is covered only by type-correctness and by mirroring the mock interface exactly — this was already flagged as a pre-production recommendation in the original QA report ("a staging smoke test with real credentials is recommended before production") and remains true.
- **No physical device / Expo Go session.** The app's actual on-device rendering, gestures, and animations were not visually verified in this pass (no phone or simulator display available in this sandbox). What *was* verified for real: both platforms' Metro bundling/export succeed, TypeScript is sound, and the underlying state machine / validation / API-client logic is unit-tested. This is a narrower guarantee than "the UI looks and feels right on a phone" — that remains as it was before this pass, unverified by automation.
- **Docker image pulls are blocked by the sandbox's egress policy** (confirmed via `docker pull postgres:16` → 403/Forbidden through the proxy). This did not block item 1 — a native `postgresql-16` server package was already installed and used instead, and every piece of evidence in section 1 is against that real, running Postgres — but it's noted here because the founder guide's Docker-based quickstart specifically could not be exercised via the literal `docker run postgres:16` one-liner in this sandbox; the equivalent native-Postgres path was used and is documented as an existing "Option B" in the founder guide already.
- **Redis-backed / cross-replica rate-limiter state (L-3), CORS pinning (M-4), GDPR user-deletion path (M-5), and several Low findings (L-1, L-2, L-4 through L-6)** remain open, exactly as scoped by the task (only H-2 and M-1 were required; M-2/M-3 were closed as low-cost natural consequences of the H-2 work, not independently pursued). See the updated `docs/security-review.md` checklist for the current, honest state of each.

## Files touched

- `kaizi/server/.env.example` — commented out placeholder Twilio vars (root-cause fix for the founder-guide bug).
- `kaizi/server/src/services/session-token.ts` — new (H-2).
- `kaizi/server/src/middleware/auth.ts` — new (H-2).
- `kaizi/server/src/middleware/rate-limit.ts` — `PhoneRateLimiter.sweep()`, `GlobalSendCircuitBreaker` (H-2 supporting infra, M-1).
- `kaizi/server/src/config.ts`, `src/index.ts`, `src/app.ts` — session-secret wiring, production guard, daily cap + circuit breaker + auth wiring into routers, sweep interval.
- `kaizi/server/src/routes/verify.ts`, `src/routes/onboarding.ts`, `src/routes/sms.ts` — token issuance, `requireAuth`, phone-from-token, atomic `markWelcomed` claim (TOCTOU fix).
- `kaizi/server/src/schemas.ts` — dropped `phone` from `profileSchema`/`welcomeSchema`.
- `kaizi/server/src/db/types.ts`, `src/db/index.ts`, `test/helpers/memory-db.ts` — atomic `markWelcomed` contract change.
- `kaizi/server/test/*.test.ts` — auth, concurrency, and adversarial regression tests throughout; new `test/db-integration.test.ts`.
- `kaizi/server/package.json` — `test:integration` script.
- `kaizi/app/src/api/client.ts`, `src/state/OnboardingContext.tsx`, `src/screens/VerifyCodeScreen.tsx`, `src/screens/HandoffScreen.tsx` — token plumbing.
- `kaizi/app/src/ui/PhoneInput.tsx` — extracted `stripTrunkZero` for testability.
- `kaizi/app/package.json`, `vitest.config.ts`, `test/stubs/*`, `src/**/*.test.ts` — new app test infrastructure.
- `kaizi/server/README.md`, `kaizi/docs/founder-guide.md`, `kaizi/docs/security-review.md` — updated to match the new contract and mark findings resolved.
