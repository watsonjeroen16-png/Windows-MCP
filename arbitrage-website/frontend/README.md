# Arbitrage Scanner — Frontend

A Next.js (App Router, TypeScript, Tailwind CSS) dashboard for the Arbitrage
Scanner project. It shows a marketing/landing page explaining the two-agent
scanning architecture, plus a live dashboard that polls the backend for
validated arbitrage opportunities across crypto, sports betting, and retail
markets.

This is the frontend half of the project; the API it talks to is the FastAPI
backend in [`../backend`](../backend).

## Install

```bash
npm install
```

## Configure

The frontend reads the backend's base URL from `NEXT_PUBLIC_API_URL`. Create
a `.env.local` file in this directory (see `.env.local.example`):

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If unset, it falls back to `http://localhost:8000`.

## Run (development)

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

The dashboard at `/dashboard` polls `GET /api/opportunities` (or
`GET /api/opportunities/{market}` when filtered) every ~12 seconds. It
expects the FastAPI backend in `../backend` to be running for real data —
without it, the dashboard shows an inline "can't reach the backend" message
instead of crashing.

## Build

```bash
npm run build
npm run start
```
