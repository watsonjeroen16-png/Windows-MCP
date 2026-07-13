"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getOpportunities,
  getOpportunitiesByMarket,
  type MarketType,
  type ValidatedOpportunity,
} from "@/lib/api";
import { formatAge } from "@/lib/time";
import { confidenceClasses, formatPct, formatPrice, netProfitClasses } from "@/lib/format";
import ReasonsCell from "@/components/ReasonsCell";

const POLL_INTERVAL_MS = 12_000;
const CLOCK_TICK_MS = 1_000;

type FilterValue = "all" | MarketType;

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Crypto", value: "crypto" },
  { label: "Sports Betting", value: "sports_betting" },
  { label: "Retail", value: "retail" },
];

const MARKET_LABELS: Record<MarketType, string> = {
  crypto: "Crypto",
  sports_betting: "Sports Betting",
  retail: "Retail",
};

function sortByNetProfitDesc(items: ValidatedOpportunity[]): ValidatedOpportunity[] {
  return [...items].sort((a, b) => b.net_profit_pct - a.net_profit_pct);
}

export default function DashboardClient() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [opportunities, setOpportunities] = useState<ValidatedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fetchData = useCallback(async (activeFilter: FilterValue) => {
    try {
      const data =
        activeFilter === "all"
          ? await getOpportunities()
          : await getOpportunitiesByMarket(activeFilter);
      setOpportunities(sortByNetProfitDesc(data));
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reach the backend API."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + refetch whenever the filter changes.
  useEffect(() => {
    setLoading(true);
    fetchData(filter);
  }, [filter, fetchData]);

  // Poll on an interval.
  useEffect(() => {
    const id = setInterval(() => {
      fetchData(filter);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [filter, fetchData]);

  // Tick a clock so "Age" cells stay fresh between polls.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const isEmpty = !loading && opportunities.length === 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500">
          {lastUpdated
            ? `Last refreshed ${formatAge(new Date(lastUpdated).toISOString(), now)}`
            : loading
              ? "Loading…"
              : null}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Couldn&apos;t reach the backend API ({error}). Showing the last
          known data, if any. Make sure the FastAPI backend is running.
        </div>
      )}

      {loading && opportunities.length === 0 && !error ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Loading opportunities…
        </div>
      ) : isEmpty ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          {filter === "sports_betting" || filter === "retail" ? (
            <>
              No live opportunities yet for this market &mdash; this data
              source is still being connected.
            </>
          ) : (
            <>No opportunities found right now. Check back shortly.</>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Buy @</th>
                <th className="px-4 py-3">Sell @</th>
                <th className="px-4 py-3">Gross Spread %</th>
                <th className="px-4 py-3">Net Profit %</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {opportunities.map((opp, idx) => (
                <tr key={`${opp.market}-${opp.symbol}-${opp.buy_source}-${opp.sell_source}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">
                    {MARKET_LABELS[opp.market] ?? opp.market}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {opp.symbol}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="text-slate-500">{opp.buy_source}</span>{" "}
                    @ {formatPrice(opp.buy_price)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="text-slate-500">{opp.sell_source}</span>{" "}
                    @ {formatPrice(opp.sell_price)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatPct(opp.gross_spread_pct)}
                  </td>
                  <td className={`px-4 py-3 ${netProfitClasses(opp.net_profit_pct)}`}>
                    {formatPct(opp.net_profit_pct)}
                  </td>
                  <td className={`px-4 py-3 ${confidenceClasses(opp.confidence)}`}>
                    {(opp.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatAge(opp.observed_at, now)}
                  </td>
                  <td className="px-4 py-3">
                    <ReasonsCell reasons={opp.reasons} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
