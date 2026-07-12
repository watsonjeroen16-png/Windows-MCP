# EP Notes — Scope Gaps Observed in Planning Docs

Per my mandate, these are gaps I noticed in the *plan* itself (`world-build-plan.md`
vs. `world-spec.md`), not bugs in built code. I am not building any of this — flagging
for the lead/founder to fold into the plan (or explicitly defer) before it's built.

## Gap 1: No backend surface for "current companion activity" (world-spec.md #5)

`world-spec.md` §5 ("SMS mirrors the living world") explicitly states:

> Backend needs to track/derive the companion's "current activity" server-side (or
> accept it's approximate/simulated) so the SMS and the app don't contradict each other.

`world-build-plan.md`'s "New backend surface (queued, not yet built)" section lists
`chat/message`, `intentions`, `companion_customization`, and `journal_entries` — there is
no table, column, or endpoint anywhere in the plan (or in the migration backend2 actually
wrote, `002_companion_world.sql`) that stores or derives a "current activity." Without it,
the Twilio SMS templates (`sms-templates.ts`) have no server-side source of truth to pull
a real activity from, so proposal #5 can't be implemented as specced — it would have to
fall back to the "approximate/simulated" escape hatch the spec itself allows, which the
plan doesn't call out as the chosen path either.

**Suggest:** the lead either (a) adds an explicit "current activity" derivation rule to
the plan (e.g. deterministic function of time-of-day + environment, no new table needed —
matches the spec's "or accept it's approximate/simulated" fallback), or (b) adds a small
`companion_activity_state` concept to the schema if activity needs to be more than a pure
function of time. Either is a small addition; I'm not picking one unprompted.

## Gap 2: No persisted world-state / streak-milestone table (world-spec.md #6)

`world-spec.md` §6 ("Streak-driven world states") calls for **concrete, persisted visual
milestones** (first lantern at day 7, second at day 14, azaleas at day 30, third koi at
day 60, red maple at day 90) that are explicitly "cumulative and permanent (never reverse
on a missed day)."

Nothing in `world-build-plan.md`'s backend surface, and nothing in the actual
`002_companion_world.sql` migration, persists this. The `intentions` table has enough raw
data (`status`, `kept_at`, `scheduled_for`) to *compute* a streak on the fly, but the spec
requires the milestones to be **permanent once reached** — if a user has a long unbroken
streak, breaks it, then keeps intentions again, a purely-computed-from-`intentions` streak
would make the lantern/azalea/koi/maple state regress, which directly contradicts "never
reverse on a missed day." That needs either a ratchet (store the highest milestone ever
reached, not just the current streak) or a dedicated small state table.

**Suggest:** the lead add a one-row-per-user `world_state` (or similar) concept — even
just a `highest_streak_milestone_reached integer` column — to the plan before this is
built, so whoever implements the Home screen and Journey screen doesn't have to make that
call mid-implementation.

## Gap 3: Companion-initiated speech context selection (world-spec.md #2) is implicitly covered, no new gap

Proposal #2's priority-ordered context sources — (a) an unkept promise from today, (b) a
streak milestone reached today, (c) time-of-day flavor, (d) fallback quote pool — are all
derivable once Gap 1/2 above are resolved (unkept promise: query `intentions` for today;
streak milestone: needs Gap 2's persisted state to know if *today* is the day a milestone
was newly reached, not just currently active). Not a separate gap, just noting it depends
on Gap 2 being resolved first.

---

None of the above blocks the currently-planned build (chat, intentions, customization,
journal) — they're gaps in the *later* proposals (#5, #6) that the plan says are "queued"
but whose backend surface isn't fully specified yet. No code changes made for this note.

---

# EP Deploy Audit — 2026-07-12 (fresh audit, superseding an interrupted prior attempt)

A prior EP audit of the Deployment Engineer's work was started but got interrupted by a
container restart before it logged any verdict on deploy specifically (no partial findings
exist in `events.ndjson` to resume from). This is a full fresh pass, not a resume, covering
every deliverable: `.github/workflows/kaizi-ci.yml`, `kaizi/server/Dockerfile` +
`.dockerignore`, `kaizi/docker-compose.yml`, `kaizi/server/DEPLOYMENT.md`,
`kaizi/app/eas.json` + `kaizi/app/DEPLOYMENT.md`, `kaizi/docs/DEPLOYMENT-READINESS.md`, and
`kaizi/docs/GETTING-CREDENTIALS.md`.

