# Kaizi Deployment Readiness

One-page summary of what's ready to ship today, what's blocked purely on
founder-provided credentials/accounts, and what's still blocked on
verification the sandbox can't perform. See `kaizi/docs/GETTING-CREDENTIALS.md`
for beginner-friendly, step-by-step instructions for every credential listed
here.

**Update 2026-07-12:** the app restructure that this doc previously described
as "pending" is now built and verified — the World/You restructure
(`app-restructure-v3.md`) plus the personalization quiz
(`personalization-spec.md`) shipped, and a Confidence Engineer pass confirmed
it live end-to-end against real Postgres (`kaizi/docs/confidence-report-v3.md`:
zero functional bugs, server 175/175, app 81/81, both `expo export` targets
clean). The app is no longer onboarding-only — see "What changed 2026-07-12"
below. This does **not** mean it's ready for a production store submission
today: the credential/account gaps below are unchanged, and the app has still
never been visually verified on a real device or simulator (see that section).

## Ready today

**The backend is independently deployable right now.** Intentions, chat,
customization, journal, the onboarding quiz, and AI-generated intentions are
all built and tested server-side (see `kaizi/server/README.md`).

- CI: `.github/workflows/kaizi-ci.yml` — runs server + app typecheck/test on
  every push/PR touching `kaizi/**`. Server job uses the in-memory test suite
  (no live Postgres needed in CI); the real-Postgres integration path stays
  opt-in behind `TEST_REAL_DB`, as designed.
