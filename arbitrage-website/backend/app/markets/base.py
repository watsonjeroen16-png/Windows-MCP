from __future__ import annotations

from abc import ABC, abstractmethod

import httpx

from app.models import MarketType, Quote


class MarketAdapter(ABC):
    """Common interface every market/source plugin implements.

    Adding a new market (a new exchange, sportsbook, retailer, ...) means
    writing one of these and registering an instance with the Scanner -
    nothing else in the pipeline needs to change.
    """

    market: MarketType
    name: str

    @abstractmethod
    async def fetch_quotes(self, client: httpx.AsyncClient) -> list[Quote]:
        """Return current quotes for whatever instruments this adapter covers.

        Must not raise on routine failures (timeouts, bad responses) - log/
        swallow and return an empty list so one broken source doesn't take
        down a scan cycle. Only raise for programmer errors.
        """
        raise NotImplementedError