## What I verified (all held up)

- **CI**: ran the exact `npm ci` / `npm run typecheck` / `npm test` sequence from
  `kaizi-ci.yml` for both `kaizi/server` and `kaizi/app` locally — server: typecheck clean,
  120/120 unit tests + 5 correctly-skipped real-DB tests (gated behind `TEST_REAL_DB`, never
  runs in CI); app: typecheck clean, 43/43 tests. Paths filter (`kaizi/**` +
  the workflow file itself), working-directory, and `cache-dependency-path` are all correct;
  both lock files are committed. No lint step exists because no ESLint config exists in
  either package — a correct omission, not a bug.
- **Docker/compose**: replicated every Dockerfile step by hand against a fresh copy of the
  source (`npm ci` → `tsc build` → copy `src/db/migrations` → `npm ci --omit=dev`), then ran
  the compiled `dist/index.js` and `dist/db/migrate.js` against the real Postgres 16 already
  running in this sandbox using the exact `docker-compose.yml` env vars. Migration was
  idempotent ("No pending migrations" — schema already matches). Booted the server in both
  `NODE_ENV=development` (compose's mode: Twilio mock, `/health` → `{"ok":true}`) and
  `NODE_ENV=production` (fail-closed guard correctly refuses to boot without full Twilio
  creds, exactly as `DEPLOYMENT.md` and the compose file's own comments claim). Re-confirmed
  the sandbox's Docker Hub egress block is still real today, not a stale claim: started
  `dockerd` manually and got a 403 Forbidden from the registry CDN on `docker pull
  node:20-slim`.
- **`kaizi/server/DEPLOYMENT.md`**: every env var name in its table
  (`NODE_ENV`, `PORT`, `DATABASE_URL`, `SESSION_SECRET`, all four `TWILIO_*`,
  `ANTHROPIC_API_KEY`, `KAIZI_ENFORCE_QUIET_HOURS`) matches `config.ts`/`index.ts` exactly.
  `/health` response body, and the rate-limit smoke-test claim ("6th request in a minute
  gets `429 {"error":"rate_limited"}"`, default limit 5/min), both verified directly against
  `rate-limit.ts` and a live curl loop against the boot-tested server.
- **`kaizi/app/DEPLOYMENT.md` + `eas.json`**: `submit.production.ios.{appleId,ascAppId,
  appleTeamId}` and `submit.production.android.serviceAccountKeyPath` match `eas.json`
  exactly; `app.json`'s `com.kaizi.app` bundle id/package, version/buildNumber/versionCode,
  and the deliberate absence of `extra.eas.projectId` all match; the https-only release-build
  gate claim matches `src/api/client.ts` (`isReleaseBuild` / `isSafeBaseUrl`) exactly;
  `google-play-service-account.json` is genuinely gitignored.
- **`GETTING-CREDENTIALS.md`** (the highest-stakes doc — a non-technical founder follows
  this with real money on the line): fact-checked all 6 signup URLs (Anthropic Console,
  Twilio, Railway, expo.dev, Apple Developer enrollment, Google Play Console signup) via
  live fetch/search — all current and correct, including confirming Apple's page still
  states the $99/year fee verbatim, Railway's `railway.app` domain still works (not
  superseded by `railway.com`), and `console.anthropic.com` is still Anthropic's own current
  terminology for the console (no rebrand). Every env var / `eas.json` field name it
  references was grepped against the real source and matches exactly. Its internal
  cross-references to `DEPLOYMENT.md` section numbers are all correct.
- **`DEPLOYMENT-READINESS.md`**: every "done" claim re-verified true today (CI, Docker
  build-by-replication, both deploy guides, credentials table); the "mobile app is
  onboarding-only, Companion World UI not started" claim is still accurate — checked
  `kaizi/app/src/screens/` directly, and the Retention Architect's `kaizi_v3_mockup.html` /
  `app-restructure-v3.md` are still design artifacts awaiting founder approval, not code in
  `app/src`.

## What I found and fixed (not just reported)

1. **`docs/security-review.md` L-2 (`trust proxy` unset) was a real, closeable gap** — it
   was sitting as an "accepted limitation, no real topology exists in this sandbox," but
   that stopped being true the moment `kaizi/server/DEPLOYMENT.md` committed to a concrete
   single-hop target (Railway). Neither `DEPLOYMENT.md` nor the code accounted for it: a
   founder deploying exactly per the guide would get a per-IP verify rate limiter that's
   silently a single shared global bucket (self-DoS) because `req.ip` resolves to Railway's
   proxy for every request. **Fixed**: `kaizi/server/src/app.ts` now sets
   `app.set("trust proxy", 1)` when `NODE_ENV=production` (1 hop, not `true` — deliberately
   not trusting an unbounded `X-Forwarded-For` on any topology without an actual proxy in
   front). Added `kaizi/server/test/trust-proxy.test.ts`. Updated `security-review.md` (L-2
   marked FIXED, checklist item 6 checked off, new "Resolved 2026-07-12 (EP deploy-audit
   pass)" section). Re-verified full green after the fix: server typecheck clean, 122/122
   unit tests + 5/5 real-Postgres integration, and a fresh Dockerfile-step replication
   booting in `NODE_ENV=production` against live Postgres with the fix active (confirmed the
   rate limiter still correctly blocks the 6th request).
2. **`kaizi/server/DEPLOYMENT.md` never pointed to `GETTING-CREDENTIALS.md`** — it only
   referenced the older `kaizi/docs/founder-guide.md` §6 for Twilio, and had *no* pointer at
   all for how to obtain the Anthropic key (just the console URL, no click-by-click). Since
   `GETTING-CREDENTIALS.md` explicitly describes itself as the two-way-linked beginner
   companion to this file, the missing back-reference was a real gap for a founder starting
   from `DEPLOYMENT.md` instead of `GETTING-CREDENTIALS.md`. **Fixed**: added
   `GETTING-CREDENTIALS.md` §1/§2 cross-references to both prerequisite bullets.
3. **Markdown list-numbering bug in `DEPLOYMENT.md`'s post-deploy smoke-test checklist** —
   a duplicated "3." (should have been the 5th item) threw off the two items after it too.
   Cosmetic only (CommonMark renumbers automatically regardless of source numbers, so it
   rendered fine on GitHub), but sloppy to read in a raw diff/editor. **Fixed**: renumbered
   5/6/7 correctly.

## Verdict

All five audit areas hold up under literal, step-by-step verification against the live
Postgres and both real package.json scripts in this sandbox — nothing in any of these docs
was found to be fabricated, aspirational, or referencing a file/command that doesn't exist.
The one genuine security-relevant gap found (`trust proxy`) is now closed in code with a
regression test, not just noted. The credentials guide is trustworthy enough for a
non-technical founder to follow literally: every URL, every env var name, and every
cross-reference checks out against the real source and the real internet as of this pass.

---

# EP Final Sweep — 2026-07-12 (v3: quiz + World/You restructure)

Same mandate as the two passes above, this time closing out the personalization-spec.md
quiz + `app-restructure-v3.md` World/You build that backend2, mobile, and the Confidence
Engineer just finished (`confidence-report-v3.md`: zero functional bugs, server 175/175,
app 81/81). Independently re-ran every number myself before touching anything — all
matched exactly. Full writeup of everything fixed/verified this pass is in
`ep-final-report.md`'s 2026-07-12 section; this entry is specifically the reasoning trail
for the one open design question the task asked me to gut-check: **is goal-based-only
zone unlocking (no streak ratchet) actually broken/misleading, or an acceptable v1
simplification?**

## Zone-unlock gating: goal-based-only — judged acceptable, not building the ratchet

**What's built:** `app/src/data/zones.ts`'s `isZoneUnlocked(zone, goals)` returns `true`
the moment a user's onboarding `goals[]` contains any goal the zone maps to (Fitness/
Discipline → Training Ground, Business/Learning → Study Veranda, Skin → Spring). No
streak, no time delay, no server call — pure client-side derivation from a value chosen
once at onboarding and never currently editable post-onboarding (`YouScreen`'s
`CompanionPanel` lets you edit species/personality/environment, not goals).

