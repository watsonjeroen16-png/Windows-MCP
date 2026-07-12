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

---

# EP Final Report — v3 Final Sweep (Quiz + World/You Restructure)

**Agent:** ep · **Scope:** whole `kaizi/` project, focused on the v3 personalization quiz
+ World/You restructure that backend2, mobile, and the Confidence Engineer just shipped
· **Date:** 2026-07-12

## Verdict

This is the final sweep before the v3 phase (onboarding quiz + World/You restructure) is
reported to the founder as complete. Independently re-verified every number the
Confidence Engineer reported — all matched exactly, nothing re-trusted blindly. Chased
down all five flagged gaps to a real decision (two fixed, three assessed and confirmed
non-issues with written reasoning). Found and fixed one real security/cost gap during the
scoped security pass that nobody had flagged yet. Swept every design doc for staleness and
updated six of them. Zero orphaned TODO/FIXME/XXX/HACK anywhere in the tree. Both packages
100% green after every change.

## 1. Independent re-verification (not re-trusted from the confidence report)

| Check | Result | Matches confidence-report-v3.md? |
|---|---|---|
| `kaizi/server` `tsc --noEmit` | clean | Yes |
| `kaizi/server` `npm test` | 167/167 + 8 skipped (175) | Yes, exactly |
| `kaizi/server` `TEST_REAL_DB=1 npm run test:integration` | 8/8 | Yes, exactly |
| `kaizi/app` `tsc --noEmit` | clean | Yes |
| `kaizi/app` `npm test` | 81/81 | Yes, exactly |
| `kaizi/app` `expo export --platform ios` | clean, 1138 modules, `.hbc` bundle | Yes |
| `kaizi/app` `expo export --platform android` | clean, 1136 modules, `.hbc` bundle | Yes |

All run fresh in this pass, against the same real Postgres 16 instance (already running at
session start), not inferred from anyone's self-report.

## 2. The five flagged gaps — each chased to a real decision

1. **WorldScreen/YouScreen fixed padding instead of `useSafeAreaInsets` — FIXED.**
   Confirmed the gap was real: `grep` across all screens showed only `WelcomeScreen.tsx`
   using the hook directly, but the shared `OnboardingScreen.tsx` wrapper (used by every
   other onboarding screen) does too — so "onboarding screens do this correctly" was
   accurate, and World/You genuinely didn't. Added `useSafeAreaInsets` to both
   `WorldScreen.tsx` (status bar top padding, chat FAB bottom offset, home-UI bottom
   padding; also switched `statusBar`'s fixed `height: 54` to `minHeight: 54` since the
   larger inset-aware padding would otherwise clip content) and `YouScreen.tsx` (header
   top padding, scroll-view bottom padding) — same pattern as `OnboardingScreen.tsx`'s
   `Math.max(insets.bottom, 12) + N` convention. Typecheck clean, 81/81 app tests still
   pass (no test covered visual padding, expected).
2. **You→Progress showing only real data — ASSESSED, not a bug, no fix needed.** Read
   the actual rendered UI, not just the code comment describing it: `ProgressPanel`
   shows today's kept/total and active-goal count, then an explicit `noteCard` stating
   plainly "Consistency %, total Growth, and the monthly chart need a dedicated stats
   endpoint that isn't built yet." That's an honest minimal state, not a confusing one —
   nothing implies more data exists than does.
3. **Settings panel rows being display-only — ASSESSED, not a bug, no fix needed.**
   Same check: `SettingsPanel` rows have no `onPress` at all (not a dead-looking button —
   structurally just informational `View`s), and an explicit note reads "These rows are
   informational for now — export/reset/subscription-management endpoints aren't built
   yet." Not misleading.
