import httpx

from app.agents.scanner import Scanner
from app.markets.base import MarketAdapter
from app.models import MarketType, Quote


class _FakeAdapter(MarketAdapter):
    market = MarketType.CRYPTO

    def __init__(self, name: str, quotes: list[Quote]):
        self.name = name
        self._quotes = quotes

    async def fetch_quotes(self, client: httpx.AsyncClient) -> list[Quote]:
        return self._quotes


def _quote(source: str, price: float, symbol: str = "BTC/USDT") -> Quote:
    return Quote(market=MarketType.CRYPTO, symbol=symbol, source=source, price=price)


async def test_scanner_finds_cross_source_spread():
    adapter_a = _FakeAdapter("exch_a", [_quote("exch_a", 100.0)])
    adapter_b = _FakeAdapter("exch_b", [_quote("exch_b", 105.0)])
    scanner = Scanner([adapter_a, adapter_b])

    async with httpx.AsyncClient() as client:
        candidates = await scanner.scan(client)

    assert len(candidates) == 1
    c = candidates[0]
    assert c.buy_source == "exch_a"
    assert c.buy_price == 100.0
    assert c.sell_source == "exch_b"
    assert c.sell_price == 105.0
    assert c.gross_spread_pct == 5.0


async def test_scanner_ignores_single_source_symbols():
    adapter_a = _FakeAdapter("exch_a", [_quote("exch_a", 100.0, symbol="ETH/USDT")])
    scanner = Scanner([adapter_a])

    async with httpx.AsyncClient() as client:
        candidates = await scanner.scan(client)

    assert candidates == []


async def test_scanner_survives_a_failing_adapter():
    class _BrokenAdapter(MarketAdapter):
        market = MarketType.CRYPTO
        name = "broken"

        async def fetch_quotes(self, client: httpx.AsyncClient) -> list[Quote]:
            raise RuntimeError("boom")

    adapter_a = _FakeAdapter("exch_a", [_quote("exch_a", 100.0)])
    adapter_b = _FakeAdapter("exch_b", [_quote("exch_b", 110.0)])
    scanner = Scanner([_BrokenAdapter(), adapter_a, adapter_b])

    async with httpx.AsyncClient() as client:
        candidates = await scanner.scan(client)

    assert len(candidates) == 1