**What the spec originally wanted:** `world-spec.md` §6 and `app-restructure-v3.md` §5 #1
both describe zones being *earned* via a 7-day per-goal streak, ratcheted so the unlock
can never reverse on a missed day — the more aspirational, game-like version of "the
world grows with you." That needs a `zone_state`/streak-milestone table that doesn't
exist (this is ep-notes Gap 2 above, extended to per-goal zones by backend2's own
2026-07-12 determination — logged in `.agents/events.ndjson` and summarized in
`app-restructure-v3.md` §5 #1).

**The gut-check, and why I'm not building a guard or the table:**

1. **It cannot mislead the user about mechanism.** I checked the actual locked-zone
   copy the mobile agent shipped (`zones.ts`'s `lockedHint` field): "Unlocks when you
   pick Fitness or Discipline as a goal" — not "Unlocks after a 7-day streak," which
   would have been a lie about what actually gates it. The UI text was already written
   to match the simpler, real implementation rather than a mismatched aspirational
   version. If it had shipped with streak-flavored copy backing a goal-only mechanism,
   that would've been a real bug (false promise to the user) worth a same-pass fix. It
   didn't.
2. **It cannot regress, which is the one hard invariant both specs actually require.**
   §6's "cumulative and permanent (never reverse on a missed day)" rule is the load-bearing
   requirement — not "must be earned slowly." A goal picked at onboarding and never
   editable is, definitionally, monotonic: it's either in `goals[]` or it isn't, and
   nothing in the shipped app can remove a goal from that array once onboarding
   completes. So the simplification trivially satisfies the actual invariant the spec
   cared about, just via a blunter mechanism (immediate unlock) than the intended one
   (earned unlock). That's a *product depth* gap (zones don't yet feel earned) — not a
   correctness gap.
3. **A "quick guard" isn't well-defined here.** I looked for what a guard would even
   protect against: there's no exploit, no data leak, no crash, no state that can go
   wrong. The only thing missing is the more interesting mechanic. Bolting on a fake
   partial-streak check (e.g., "unlock only after N intentions kept toward that goal,"
   computed live from `intentions` history with no persistence) would actually be
   *worse* than what's shipped — it would violate the never-reverse rule for real (a
   broken streak would un-derive the unlock), which is exactly the bug class Gap 2 was
   raised to prevent in the first place. Building that badly would be a regression
   dressed up as a fix.
