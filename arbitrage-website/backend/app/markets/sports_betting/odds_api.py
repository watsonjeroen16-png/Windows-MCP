from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.markets.base import MarketAdapter
from app.models import MarketType, Quote

logger = logging.getLogger(__name__)

DEFAULT_SPORTS = ["americanfootball_nfl", "basketball_nba"]


class OddsApiAdapter(MarketAdapter):
    """Adapter for The Odds API (https://the-odds-api.com), head-to-head markets.

    Inert (returns no quotes, makes no network call) unless ARB_ODDS_API_KEY
    is set - no key is invented or assumed.

    IMPORTANT CAVEAT: this adapter fetches real per-bookmaker moneyline odds
    and emits one Quote per (event, outcome, bookmaker), with `price` holding
    the decimal odds. That is enough data to detect sports arbitrage, but the
    *math* is different from the crypto case: a crypto arbitrage compares the
    same symbol's price across sources (buy low, sell high); a sports
    arbitrage compares *different outcomes of the same event* across
    bookmakers and checks whether the sum of implied probabilities
    (1 / decimal_odds) across the best-priced outcome legs is < 1. The
    generic Scanner in this codebase only implements the same-symbol
    comparison, so sports quotes are fetched but not yet run through a
    same-symbol arbitrage check - a dedicated `sports_scanner` strategy is
    required before this market's results should be trusted end-to-end. See
    STEPS.md "Known gaps".
    """

    market = MarketType.SPORTS_BETTING
    name = "the_odds_api"

    def __init__(self, sports: list[str] | None = None) -> None:
        self.sports = sports or DEFAULT_SPORTS

    async def fetch_quotes(self, client: httpx.AsyncClient) -> list[Quote]:
        if not settings.odds_api_key:
            return []

        quotes: list[Quote] = []
        for sport in self.sports:
            try:
                resp = await client.get(
                    f"https://api.the-odds-api.com/v4/sports/{sport}/odds/",
                    params={
                        "apiKey": settings.odds_api_key,
                        "regions": "us",
                        "markets": "h2h",
                        "oddsFormat": "decimal",
                    },
                    timeout=10.0,
                )
                resp.raise_for_status()
                events = resp.json()
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("odds api fetch_quotes failed for %s: %s", sport, exc)
                continue

            for event in events:
                event_id = event.get("id")
                home = event.get("home_team")
                away = event.get("away_team")
                if not event_id or not home or not away:
                    continue
                for bookmaker in event.get("bookmakers", []):
                    book_key = bookmaker.get("key")
                    for market in bookmaker.get("markets", []):
                        if market.get("key") != "h2h":
                            continue
                        for outcome in market.get("outcomes", []):
                            try:
                                price = float(outcome["price"])
                            except (KeyError, TypeError, ValueError):
                                continue
                            symbol = f"{sport}:{event_id}:{outcome.get('name')}"
                            quotes.append(
                                Quote(
                                    market=self.market,
                                    symbol=symbol,
                                    source=book_key or "unknown",
                                    price=price,
                                    taker_fee_bps=0.0,
                                )
                            )
        return quotes
