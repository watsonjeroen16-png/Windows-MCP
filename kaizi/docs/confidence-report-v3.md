# Kaizi v3 — Confidence Report (Personalization Quiz + World/You Restructure)

- **Date:** 2026-07-12
- **Role:** Confidence Engineer (same mandate as `confidence-report.md`, this time scoped to the v3
  build: `app-restructure-v3.md` World/You restructure + `personalization-spec.md` §1/§3 quiz and
  AI-generated intentions).
- **Mandate:** verify for real — live curl against a real running server + real Postgres, real
  `expo export`, real adversarial requests — not typecheck/unit-test trust alone.
- **Scope:** everything backend2 and mobile reported done in their final `events.ndjson` entries
  (migration `003_personalization.sql`, `POST /api/onboarding/quiz`, `POST /api/intentions/generate`,
  3-block Claude prompt caching, WorldScreen/YouScreen, zone travel strip, Chat/Intentions/Reflection
  sheets, quiz as onboarding step 4/8, manual intention add).

## Verdict

**Everything both agents claimed is real and holds up under live verification. No functional bugs
found.** This is a genuinely clean build — every live curl matched the documented/expected contract on
the first or second try (the only "failures" along the way were my own typos against the quiz's enum
values, not product bugs). Full regression: **server 175/175 (167 always-on + 8 opt-in real-Postgres),
app 81/81, both typecheck clean, both `expo export` platforms clean.** One pre-existing stale doc
comment is flagged (not a functional bug) and one design gap already self-disclosed by the mobile agent
is confirmed accurate, not newly discovered.

---

## 1. Live end-to-end verification against real Postgres — VERIFIED

Native Postgres 16 was down at session start (`pg_lsclusters` → `down`); started it for real
(`service postgresql start` → `online`). `npm run migrate` in `kaizi/server` printed `No pending
migrations.` — `003_personalization.sql` was already applied (idempotency confirmed: re-running is a
no-op). Started the real server (`npm run dev`, Twilio mock mode, no `ANTHROPIC_API_KEY` so Claude mock
mode) and drove the entire flow with curl against `localhost:4000`:

```
POST /api/verify/start          → {"status":"pending","mock":true}
POST /api/verify/check (000000) → {"status":"approved","verified":true,"token":"...","expiresAt":"..."}
POST /api/onboarding/profile    → {"ok":true,"userId":"...","created":true}
POST /api/onboarding/quiz       → {"ok":true,"userId":"...","created":true,"skippedEntirely":false}
POST /api/intentions (manual)   → {"intention":{...,"source":"user"}}
POST /api/intentions/generate   → {"intentions":[{...,"source":"companion"} x3],"scheduledFor":"..."}
GET  /api/intentions            → both source values present and correctly labeled
POST /api/chat                  → {"userMessage":{...},"companionMessage":{...}} — no error
POST /api/intentions/:id/keep   → status "kept", kept_at set
GET/PUT /api/customization      → falls back to onboarding profile, then reflects the PUT
POST/GET /api/journal           → entry created and listed
POST /api/sms/welcome           → 200, then 409 "already_welcomed" on repeat
```

Persistence independently confirmed via `psql` — `onboarding_quiz_responses` row matched exactly what
was POSTed, `intentions.source` column present and correctly defaulted/overridden per row. Server log
(`/tmp/kaizi-server.log`) showed zero 500s and zero unhandled errors across the entire session.