4. **The real fix (the ratchet table) is already correctly out of scope.** Both
   `app-restructure-v3.md` §5 and backend2's own 2026-07-12 log entry already flag this
   as a shared design decision (the table shape needs to serve both the general
   streak-milestone mechanic from Gap 2 *and* per-goal zones) that shouldn't be
   preempted by a narrow task. I agree with that framing and am not overriding it here
   — building a one-off, zone-specific ratchet table in this pass would create exactly
   the kind of shape-mismatch follow-up cost that guidance was trying to avoid.

**Verdict: accepted v1 simplification, not a bug.** No code change made. Documented here
per the task's explicit instruction to record the reasoning either way. Follow-up: once
the lead decides the shared ratchet-table shape (Gap 2), extending it to per-goal zone
unlocking is the correct next step — not a patch on the current goal-only gate.

## Other flagged items from this pass, briefly (full detail in `ep-final-report.md`)

- **Fixed** (real, cheap, in-scope): `WorldScreen`/`YouScreen` now use
  `useSafeAreaInsets` instead of fixed padding, matching the onboarding screens'
  existing correct pattern (`OnboardingScreen.tsx`).
- **Assessed, not fixed** (already honest, not confusing): You→Progress and Settings
  both ship with explicit in-UI notes explaining what's not built yet rather than
  fabricating data or offering dead-looking interactive rows. Verified by reading the
  actual rendered copy in `YouScreen.tsx`, not just the code comments describing it.
- **Fixed** (real cost/abuse gap, found during the security addendum): `POST
  /api/intentions/generate` had no per-day idempotency guard — repeat calls each
  triggered a fresh paid Claude Opus call and duplicate rows. Added a check-existing-
  before-generating guard; verified with 3 new tests plus a live curl walkthrough
  against real Postgres. See `security-review.md`'s 2026-07-12 addendum for full detail.
- **Fixed** (trivial, zero runtime effect): the stale "Not wired into app.ts/index.ts
  here — see PENDING_INTEGRATION.md" header comment in `chat.ts`, `customization.ts`,
  `intentions.ts`, `journal.ts` (all four are in fact mounted; `PENDING_INTEGRATION.md`
  no longer exists) — replaced with an accurate one-liner.