4. **Zone-unlock is goal-based, not the streak ratchet from world-spec.md #6 —
   ASSESSED, accepted v1 simplification, full reasoning documented, not built.** Did not
   build the ratchet table (correctly out of scope — a shared design decision with
   ep-notes Gap 2, per both `app-restructure-v3.md` §5 and backend2's own determination).
   Gut-checked whether the current mechanism is actually broken/misleading: it isn't —
   the locked-zone UI copy ("Unlocks when you pick Fitness or Discipline as a goal")
   accurately describes the real (simpler) mechanism rather than promising a streak that
   doesn't exist, and because goals aren't editable post-onboarding, the unlock is
   trivially monotonic (can't regress) even without a ratchet table. Full reasoning
   trail in `ep-notes.md`'s 2026-07-12 entry, including why a quick partial-streak guard
   would actually be *worse* (it would reintroduce the exact regression risk Gap 2 exists
   to prevent).
5. **Stale "Not wired into app.ts/index.ts" doc comment — FIXED (trivial).** All four
   route files (`chat.ts`, `customization.ts`, `intentions.ts`, `journal.ts`) had a
   leftover header comment pointing at a `PENDING_INTEGRATION.md` that no longer exists
   (deleted once wired, per the previous EP pass). Replaced with an accurate one-liner
   ("Mounted in app.ts alongside the onboarding/verify/sms routers.").

## 3. Security addendum — scoped review of the two new routes + World screen input

Full detail in `security-review.md`'s new "v3 addendum (2026-07-12, EP final sweep)"
section. Summary:

- **`POST /api/onboarding/quiz`**: clean. Same auth/rate-limit posture as `/profile`.
  Every answer field is a strict `z.enum` (no free text anywhere in the quiz) — verified
  there is no injection surface into the JSONB store or into the Claude system prompt via
  the quiz specifically (unlike the pre-existing, unchanged `identityWhy` free-text
  field, which was already a prompt-input surface before this pass).
- **`POST /api/intentions/generate` — real gap found and fixed.** No per-day
  idempotency guard: calling it twice for the same user/day triggered two full-price
  `claude-opus-4-8` calls and two sets of duplicate `source:"companion"` rows, with no
  protection beyond the generic 30/min/IP world rate limiter shared across all four
  world routers (meaning an attacker could spend the entire 30/min budget on this one
  paid-API route alone). Unlike Twilio's `/verify/start` (which got a per-phone daily
  cap *and* a global circuit breaker in the M-1 fix), `/generate` had neither, despite
  calling the more expensive of the two AI call paths (`max_tokens: 1024` vs. chat's
  `300`). **Fixed:** the route now checks for existing intentions on the requested date
  first and short-circuits (`200`, no new rows, no API call) if any exist — caps real
  spend to at most one generation per user per day, matching the usage pattern
  `personalization-spec.md` §3.3 already assumed. Verified with 3 new regression tests
  (`test/world/intentions-source-and-generate.test.ts`) plus a live curl walkthrough
  against the real server + real Postgres (first call 201/3 rows, second call 200 with
  the *same* 3 IDs, `GET /` still showing 3 not 6 — not just asserted in a test, watched
  happen against a real database).
- **World screens' input handling**: clean. `IntentionsSheet`'s manual-add fields cap
  client-side (60/80 chars) well under the server's caps (200/200); `ReflectionSheet`/
  `ChatSheet` have no client-side cap but are backstopped by server-side Zod limits
  (4000/2000 chars) with no bypass path; React Native's `<Text>` has no markup-injection
  surface by platform design.

## 4. Full project consistency sweep — six docs updated

Grepped every doc for "not yet started"/"not yet built"/"pending"/"no consuming UI" and
fixed every hit that was now false (left the ones that are still accurate, e.g.
`world-build-plan.md`'s note that memory-echo *retrieval* still isn't built — only
storage is):

- **`docs/design/world-spec.md`** — status section no longer says Expo screens
  consuming the backend "are not yet started"; now points at `app-restructure-v3.md`
  and `confidence-report-v3.md`, and explains the goal-based (not streak-based) zone
  gating with a pointer to `ep-notes.md`'s reasoning.
- **`docs/design/world-build-plan.md`** — "Mobile screens are still queued" corrected
  throughout (status line, "New app screens" section retitled from "queued, not yet
  built" to "built", sequencing checklist steps 4/5 marked done).
- **`docs/DEPLOYMENT-READINESS.md`** — the entire "Blocked on the pending app
  restructure" section (which said the app was onboarding-only and gated production
  builds on a redesign that's now shipped) rewritten to reflect what's actually still
  open: no real-device/simulator verification has ever happened, and the credential/
  account gaps are unchanged — explicitly distinguished from the restructure question,
  which is resolved.
- **`kaizi/app/DEPLOYMENT.md`** — the "do not build until the redesign is approved"
  gate updated to reflect the redesign being built; recommends an internal-testing build
  as the reasonable next step instead of a flat hold.
- **`docs/architecture.md`** — this was the stalest doc in the tree: still titled
  "Architecture (Onboarding MVP)," still showed a 7-screen/4-endpoint system diagram, and
  **incorrectly stated CORS was configured** (it was fully removed in the M-4 security
  fix, 2026-07-12 prior pass) — a real factual error, not just a staleness issue. Rewrote
  the intro, system diagram, API surface table (added quiz + `/generate`, corrected the
  world-route rate-limit description to reflect it's one *shared* 30/min/IP budget across
  all four world routers, not 30/min each), and security notes section.
- **`kaizi/README.md`, `kaizi/server/README.md`, `kaizi/app/README.md`** — root README's
  phase description, screen count (7→8), and terminology ("promises"→"intentions", per
  the founder's already-made 2026-07-11 decision that the doc hadn't caught up to) all
  updated; server README gained full `/api/onboarding/quiz` and
  `/api/intentions/generate` documentation (every example curl in the new quiz section
  was run live against the real server before being written down — verified `201` on
  first submit); app README rewritten from "onboarding only, seven screens" (both false)
  to describe both shipped phases, with the known-deviations list extended to include the
  three assessed-not-fixed items from section 2 above plus the never-visually-verified
  caveat.

## 5. TODO/FIXME/XXX/HACK sweep

`grep -rn "TODO\|FIXME\|XXX\|HACK"` across `server/src`, `server/test`, `app/src`,
`app/test`, and `docs` (excluding `node_modules`/`dist`): zero orphaned markers. The only
`XXX` hits are a phone-formatting test description and a doc comment about phone-number
grouping (`(XXX) XXX-XXXX`) — not TODO markers. Also checked for `@todo`, "not
implemented," "unimplemented," and stray "WIP" markers in source — none found.

## 6. Final verification evidence (after every fix above)

- **Server:** `tsc --noEmit` clean; `npm test` — **170/170 passing** (8 correctly
  skipped, 178 total — the 3 new idempotency-guard tests added to the previous 175);
  `TEST_REAL_DB=1 npm run test:integration` — **8/8 passing**; `npm run build`
  (production `tsc` compile) clean.
- **App:** `tsc --noEmit` clean; `npm test` — **81/81 passing** (unchanged — the
  safe-area fix has no unit-testable surface); `npx expo export --platform ios` and
  `--platform android` both bundle cleanly.
- **Live e2e evidence, not just tests:** ran the new quiz doc example against the real
  server + real Postgres (201, matches documented response exactly); ran the
  `/generate` idempotency fix twice against the real server + real Postgres (201 then
  200, identical IDs, `GET /` confirming no duplicate rows).
- `git status` clean at the end of this pass except the files listed below, all
  intentional.

## Files touched this session

Server: `src/routes/intentions.ts` (idempotency guard), `src/routes/chat.ts`,
`src/routes/customization.ts`, `src/routes/journal.ts` (stale doc comment),
`test/world/intentions-source-and-generate.test.ts` (+3 tests), `README.md`.
App: `src/screens/WorldScreen.tsx`, `src/screens/YouScreen.tsx` (safe-area insets),
`README.md`, `DEPLOYMENT.md`.
Docs: `README.md`, `docs/architecture.md`, `docs/security-review.md` (v3 addendum),
`docs/design/world-spec.md`, `docs/design/world-build-plan.md`,
`docs/DEPLOYMENT-READINESS.md`, `docs/ep-notes.md` (new 2026-07-12 section), this file.

## What's still genuinely open (accepted, not fixed here)

- **Never visually verified on a real device or simulator** — true of every pass to
  date, this one included; no device/simulator has ever been available in any sandbox
  this project has run in.
- **The streak-milestone/zone ratchet table** (ep-notes Gap 2, extended to per-goal
  zones) — a real future feature, correctly not built here or in the passes before it;
  see section 2.4 above and `ep-notes.md` for the full reasoning on why the current
  simplification is safe to ship without it.
- **`world-spec.md` #5 (SMS mirrors the living world)** — still blocked on the same
  "current activity" derivation gap flagged since the first `ep-notes.md` entry; untouched
  by this pass, not part of what shipped.
- **Credential/account/legal blockers in `DEPLOYMENT-READINESS.md`** — unchanged by this
  pass; these were never a code problem.

This closes out the v3 build phase. Every flagged gap has a real decision attached to it
(fixed or explicitly accepted with written reasoning), the one previously-unflagged real
gap this pass found (`/generate`'s cost/idempotency issue) is fixed and verified live, and
every doc in the tree that described the restructure as pending now describes it as built.
