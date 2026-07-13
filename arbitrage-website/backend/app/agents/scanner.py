from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

import httpx

from app.markets.base import MarketAdapter
from app.models import MarketType, Opportunity, Quote

logger = logging.getLogger(__name__)


class Scanner:
    """Agent 1: polls every registered market adapter and emits raw candidate
    spreads. Does no fee/risk filtering - that's the Validator's job."""

    def __init__(self, adapters: list[MarketAdapter]):
        self.adapters = adapters

    async def scan(self, client: httpx.AsyncClient) -> list[Opportunity]:
        results = await asyncio.gather(
            *(self._safe_fetch(adapter, client) for adapter in self.adapters)
        )
        quotes: list[Quote] = [q for batch in results for q in batch]
        return self._find_candidates(quotes)

    async def _safe_fetch(self, adapter: MarketAdapter, client: httpx.AsyncClient) -> list[Quote]:
        try:
            return await adapter.fetch_quotes(client)
        except Exception:
            logger.exception("adapter %s raised during fetch_quotes", adapter.name)
            return []

    def _find_candidates(self, quotes: list[Quote]) -> list[Opportunity]:
        grouped: dict[tuple[MarketType, str], list[Quote]] = defaultdict(list)
        for q in quotes:
            grouped[(q.market, q.symbol)].append(q)

        candidates: list[Opportunity] = []
        for (market, symbol), group in grouped.items():
            if len(group) < 2:
                continue
            cheapest = min(group, key=lambda q: q.price)
            priciest = max(group, key=lambda q: q.price)
            if priciest.source == cheapest.source or cheapest.price <= 0:
                continue
            gross_spread_pct = (priciest.price - cheapest.price) / cheapest.price * 100
            if gross_spread_pct <= 0:
                continue
            candidates.append(
                Opportunity(
                    market=market,
                    symbol=symbol,
                    buy_source=cheapest.source,
                    buy_price=cheapest.price,
                    buy_fee_bps=cheapest.taker_fee_bps,
                    buy_observed_at=cheapest.observed_at,
                    sell_source=priciest.source,
                    sell_price=priciest.price,
                    sell_fee_bps=priciest.taker_fee_bps,
                    sell_observed_at=priciest.observed_at,
                    gross_spread_pct=gross_spread_pct,
                )
            )
        return candidates
