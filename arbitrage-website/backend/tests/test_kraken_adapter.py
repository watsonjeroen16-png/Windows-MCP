import httpx
import respx

from app.markets.crypto.kraken import KrakenAdapter


@respx.mock
async def test_kraken_adapter_handles_legacy_prefixed_keys():
    respx.get("https://api.kraken.com/0/public/Ticker").mock(
        return_value=httpx.Response(
            200,
            json={
                "error": [],
                "result": {
                    "XXBTZUSD": {"c": ["49950.5", "0.1"]},
                    "XBTUSDT": {"c": ["50010.0", "0.2"]},
                },
            },
        )
    )

    adapter = KrakenAdapter(pairs=["BTC/USD", "BTC/USDT"])
    async with httpx.AsyncClient() as client:
        quotes = await adapter.fetch_quotes(client)

    by_symbol = {q.symbol: q for q in quotes}
    assert len(quotes) == 2
    assert by_symbol["BTC/USD"].price == 49950.5
    assert by_symbol["BTC/USDT"].price == 50010.0
    assert all(q.source == "kraken" for q in quotes)
