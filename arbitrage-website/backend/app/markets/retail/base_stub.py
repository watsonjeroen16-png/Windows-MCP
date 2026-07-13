from __future__ import annotations

import httpx

from app.markets.base import MarketAdapter
from app.models import MarketType


class RetailAdapterStub(MarketAdapter):
    """Placeholder for retail/e-commerce price arbitrage.

    Deliberately not implemented against Amazon, Walmart, eBay, etc. by
    scraping: doing that typically violates those sites' Terms of Service and
    risks IP/account bans or legal exposure, and "guess a URL and scrape it"
    is exactly the kind of blind action this project was asked to avoid.

    To make this real, plug in an official/licensed data source here instead
    - e.g. a paid product-data or price-comparison API, or a retailer's own
    affiliate/partner API - and implement `fetch_quotes` the same way the
    crypto adapters do. That data-source choice needs a decision from the
    product owner before it's built, so this stays a stub until then. See
    STEPS.md "Known gaps".
    """

    market = MarketType.RETAIL
    name = "retail_stub"

    async def fetch_quotes(self, client: httpx.AsyncClient) -> list:
        raise NotImplementedError(
            "No retail data source is configured. Choose a licensed "
            "product-data/affiliate API and implement this adapter against "
            "it - see the module docstring."
        )
