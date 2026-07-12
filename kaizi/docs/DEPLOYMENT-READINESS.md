# Kaizi Deployment Readiness

One-page summary of what's ready to ship today, what's blocked purely on
founder-provided credentials/accounts, and what's blocked on the pending app
restructure. See `kaizi/docs/GETTING-CREDENTIALS.md` for beginner-friendly,
step-by-step instructions for every credential listed here.

## Ready today

**The backend is independently deployable right now.** It doesn't depend on
the app restructure decision — Intentions, chat, customization, and journal
are already built and tested server-side (see `kaizi/server/README.md`); only
the Expo screens that consume them don't exist yet.

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

## Blocked on the pending app restructure

**Do not run a production EAS build or submit to either app store until the
Retention Architect's redesign is approved by the founder and the resulting
screens are built.** The current app is onboarding-only (7 screens); the
Retention Architect is actively redesigning the overall screen structure
(collapsing into a World/You navigation model per the in-progress mockup) and
producing that mockup for founder approval right now. Shipping the current
screens to a store would be:

- Wasted engineering effort (a store-approved build of screens about to be
  restructured has near-zero shelf life), and
- A worse first impression than waiting, since the Companion World backend
  (Intentions, chat, customization, journal) is already built and tested but
  has **no consuming UI yet** — an app-store build today would ship
  onboarding with nowhere for the relationship to continue except SMS, which
  is intentional for the *current* MVP scope but not what the founder is
  actually trying to launch.

What's ready the moment the restructure is approved and built: `eas.json`
build profiles, `kaizi/app/DEPLOYMENT.md` submission steps, and (once
credentials in the table above are in hand) a clear path from `eas build
--profile production` to both stores with no further infrastructure work
needed. The gate is purely a product/design decision, not a technical one.

## Summary

| Layer | Status |
|---|---|
| Server code | Done, tested, deployable today (needs founder credentials from the table above) |
| Server CI/CD infra | Done (`kaizi-ci.yml`, `Dockerfile`, `docker-compose.yml`, `DEPLOYMENT.md`) |
| Server hosting | Not provisioned — requires founder's Railway account |
| Mobile app code | Onboarding-only; Companion World UI not started (separate from this deployment work) |
| Mobile build infra | Done (`eas.json`, `DEPLOYMENT.md`) — **held**, do not ship a build yet |
| App store accounts | Not created — requires founder's Apple/Google accounts |
| Legal/store content | Not started (privacy policy, listing copy/screenshots) |
