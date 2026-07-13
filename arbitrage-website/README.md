# Arbitrage Scanner

A two-agent arbitrage search app: a **Scanner** agent watches multiple
sources for price gaps, a **Validator** agent independently rechecks fees and
freshness before anything is called a real opportunity. Built as a separate
project from Windows-MCP (unrelated Python desktop-automation server that
lives elsewhere in this repo) — nothing here imports from `src/windows_mcp`.

Two services:

- **`backend/`** — Python/FastAPI. Runs the Scanner + Validator agents,
  serves validated opportunities over a REST API. See `backend/README.md`.
- **`frontend/`** — Next.js/TypeScript/Tailwind. Landing page + a live
  dashboard polling the backend. See `frontend/README.md`.

Full build plan and status: [`STEPS.md`](./STEPS.md).

## What's real right now

- **Crypto arbitrage** is fully wired end to end with real public exchange
  APIs (Binance, Kraken, Coinbase Exchange, Bitstamp) — no API keys needed.
- **Sports betting** and **retail** are documented extension points, not live
  yet (sports needs an API key you provide; retail needs a deliberate choice
  of a licensed data source instead of scraping). See `backend/README.md`
  "What's real vs. stubbed" and `STEPS.md` "Known gaps" for why.
- No payments/billing are wired up yet (by design, for this pass) — the
  frontend has a pricing placeholder only.

## Run it locally

Two terminals:

```bash
# Terminal 1 — backend
cd arbitrage-website/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd arbitrage-website/frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Then open http://localhost:3000. The dashboard at `/dashboard` polls the
backend every ~12s.

**Verified in this build**: both services were run together end-to-end (real
`uvicorn` + real `next dev`, not just each in isolation) — the frontend's
`/api/health` and `/api/opportunities` calls reach the backend, CORS is
correctly configured for `http://localhost:3000`, and the dashboard renders
the empty/error states correctly when there's no data yet.

**Not verified in this build**: live prices from the real exchange APIs. The
sandbox this was built in blocks outbound calls to third-party hosts
(everything returns 403 at the proxy), so the crypto adapters are tested
against mocked HTTP responses only (`backend/tests/`). Run the backend
somewhere with normal internet access and hit `POST /api/scan` to confirm
live data — see `backend/README.md` for details on that constraint.
