from __future__ import annotations

import asyncio
import logging

import httpx

from app.config import settings
from app.markets.base import MarketAdapter
from app.models import MarketType, Quote

logger = logging.getLogger(__name__)

TAKER_FEE_BPS = 60.0  # Coinbase Exchange lowest-tier taker fee, 0.60%


def _to_product_id(pair: str) -> str | None:
    base, _, quote = pair.partition("/")
    if not quote:
        return None
    return f"{base}-{quote}".upper()


class CoinbaseAdapter(MarketAdapter):
    """Coinbase Exchange public ticker API. One request per product - there is
    no batch endpoint - so quotes are fetched concurrently."""

    market = MarketType.CRYPTO
    name = "coinbase"

    def __init__(self, pairs: list[str] | None = None) -> None:
        self.pairs = pairs or settings.crypto_pairs
        self._product_map = {
            product: pair
            for pair in self.pairs
            if (product := _to_product_id(pair)) is not None
        }

    async def _fetch_one(self, client: httpx.AsyncClient, product_id: str, pair: str) -> Quote | None:
        try:
            resp = await client.get(
                f"https://api.exchange.coinbase.com/products/{product_id}/ticker",
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            price = float(data["price"])
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            logger.warning("coinbase fetch_quotes failed for %s: %s", product_id, exc)
            return None
        return Quote(
            market=self.market,
            symbol=pair,
            source=self.name,
            price=price,
            taker_fee_bps=TAKER_FEE_BPS,
        )

    async def fetch_quotes(self, client: httpx.AsyncClient) -> list[Quote]:
        if not self._product_map:
            return []
        results = await asyncio.gather(
            *(self._fetch_one(client, product, pair) for product, pair in self._product_map.items())
        )
        return [q for q in results if q is not None]