**`/api/intentions/generate` in mock mode works correctly** and was exercised three ways: (a) a user
with a full profile + quiz data (fitness/discipline goals) got goal-flavored fallback content ("Move for
20 minutes", "Stretch before bed"); (b) a second, completely fresh user with **no profile row and no
quiz row at all** still got a valid 3-intention response with generic fallback content and
`source:"companion"` — confirming the "no quiz data yet" case from the task's adversarial list actually
works, not just claimed; (c) a `count:1` request for a business-goal user returned exactly one,
business-flavored intention, confirming the `count` param is respected.

**Chat's 3-block system prompt path doesn't error** — `POST /api/chat` for the user with quiz data on
file returned a normal companion reply with no server-side error; `buildQuizProfileDigest`/
`buildSystemBlocks` are exercised on this call path (also independently unit-tested in
`test/world/claude-chat.test.ts`, 11/11 passing).

## 2. Contract audit between app and server — VERIFIED, NO DRIFT

Read `kaizi/app/src/api/client.ts` in full and diffed every World-related function's request/response
shape against the real route handlers in `kaizi/server/src/routes/{intentions,chat,customization,
journal}.ts`, then independently confirmed each shape against the actual live curl output above (not
just static reading — every endpoint in client.ts was called for real and the JSON compared field for
field):

| Client function | Route | Verdict |
|---|---|---|
| `getIntentions` | `GET /api/intentions` | Matches — `{intentions, scheduledFor}`, `source` field present |
| `createIntention` | `POST /api/intentions` | Matches — body/response exact |
| `generateIntentions` | `POST /api/intentions/generate` | Matches — `{count?, scheduledFor?}` in, `{intentions, scheduledFor}` out |
| `keepIntention` | `POST /api/intentions/:id/keep` | Matches |
| `getChatMessages`/`sendChatMessage` | `GET`/`POST /api/chat` | Matches |
| `getCustomization`/`updateCustomization` | `GET`/`PUT /api/customization` | Matches, including the `source: "customization"|"onboarding_profile"` fallback flag |
| `getJournalEntries`/`createJournalEntry` | `GET`/`POST /api/journal` | Matches |
| `submitQuizAnswers` | `POST /api/onboarding/quiz` | Matches `submitQuizSchema` exactly, fire-and-forget as documented |

No drift found — this is the same class of bug the original onboarding confidence pass didn't need to
fix here because both v3 agents demonstrably read each other's actual schemas/route files rather than
working from the spec doc alone (visible in backend2's and mobile's own event-log entries).

**One stale doc comment, not a bug:** `intentions.ts`, `chat.ts`, `customization.ts`, and `journal.ts`
each still carry a header comment saying "Not wired into app.ts/index.ts here — see
PENDING_INTEGRATION.md" — leftover from backend2's first (2026-07-11) pass before wiring happened. All
four are in fact mounted in `app.ts` (confirmed by reading it and by every route responding live). Purely
cosmetic; not fixed here per "small, scoped fixes" — flagging instead since it's a doc-only change with
no runtime effect, and touching four files' header comments felt like scope creep for zero functional
benefit. Worth a follow-up cleanup pass.

## 3. App build (`expo export`) — VERIFIED, both platforms clean

```
npx expo export --platform ios     → Bundled 1138 modules, dist/_expo/static/js/ios/*.hbc (2.8MB), exit 0
npx expo export --platform android → Bundled 1136 modules, dist/_expo/static/js/android/*.hbc (2.9MB), exit 0
```

Both succeed with the new WorldScreen/YouScreen/ZoneBackground/Sheet code included — the restructure
does not break Metro bundling on either platform. `npx tsc --noEmit` also clean (0 errors).

## 4. Adversarial / edge-case pass — VERIFIED

- **Submitting the quiz twice (idempotency):** first submit → `created:true`; identical re-submit with
  one changed answer → `created:false`, and `psql` confirmed the row was updated **in place** (one row,
  `updated_at` bumped, new answer reflected) — genuine upsert, not a duplicate-row bug.
- **Submitting partial quiz answers:** POSTing only 2 of 10 fields **replaces** the whole `answers`
  JSONB blob rather than merging with previously-submitted fields. Verified this is *not* a bug: read
  `kaizi/app/src/screens/HandoffScreen.tsx` and `state/OnboardingContext.tsx` — the client accumulates
  all quiz answers in memory across all 10 cards and calls `submitQuizAnswers` exactly **once**, at
  handoff (end of onboarding), with the full accumulated state. The route's own doc comment ("a user who
  backs up and changes an answer before finishing onboarding just re-submits") describes the same
  full-resubmit model. Replace-semantics is the correct implementation of that model. Flagging only
  because a *future* feature (open question #4 in `personalization-spec.md` — an in-app "retake the
  quiz" affordance) would need to either keep this full-replace contract explicit in its UI (always show
  prior answers pre-filled) or the backend would need to switch to a `jsonb_concat`/merge upsert —
  worth a one-line note in that future spec, not an issue with what's built today.
- **`/generate` with zero quiz data:** verified above (section 1b) — works, returns generic fallback,
  `source:"companion"`, no error, no special-case 404/500.
- **`/generate` with zero profile at all** (a user who verified their phone but never completed
  onboarding): also tested — still succeeds. Slightly more permissive than the spec technically
  requires (spec assumes quiz-without-screentime, not profile-without-anything), but it degrades
  gracefully rather than erroring, which is the right failure mode for a route a client might call
  speculatively.
- **Concurrent intention creation:** fired 5 parallel `POST /api/intentions` for the same user/day —
  all 5 succeeded with distinct IDs, `psql` count matched exactly (6 user-sourced rows: 1 earlier +
  5 concurrent), no lost writes, no unique-constraint collisions.
- **Zone-gating reads the right onboarding state:** traced the actual data flow, not just the gating
  function in isolation — `App.tsx`'s `RootFlow` passes `state.goals` (the onboarding `OnboardingContext`
  goals array, chosen on Screen 2) into `WorldProvider`, which seeds `WorldState.identity.goals`;
  `data/zones.ts`'s `isZoneUnlocked(zone, goals)` reads exactly that array. Goal→zone mapping
  (fitness/discipline→Training, business/learning→Study, skin→Spring) matches
  `app-restructure-v3.md` §4.1 verbatim. This is user-driven zone *selection* (tapping the travel strip)
  gated by goals, not the streak-based auto-following-activity mechanic from `world-spec.md` §6 — and
  that's a documented, deliberate simplification (both in `app-restructure-v3.md` §5 and the mobile
  agent's own event-log entry), not a bug masquerading as one.
