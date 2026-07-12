# EP Final Report — Quality Sweep

**Agent:** ep · **Scope:** whole `kaizi/` project · **Date:** 2026-07-12

## Verdict

Both packages typecheck and test 100% clean. Every finding in `qa-report.md`
and `security-review.md` is either resolved (with implementation notes and
evidence) or explicitly marked as an accepted environment/scope limitation
with reasoning. No orphaned `TODO`/`FIXME`/`XXX`/`HACK` comments anywhere in
the tree. Docs match the current state of the code. A full fresh pass through
the checklist found nothing new to fix.

## Final verification evidence

- **Server:** `npm run typecheck` clean; `npm test` — **120/120 passing** (5
  skipped by design, run separately as real-Postgres integration tests);
  `TEST_REAL_DB=1 ... npx vitest run test/db-integration.test.ts` — **5/5
  passing** against real Postgres with both `001_init.sql` and
  `002_companion_world.sql` applied and idempotent.
- **App:** `npm run typecheck` clean; `npm test` — **43/43 passing**;
  `npx expo export --platform ios` and `--platform android` both bundle
  cleanly (2.8MB Hermes bytecode each, no errors).
- Live curl smoke test of all four new Companion World endpoints
  (`/api/intentions`, `/api/chat`, `/api/customization`, `/api/journal`)
  against the real running server + real Postgres, including a real mock-mode
  companion chat reply and a 401 on an unauthenticated request.

## What I found and fixed

### 1. Applied `PENDING_INTEGRATION.md` (backend2's handoff)

backend2 (the Companion World Backend Engineer) built the Intentions, chat,
customization, and journal backend as new files only, and left exact wiring
instructions for `src/app.ts`, `src/index.ts`, and `.env.example` to avoid
racing the Confidence Engineer on those shared files. Once both agents
reported done, I applied every step by hand:

- Mounted the four new routers in `app.ts` with `WorldDb` threaded through.
- Constructed `createPgWorldDb(config.databaseUrl)` in `index.ts` and passed
  it into `createApp(...)`.
