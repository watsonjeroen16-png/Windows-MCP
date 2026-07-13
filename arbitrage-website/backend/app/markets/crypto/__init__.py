from app.markets.crypto.binance import BinanceAdapter
from app.markets.crypto.bitstamp import BitstampAdapter
from app.markets.crypto.coinbase import CoinbaseAdapter
from app.markets.crypto.kraken import KrakenAdapter


def default_crypto_adapters() -> list:
    return [BinanceAdapter(), KrakenAdapter(), CoinbaseAdapter(), BitstampAdapter()]


__all__ = [
    "BinanceAdapter",
    "BitstampAdapter",
    "CoinbaseAdapter",
    "KrakenAdapter",
    "default_crypto_adapters",
]
