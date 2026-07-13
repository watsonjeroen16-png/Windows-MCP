from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.markets.base import MarketAdapter
from app.models import MarketType, Quote

logger = logging.getLogger(__name__)

TAKER_FEE_BPS = 10.0  # Binance spot default taker fee, 0.10%


def _to_binance_symbol(pair: str) -> str | None:
    base, _, quote = pair.partition("/")
    if not quote:
        return None
    return f"{base}{quote}".upper()


class BinanceAdapter(MarketAdapter):
    market = MarketType.CRYPTO
    name = "binance"

    def __init__(self, pairs: list[str] | None = None) -> None:
        self.pairs = pairs or settings.crypto_pairs
        self._symbol_map = {
            sym: pair
            for pair in self.pairs
            if (sym := _to_binance_symbol(pair)) is not None
        }

    async def fetch_quotes(self, client: httpx.AsyncClient) -> list[Quote]:
        if not self._symbol_map:
            return []
        try:
            resp = await client.get(
                "https://api.binance.com/api/v3/ticker/price",
                params={"symbols": str(list(self._symbol_map)).replace("'", '"')},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("binance fetch_quotes failed: %s", exc)
            return []

        quotes: list[Quote] = []
        for row in data:
            pair = self._symbol_map.get(row.get("symbol", ""))
            if pair is None:
                continue
            try:
                price = float(row["price"])
            except (KeyError, TypeError, ValueError):
                continue
            quotes.append(
                Quote(
                    market=self.market,
                    symbol=pair,
                    source=self.name,
                    price=price,
                    taker_fee_bps=TAKER_FEE_BPS,
                )
            )
        return quotes