- Added the `ANTHROPIC_API_KEY` documentation line to `server/.env.example`.
- Updated `test/helpers/make-app.ts` and `test/db-integration.test.ts` to
  supply the now-required `worldDb` option (backend2's `PENDING_INTEGRATION.md`
  didn't need to cover this since it predates the wiring, but adding
  `worldDb` to `CreateAppOptions` broke both test-app factories' typecheck).
- Deleted `PENDING_INTEGRATION.md` once every step was applied and verified.

### 2. Fresh-reviewer pass over backend2's new code — found and fixed a real bug

Read every new file (4 routes, `claude-chat.ts`, `world-memory.ts`,
`world-pg.ts`, `world-types.ts`, the `002_companion_world.sql` migration).
All SQL is parameterized (no injection risk), input validation is thorough
(Zod on every body), `keepIntention` uses the same atomic
claim-or-fail pattern as `markWelcomed` (no TOCTOU race), and the mock-mode
Claude fallback works correctly when `ANTHROPIC_API_KEY` is unset (verified
live).

**Real bug found and fixed:** `index.ts`'s shutdown handler only closed the
onboarding `db`, never the new `worldDb` Postgres pool — a SIGTERM/SIGINT
would `process.exit(0)` with the world pool still open. Fixed to
`Promise.all([db.close(), worldDb.close()])`.

**Hardening gap found and fixed:** none of the four new routes had any rate
limiting. `/api/chat` calls the real Claude API per message once
`ANTHROPIC_API_KEY` is set — the same real-money abuse vector M-1 already
guards against for Twilio. Added a shared per-IP limiter (30/min default,
configurable via `worldRateLimit`) across all four routes.

**Regression coverage added:** `test/world-wiring.test.ts` (6 tests) — proves
the four routers are actually reachable through the real `createApp()` (not
just backend2's standalone test harness), require auth, and are rate-limited.
This exists because nothing previously exercised the *wired* app with the
world routes attached — only the isolated test harness and my one-off manual
curl smoke test did, neither of which is regression-proof.

### 3. `security-review.md` — every finding resolved or explicitly accepted

| Finding | Status |
|---|---|
| H-1 (fail-open mock verification) | Already fixed (confidence pass) |
| H-2 (no auth after verification) | Already fixed (confidence pass) |
| M-1 (SMS-pumping economics) | Already fixed (confidence pass) |
| M-2 (enumeration oracle) | Already fixed (closed by H-2) |
| M-3 (rate limiting on onboarding/sms) | Already fixed (confidence pass) |
| **M-4 (CORS wide open)** | **Fixed this pass** — `cors()` middleware removed entirely (no browser client exists) |
| M-5 (PII retention / no deletion path) | **Accepted limitation** — a new feature (admin deletion endpoint + retention policy), not a bug fix |
| **L-1 (phone numbers logged unmasked)** | **Fixed this pass** — `maskPhone()` applied to all three mock-log lines |
| L-2 (`trust proxy` unset) | **Accepted limitation** — depends on the real production LB topology, which doesn't exist in this dev sandbox |
| L-3 (rate-limiter memory growth) | Partially fixed (confidence pass: in-process sweep); cross-replica store remains a genuine follow-up |
| **L-4 (verify responses disclose internals)** | **Fixed this pass** — uniform 429 body, dropped `mock`/`userId` from `verify/check`, code schema tightened to exactly 6 digits |
| **L-5 (app offline mock fabricates success)** | **Fixed this pass** — gated behind `isReleaseBuild` (real `__DEV__ === false`); zero dev/test behavior change |
| **L-6 (plain-HTTP base URL accepted)** | **Fixed this pass** — release builds refuse a non-`https` base URL before sending any request |

Every item in the "Before production checklist" is now `[x]` except three,
each explicitly annotated as an accepted environment/scope limitation:
setting `NODE_ENV=production`/`SESSION_SECRET` at actual deploy time (#2),
`trust proxy` hop count for the real LB topology (#6), and the user-deletion
feature (#7).

### 4. `qa-report.md` — every finding resolved or explicitly accepted

Marked resolved: app-side test infrastructure (confidence pass) and the
Cyrillic-character typo in `onboarding-spec.md`'s Forest Village gradient
(fixed this pass — `#14261А` → `#14261A`). The remaining three items (no lint
tooling, regex-only phone validation vs. libphonenumber, no AsyncStorage
persistence) and the newly-reconsidered `HandoffScreen` fire-and-forget item
are all reframed as explicit accepted limitations with reasoning — each is a
new-infrastructure or UX-design decision, not a mechanical bug, and forcing
one through without a deliberate pass risked a regression on a screen QA
already signed off as GO.

### 5. Docs consistency audit

Updated to describe the current, post-Companion-World-wiring state of the
code (previously all still described onboarding-only, pre-wiring, or
pre-dated the phase entirely):

- `kaizi/README.md` — two-phase description, monorepo layout, design doc
  index, app test command.
- `kaizi/docs/architecture.md` — corrected the stale "no code exists for
  Companion World and none should be added" line (a directive *had* since
  been given — `world-build-plan.md`); added the new backend surface note.
- `kaizi/server/README.md` — documented all four new endpoint groups
  (request/response shape, auth, rate limits), the `ANTHROPIC_API_KEY` env
  var, the two migrations, and the `WorldDb`/`Db` interface split.
  Corrected the `verify/check` example response to match the now-trimmed
  body.
- `kaizi/app/README.md` — documented the release-build `__DEV__` gate.
- `kaizi/docs/design/world-build-plan.md` — status updated from "queued,
  waiting on Confidence Engineer" to "backend surface built and wired";
  corrected the sketched `/api/chat/message` path to the actual `/api/chat`;
  sequencing checklist updated to reflect what's actually done vs. still
  queued (mobile screens).
- `kaizi/docs/design/world-spec.md` — status section updated to reflect the
  motion pass being complete and the backend surface being wired, while
  flagging the two genuine spec gaps (below).

### 6. Genuine plan gaps flagged (not built) — `kaizi/docs/ep-notes.md`

Per the scope-discipline instruction, I did not build anything beyond what
`world-build-plan.md` scopes. I found two genuine gaps in the *plan itself*
(not bugs) and documented them instead of building them unprompted:

1. **No backend surface for "current companion activity."**
   `world-spec.md` §5 (SMS mirrors the living world) explicitly requires the
   backend to track/derive this so SMS and the app don't contradict each
   other — nothing in the plan or the actual migration covers it.
2. **No persisted world-state/streak-milestone table.**
   `world-spec.md` §6 requires the lantern/azalea/koi/maple milestones to be
   "cumulative and permanent (never reverse on a missed day)" — computing a
   streak purely from `intentions` history would let it regress after a
   broken streak resumes, contradicting the spec. Needs a small ratchet
   (e.g. `highest_streak_milestone_reached`) that isn't in the plan yet.

## Accepted limitations (honest, not swept under the rug)

- **`security-review.md` #2, #6:** deploy-time environment configuration
  (`NODE_ENV=production`, `SESSION_SECRET`, `trust proxy` hop count) —
  the guards are implemented and verified in code; setting the actual values
  requires a real production host/LB that doesn't exist in this dev sandbox.
- **`security-review.md` #7 / M-5:** user deletion path + retention policy —
  a genuine new feature (admin endpoint + a retention-policy decision that
  isn't mine to make), out of scope for a hardening pass.
- **`qa-report.md` #1:** no lint tooling — adding a full lint toolchain risks
  a disproportionate scope increase (config + likely a first triage pass
  across the existing codebase) for a low-severity recommendation.
- **`qa-report.md` #3, #5:** libphonenumber and AsyncStorage — both require
  adding a new dependency outside the approved list; acceptable stand-ins are
  already in place and documented as deviations.
- **`qa-report.md` #4 (HandoffScreen fire-and-forget):** a UX/retry-flow
  redesign, not a mechanical fix, on a screen QA already signed off as GO —
  left for a deliberate design pass rather than patched here. (Its underlying
  API-honesty concern is separately closed by L-5: a release build's
  `submitProfile`/`sendWelcomeSms` now return a real `ok: false` on failure
  instead of a fabricated success — the screen just doesn't yet *display*
  that failure state.)
- **Environment-imposed (inherited from the confidence pass, still true):**
  no real Twilio or Anthropic credentials in this sandbox (both mock modes
  are exercised instead and verified working), no physical device/simulator
  display for a true on-device run, Docker image pulls blocked by egress
  policy (native Postgres substituted successfully for all Postgres-backed
  verification).

## One thing worth flagging, not fixing

Commit `60e3c82` ("Kaizi app: add Companion World API client methods
(intentions, chat, customization, journal)") has a commit message that
doesn't match its actual diff — the diff is my L-5/L-6 client.ts work, not
new API client methods for the Companion World endpoints. I confirmed via
`git log --all -p` that no such client methods exist anywhere in this
repository's history — nothing was lost, the message was simply mismatched
(likely a lead-side auto-commit bookkeeping artifact from message queuing
across concurrent agent work). I did not attempt to rewrite history — that's
outside my scope and the CLAUDE.md instruction is explicit that the session
lead owns commits. Flagging it here so it isn't mysterious later: **the app
does not yet have any client methods for the Companion World endpoints** —
that work is still fully queued, matching what `world-build-plan.md` and
`ep-notes.md` already say.

## Files touched this session (non-exhaustive, see `git log`)

Server: `src/app.ts`, `src/index.ts`, `src/schemas.ts`, `src/routes/verify.ts`,
`src/services/twilio.ts`, `.env.example`, `test/helpers/make-app.ts`,
`test/db-integration.test.ts`, `test/welcome.test.ts`, new
`test/world-wiring.test.ts`, `README.md`.
App: `src/api/client.ts`, `src/api/client.test.ts`, `README.md`.
Docs: `README.md`, `docs/architecture.md`, `docs/qa-report.md`,
`docs/security-review.md`, `docs/design/onboarding-spec.md`,
`docs/design/world-build-plan.md`, `docs/design/world-spec.md`, new
`docs/ep-notes.md`, this file.