- Containerization: `kaizi/server/Dockerfile` (multi-stage, non-root,
  `NODE_ENV=production`, prod-only deps in the final image) and
  `kaizi/docker-compose.yml` (Postgres 16 + migration + server, `docker
  compose up` gives a fully working local backend with zero manual Postgres
  setup). Verified by replicating every Dockerfile step manually against the
  native Postgres already running in this dev environment — **not** verified
  with an actual `docker build`, because Docker Hub image pulls are blocked
  by this sandbox's egress policy (confirmed: both `docker build` and `docker
  pull node:20-slim` fail with a 403 from the registry CDN). The Dockerfile
  and compose file should be treated as reviewed-by-reading plus
  step-by-step-simulated, not build-tested end-to-end; a maintainer with
  normal Docker Hub access should run one real `docker compose up` before
  fully trusting it, though there's no structural reason it wouldn't work.
- Deployment guide: `kaizi/server/DEPLOYMENT.md` — concrete Railway steps
  (service creation, Postgres provisioning, every required env var, running
  the migration on deploy, a smoke-test checklist including a real
  mock-mode-off verification flow).
- Mobile build infrastructure: `kaizi/app/eas.json` (development/preview/
  production EAS Build profiles) and `kaizi/app/DEPLOYMENT.md` (EAS account
  setup, build commands, App Store Connect / Google Play submission steps).
  This infrastructure is ready **but should not be used to ship a build yet**
  — see below.

## Blocked purely on founder-provided credentials/accounts

Every credential the project needs, in one place (see
`kaizi/docs/GETTING-CREDENTIALS.md` for the click-by-click version of each):

| # | Credential/account | Unblocks | Cost |
|---|---|---|---|
| 1 | Twilio account + Verify service + SMS-capable number | Real phone verification + real companion SMS (server currently runs in mock mode without it) | Pay-as-you-go, ~free for testing (trial credit) |
| 2 | Anthropic API key (console.anthropic.com) | Real companion chat replies via `/api/chat` (mock canned replies otherwise) | Pay-as-you-go per token |
| 3 | Railway account | Hosting the backend per `kaizi/server/DEPLOYMENT.md` | Free tier exists; small paid plan realistic for always-on |
| 4 | A real `SESSION_SECRET` value, generated and stored safely | Production server boot (fails closed without it — see `DEPLOYMENT.md` §3) | Free (just needs to be generated once and kept secret) |
| 5 | EAS/Expo account | Running any `eas build`/`eas submit` command | Free (paid tiers exist for build concurrency) |
| 6 | Apple Developer Program membership | iOS TestFlight/App Store distribution | $99/year |
| 7 | Google Play Developer account | Android Play Store distribution | $25 one-time |
| 8 | Privacy policy, hosted at a real URL | Required by **both** app stores before submission — Kaizi collects phone numbers and personal reflections (journal, chat, "why" answers), so this isn't boilerplate | Free to host, needs real content |
| 9 | App Store listing copy, screenshots, category | Store submission | Free, just needs to be written/captured |
| 10 | Confirmation on `app.json`'s `com.kaizi.app` bundle identifier | Finalizing iOS/Android bundle IDs before first production build (effectively permanent once submitted) | Free |
| 11 | Confirmation on whether current app icon/splash assets in `kaizi/app/assets/` are final or placeholders | Store-quality icon required (1024×1024 minimum) | Free, just needs a decision |

None of these can be provisioned by an agent — they all require the
founder's own identity, payment method, or account.

## What changed 2026-07-12 — the restructure is built

The app restructure this doc used to gate a production build on is **done**:
onboarding now includes a 10-question personalization quiz (step 4 of 8, per
`personalization-spec.md` — screen-time opt-in was cut by the founder, so it's
8 steps not 9), and onboarding hands off into the World/You restructure
(`app-restructure-v3.md`) instead of ending with nowhere to go — `WorldScreen`
(the app's only "home," zone travel strip, companion, chat FAB, intentions
pouch) and `YouScreen` (Progress/Companion/Settings tabs), with Chat/
Intentions/Reflection as contextual bottom sheets. This consumes the full
backend surface (Intentions, chat, customization, journal, quiz,
AI-generated intentions) live — verified end-to-end against real Postgres,
zero functional bugs (`kaizi/docs/confidence-report-v3.md`).

**Still genuinely open before a production store submission**, independent of
the credentials table below:

- **Never visually verified on a real device or simulator.** Every pass so
  far (onboarding, then the v3 restructure) has verified `expo export`
  bundles cleanly and that the TypeScript/unit-test logic is sound, but
  nobody has watched the zone art, weather layers, sheet slide-up animation,
  or safe-area layout render on an actual iOS/Android screen — this sandbox
  has no device or simulator available. Recommend a real device smoke test
  before the first production build, not just before store submission.
- **Two self-disclosed, intentionally-minimal states** (both reassessed and
  confirmed non-misleading by the 2026-07-12 EP pass, see `ep-notes.md`):
  You → Progress only shows today's kept/total and active-goal count (an
  explicit in-UI note explains the stats endpoint isn't built yet, rather
  than fabricating numbers); Settings rows (export data, reset memory,
  subscription) are display-only with an explicit in-UI note that the
  underlying endpoints don't exist yet. Both are honest v1 states, not bugs —
  worth building out (a real stats endpoint, real settings actions) as a
  near-term follow-up, not a pre-launch blocker.
- **Zone unlocking is goal-based, not streak-based.** A zone unlocks
  immediately once a user picks its matching onboarding goal, not after
  earning a 7-day streak as `world-spec.md` §6 originally envisioned — see
  `ep-notes.md`'s 2026-07-12 entry for why this is judged an acceptable v1
  simplification (it can't regress, since it's driven by an onboarding
  choice that isn't currently editable) rather than a launch blocker.

None of the above blocks shipping a build to internal testers (TestFlight
internal / Play internal track) to get real device eyes on it — they block a
confident **public** store submission, which was already gated on the
credential/account items below regardless.

## Summary

| Layer | Status |
|---|---|
| Server code | Done, tested, deployable today (needs founder credentials from the table above) |
| Server CI/CD infra | Done (`kaizi-ci.yml`, `Dockerfile`, `docker-compose.yml`, `DEPLOYMENT.md`) |
| Server hosting | Not provisioned — requires founder's Railway account |
| Mobile app code | Onboarding + full World/You restructure built and verified (2026-07-12) — never visually verified on a real device/simulator |
| Mobile build infra | Done (`eas.json`, `DEPLOYMENT.md`) — usable for internal-testing builds now; hold public store submission on the items above and below |
| App store accounts | Not created — requires founder's Apple/Google accounts |
| Legal/store content | Not started (privacy policy, listing copy/screenshots) |
