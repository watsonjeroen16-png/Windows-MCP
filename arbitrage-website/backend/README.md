# Arbitrage Scanner — backend

FastAPI service running the two agents:

- **Scanner** (`app/agents/scanner.py`) — polls every registered market
  adapter concurrently and finds raw cross-source price spreads.
- **Validator** (`app/agents/validator.py`) — re-checks each candidate
  against taker fees and quote staleness, computes net profit %, and assigns
  a confidence score. Only candidates that clear the thresholds survive.
- **Orchestrator** (`app/agents/orchestrator.py`) — runs Scanner → Validator
  on an interval and caches the latest validated opportunities for the API.

Markets are plugins (`app/markets/base.py: MarketAdapter`). Adding a new
source means writing one `fetch_quotes()` implementation and registering it —
nothing else in the pipeline changes.

## What's real vs. stubbed right now

- **Crypto** (`app/markets/crypto/`): real public REST clients for Binance,
  Kraken, Coinbase Exchange, and Bitstamp. No API keys required. This is the
  fully-wired path end to end (Scanner and Validator both operate on it).
- **Sports betting** (`app/markets/sports_betting/odds_api.py`): real client
  for The Odds API, but inert until `ARB_ODDS_API_KEY` is set, and its output
  isn't yet run through a market-appropriate arbitrage check (see the
  docstring in that file, and `../STEPS.md`).
- **Retail** (`app/markets/retail/base_stub.py`): intentionally unimplemented.
  Scraping major retailers generally violates their Terms of Service; this
  needs a licensed data source chosen deliberately, not a scraper written
  blindly. Raises `NotImplementedError` with an explanation.

**Note on this development environment**: the sandbox this was built in
blocks outbound calls to third-party hosts, so the crypto adapters have been
tested with mocked HTTP responses (`tests/`) but not against the live
internet. They should work wherever this runs with normal network access —
verify with a real run before trusting it in production.

## Run it

```bash
cd arbitrage-website/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

## Test it

```bash
pytest
```

## Config (env vars, prefix `ARB_`)

| Variable | Default | Description |
|---|---|---|
| `ARB_CRYPTO_PAIRS` | `["BTC/USDT","ETH/USDT","BTC/USD","ETH/USD"]` | Canonical pairs the crypto adapters try to cover. |
| `ARB_SCAN_INTERVAL_SECONDS` | `20.0` | How often the orchestrator runs a full scan cycle. |
| `ARB_MIN_NET_PROFIT_PCT` | `0.05` | Minimum net profit % (after fees) for a candidate to survive validation. |
| `ARB_MAX_QUOTE_AGE_SECONDS` | `30.0` | Quotes older than this are treated as stale and dropped. |
| `ARB_ODDS_API_KEY` | unset | The Odds API key. Sports betting adapter is a no-op without it. |
| `ARB_CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed origins for the frontend. |

## API

- `GET /api/health`
- `GET /api/opportunities`
- `GET /api/opportunities/{market}` — `market` is one of `crypto`, `sports_betting`, `retail`
- `POST /api/scan` — trigger an immediate scan cycle