- **Auth gating:** unauthenticated `GET /api/intentions`, unauthenticated `POST /api/onboarding/quiz`,
  and a garbage bearer token against `/api/intentions` all correctly returned `401`.
- **Validation:** negative `rewardGrowth` on `POST /api/intentions` correctly rejected with `400` and a
  field-level error message; an invalid quiz enum value correctly rejected with `400` naming the exact
  field and the allowed values.
- **`skippedEntirely: true` with empty answers:** accepted correctly (`created:true,
  skippedEntirely:true`), matching the "Skip quiz" card-1 affordance.
- **The original 8-step onboarding + SMS mock still works end-to-end:** re-ran the full
  verify→profile→quiz→welcome sequence live against the real server; `POST /api/sms/welcome` returned
  `200` with the mock SMS body logged, then `409 {"error":"already_welcomed"}` on a repeat call, exactly
  as the pre-v3 confidence pass documented. The restructure did not regress this.

## 5. Full regression — VERIFIED

| Package | `tsc --noEmit` | Tests |
|---|---|---|
| `kaizi/server` | clean | **167/167** (`npx vitest run`) + **8/8** opt-in real-Postgres (`TEST_REAL_DB=1 npx vitest run test/db-integration.test.ts`) — **175/175 total** |
| `kaizi/app` | clean | **81/81** (`npx vitest run`, 6 files) |

Both numbers match what backend2 and mobile self-reported in their final `events.ndjson` entries
(server "122 passed, 5 correctly skipped" mid-build → 167 at final commit as more tests were added; app
81/81) — independently re-run here against a live environment, not re-trusted from their claims.

`git status` in the repo root is clean — both agents' work is fully committed (`1340d04`, `d903073`,
`b867245` on `claude/kaizi-dev-agent-875bpz`), nothing left uncommitted for this pass to worry about.

---

## Accepted limitations (environment-imposed, not resolved here)

- **No real `ANTHROPIC_API_KEY`.** Every Claude-touching path (chat 3-block prompt, intention
  generation) was verified in mock mode only. The cache-breakpoint behavior described in
  `personalization-spec.md` §3.3 (whether the combined stable+quiz-digest prefix actually crosses the
  4096-token caching floor) is architecturally sound and unit-tested (`buildSystemBlocks()` pure-function
  tests) but was not empirically confirmed against `usage.cache_creation_input_tokens` on a real API
  call — backend2 flagged this same limitation in their own final report; it remains open pending a real
  key.
- **No physical device / Expo Go / simulator.** Same limitation as the original onboarding pass — both
  `expo export` targets are confirmed clean, TypeScript is sound, and unit/logic tests pass, but the
  actual on-device rendering of the new WorldScreen/YouScreen/ZoneBackground (zone art, weather layers,
  sheet slide-up animation) was not visually verified. Mobile agent's own report says the same thing
  honestly; not a new gap introduced by this pass.
- **The mobile agent's self-disclosed known gaps were spot-checked, not exhaustively re-audited:**
  You→Progress showing only today's kept/total (no historical stats endpoint), Settings rows being
  display-only, and zone art being RN/SVG-primitive rather than pixel-matched to the mockup — all
  confirmed accurate by reading the relevant screens, not contradicted by anything found here, but a
  full pixel/UX audit was out of scope for a backend-and-contract-focused confidence pass with no
  device available.

## Files touched this pass

None — no functional bugs were found that needed a code fix. This report and the corresponding
`.agents/events.ndjson` entries are the only new artifacts.

## Evidence trail

Raw server log from the live verification session: `/tmp/kaizi-server.log` (session-local, not
committed). Every curl command and its output referenced above was run directly against
`http://localhost:4000` with the real Postgres `kaizi` database in this sandbox during this pass.
