from __future__ import annotations

import asyncio
import logging

import httpx

from app.config import settings
from app.markets.base import MarketAdapter
from app.models import MarketType, Quote

logger = logging.getLogger(__name__)

TAKER_FEE_BPS = 40.0  # Bitstamp lowest-tier taker fee, ~0.40%


def _to_bitstamp_pair(pair: str) -> str | None:
    base, _, quote = pair.partition("/")
    if not quote:
        return None
    return f"{base}{quote}".lower()


class BitstampAdapter(MarketAdapter):
    """Bitstamp public ticker API. One request per pair, fetched concurrently."""

    market = MarketType.CRYPTO
    name = "bitstamp"

    def __init__(self, pairs: list[str] | None = None) -> None:
        self.pairs = pairs or settings.crypto_pairs
        self._pair_map = {
            symbol: pair
            for pair in self.pairs
            if (symbol := _to_bitstamp_pair(pair)) is not None
        }

    async def _fetch_one(self, client: httpx.AsyncClient, symbol: str, pair: str) -> Quote | None:
        try:
            resp = await client.get(
                f"https://www.bitstamp.net/api/v2/ticker/{symbol}/",
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            price = float(data["last"])
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            logger.warning("bitstamp fetch_quotes failed for %s: %s", symbol, exc)
            return None
        return Quote(
            market=self.market,
            symbol=pair,
            source=self.name,
            price=price,
            taker_fee_bps=TAKER_FEE_BPS,
        )

    async def fetch_quotes(self, client: httpx.AsyncClient) -> list[Quote]:
        if not self._pair_map:
            return []
        results = await asyncio.gather(
            *(self._fetch_one(client, symbol, pair) for symbol, pair in self._pair_map.items())
        )
        return [q for q in results if q is not None]
