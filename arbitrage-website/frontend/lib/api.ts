// Typed client for the Arbitrage Scanner FastAPI backend.
//
// Base URL is read from NEXT_PUBLIC_API_URL, falling back to the local dev
// default so `npm run dev` works out of the box with the backend running
// on its default port.

export type MarketType = "crypto" | "sports_betting" | "retail";

export interface ValidatedOpportunity {
  market: MarketType;
  symbol: string;
  buy_source: string;
  buy_price: number;
  sell_source: string;
  sell_price: number;
  gross_spread_pct: number;
  net_profit_pct: number;
  confidence: number;
  reasons: string[];
  observed_at: string;
}

export interface HealthResponse {
  status: string;
  last_run_at: string | null;
  opportunity_count: number;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore body-read failures, we still have the status
    }
    throw new Error(
      `Request to ${path} failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`
    );
  }

  return (await res.json()) as T;
}

/** Fetch every currently-known validated opportunity, across all markets. */
export function getOpportunities(): Promise<ValidatedOpportunity[]> {
  return request<ValidatedOpportunity[]>("/api/opportunities");
}

/** Fetch validated opportunities for a single market. */
export function getOpportunitiesByMarket(
  market: MarketType
): Promise<ValidatedOpportunity[]> {
  return request<ValidatedOpportunity[]>(`/api/opportunities/${market}`);
}

/** Trigger an immediate scan cycle; returns the freshly computed opportunities. */
export function triggerScan(): Promise<ValidatedOpportunity[]> {
  return request<ValidatedOpportunity[]>("/api/scan", { method: "POST" });
}

/** Fetch backend health / last-run metadata. */
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export { API_BASE_URL };
