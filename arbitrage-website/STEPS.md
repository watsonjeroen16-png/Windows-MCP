# Build Plan — Arbitrage Scanner (STEPS.md)

This file is the working plan for building this project. Any subagent picking up
work here should read this file first, find the first unchecked step in their
area, do it, check it off, and leave notes for the next step if something was
deferred or changed from the original plan.

## Product decisions locked in (from user clarification, 2026-07-13)

- **Markets**: not limited to one — architecture must support crypto, sports
  betting, retail/e-commerce, and "other" markets via a plugin interface. First
  fully-implemented market is **crypto exchange arbitrage** (cleanest public
  APIs, no user-supplied keys required). Sports betting and retail are wired in
  as documented extension points, not fully live yet (see "Known gaps" below).
- **Two agents**: `Scanner` (Agent 1) continuously polls all registered market
  adapters and emits raw candidate spreads. `Validator` (Agent 2) re-checks each
  candidate against fees, minimum trade sizes, and staleness, and only promotes
  candidates that clear a net-profit threshold, attaching a confidence score.
  An `Orchestrator` runs Scanner → Validator on an interval and caches the
  latest validated opportunities.
- **Scope for this pass**: real data sources, no payments/billing yet.
- **Stack**: Python (FastAPI) backend for the agents + API, Next.js
  (TypeScript + Tailwind) frontend for the dashboard. Chosen because the
  scanning/validation logic benefits from Python's async HTTP + data tooling,
  and Next.js is a fast path to a clean SaaS-style dashboard that can later grow
  a paywall.
- **Location**: new top-level folder `arbitrage-website/` in this repo, fully
  separate from `src/windows_mcp` (the existing MCP server). Nothing here
  should import from or depend on the Windows-MCP package.

## Known gaps / things flagged to the user, not silently skipped

- **Sandbox network policy**: this build environment's egress proxy blocks
  calls to third-party hosts (exchange APIs, odds APIs, etc. all returned 403
  during development). The adapter code targets real, well-known public
  endpoints and is unit-tested with mocked HTTP responses, but it has **not**
  been live-tested against the real internet from this session. It should work
  once run somewhere with normal outbound access (e.g. the user's machine or a
  normal deployment target) — but confirm with a real run before trusting it in
  production.
- **Retail/e-commerce arbitrage**: scraping major retailers (Amazon, Walmart,
  eBay, etc.) directly typically violates their Terms of Service and can get
  IPs/accounts banned or invite legal risk. This build does **not** implement
  direct scraping of those sites. The retail adapter is a stub with a clear
  interface, documented to be filled in with an official/affiliate API (e.g. a
  paid product-data API) rather than scraping — this decision should be
  revisited explicitly with the user before writing a scraper.
- **Sports betting arbitrage**: odds data generally requires a paid/keyed API
  (e.g. The Odds API). The adapter is implemented against that API's documented
  shape but is inert without an `ODDS_API_KEY` — no key is assumed or invented.
- **No payments**: Stripe/subscriptions intentionally out of scope for this
  pass per user's answer. Frontend has a pricing placeholder only.

## Step checklist

### Backend (`arbitrage-website/backend`)
- [x] Scaffold `pyproject.toml`, package layout, FastAPI app skeleton.
- [x] `models.py`: `MarketType`, `Quote`, `Opportunity`, `ValidatedOpportunity`.
- [x] `markets/base.py`: `MarketAdapter` ABC (`async fetch_quotes() -> list[Quote]`).
- [x] `markets/crypto/`: Binance, Kraken, Coinbase Exchange, Bitstamp adapters
      (public REST, no auth) for a configurable list of trading pairs.
- [x] `markets/sports_betting/odds_api.py`: adapter stub against The Odds API
      shape, no-ops cleanly if `ODDS_API_KEY` unset.
- [x] `markets/retail/base_stub.py`: documented stub only, raises
      `NotImplementedError` with an explanation instead of scraping anything.
- [x] `agents/scanner.py`: fans out to all registered adapters concurrently,
      computes raw cross-source spreads per symbol/market.
- [x] `agents/validator.py`: applies per-venue taker fees + a min-spread
      threshold, computes net profit %, assigns confidence score, drops the rest.
- [x] `agents/orchestrator.py`: interval loop wiring Scanner → Validator,
      keeps latest results in memory, exposes them to the API layer.
- [x] `api/routes.py`: `GET /api/health`, `GET /api/opportunities`,
      `GET /api/opportunities/{market}`, `POST /api/scan` (manual trigger).
- [x] `main.py`: FastAPI app wiring, CORS for the frontend, startup hook that
      launches the orchestrator loop as a background task.
- [x] Unit tests with mocked HTTP (respx) for scanner + validator math and at
      least one crypto adapter's parsing logic.
- [x] `README.md` in `backend/` with run instructions and required env vars.

### Frontend (`arbitrage-website/frontend`)
- [x] Scaffold Next.js + TypeScript + Tailwind app.
- [x] Dashboard page: table of live opportunities (market, pair/event, buy
      source, sell source, spread %, net profit %, confidence, age), polling
      the backend on an interval.
- [x] Market filter tabs (Crypto / Sports / Retail / All), empty states for
      markets with no adapter live yet.
- [x] Landing/marketing section explaining the product, with a pricing
      placeholder section marked "coming soon" (no real billing wired up).
- [x] `README.md` in `frontend/` with run instructions and required env vars.

### Repo-level
- [x] Top-level `arbitrage-website/README.md` explaining the two-service
      layout, how to run both locally, and what's real vs. stubbed.
- [x] Confirm nothing here touches `src/windows_mcp` or repo-root tooling
      configs (this repo's `pyproject.toml`, `ruff` config, etc. stay untouched).
- [ ] Commit and push to `claude/arbitrage-search-website-c0pvs5`.

## Next steps after this pass (not started, for a future session)

- Live-test the crypto adapters against the real internet outside this sandbox.
- Get a decision from the user on a real retail data source before writing
  any retail integration.
- Get an `ODDS_API_KEY` from the user (or a decision to defer sports betting)
  before treating that adapter as live.
- Add persistence (opportunities history, users) and Stripe billing once the
  core product is validated.
