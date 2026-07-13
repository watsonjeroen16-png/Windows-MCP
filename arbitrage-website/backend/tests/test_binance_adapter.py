import httpx
import respx

from app.markets.crypto.binance import BinanceAdapter


@respx.mock
async def test_binance_adapter_parses_prices():
    respx.get("https://api.binance.com/api/v3/ticker/price").mock(
        return_value=httpx.Response(
            200,
            json=[
                {"symbol": "BTCUSDT", "price": "50000.00"},
                {"symbol": "ETHUSDT", "price": "3000.00"},
                {"symbol": "SOMEOTHERPAIR", "price": "1.00"},
            ],
        )
    )

    adapter = BinanceAdapter(pairs=["BTC/USDT", "ETH/USDT"])
    async with httpx.AsyncClient() as client:
        quotes = await adapter.fetch_quotes(client)

    by_symbol = {q.symbol: q for q in quotes}
    assert len(quotes) == 2
    assert by_symbol["BTC/USDT"].price == 50000.00
    assert by_symbol["BTC/USDT"].source == "binance"
    assert by_symbol["ETH/USDT"].price == 3000.00


@respx.mock
async def test_binance_adapter_swallows_http_errors():
    respx.get("https://api.binance.com/api/v3/ticker/price").mock(
        return_value=httpx.Response(500)
    )

    adapter = BinanceAdapter(pairs=["BTC/USDT"])
    async with httpx.AsyncClient() as client:
        quotes = await adapter.fetch_quotes(client)

    assert quotes == []
