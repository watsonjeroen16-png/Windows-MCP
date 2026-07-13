from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.markets.base import MarketAdapter
from app.models import MarketType, Quote

logger = logging.getLogger(__name__)

TAKER_FEE_BPS = 26.0  # Kraken spot lowest-tier taker fee, 0.26%

_ASSET_ALIASES = {"BTC": "XBT"}


def _to_kraken_param(pair: str) -> str | None:
    base, _, quote = pair.partition("/")
    if not quote:
        return None
    base = _ASSET_ALIASES.get(base, base)
    return f"{base}{quote}".upper()


def _normalize(code: str) -> str:
    """Best-effort match key for Kraken's inconsistent X/Z asset prefixing.

    Kraken sometimes returns pair keys with legacy 'X'/'Z' prefixes on each
    leg (e.g. "XXBTZUSD" for BTC/USD) and sometimes without (e.g. "XBTUSDT").
    Stripping X/Z lets both forms match the same target. This is a heuristic:
    it will misfire for assets whose real ticker legitimately contains X or Z
    (e.g. XRP, ZEC) - those need an exact AssetPairs lookup instead, which is
    out of scope for the default BTC/ETH pairs this adapter ships with.
    """
    return code.upper().replace("X", "").replace("Z", "")


class KrakenAdapter(MarketAdapter):
    market = MarketType.CRYPTO
    name = "kraken"

    def __init__(self, pairs: list[str] | None = None) -> None:
        self.pairs = pairs or settings.crypto_pairs
        self._param_map = {
            param: pair
            for pair in self.pairs
            if (param := _to_kraken_param(pair)) is not None
        }

    async def fetch_quotes(self, client: httpx.AsyncClient) -> list[Quote]:
        if not self._param_map:
            return []
        try:
            resp = await client.get(
                "https://api.kraken.com/0/public/Ticker",
                params={"pair": ",".join(self._param_map)},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("kraken fetch_quotes failed: %s", exc)
            return []

        if data.get("error"):
            logger.warning("kraken API error: %s", data["error"])

        result = data.get("result", {})
        normalized_targets = {_normalize(param): pair for param, pair in self._param_map.items()}

        quotes: list[Quote] = []
        for key, ticker in result.items():
            pair = normalized_targets.get(_normalize(key))
            if pair is None:
                continue
            try:
                price = float(ticker["c"][0])  # last trade closeout price
            except (KeyError, IndexError, TypeError, ValueError):
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
