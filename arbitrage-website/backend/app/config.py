from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ARB_", env_file=".env", extra="ignore")

    # Canonical "BASE/QUOTE" pairs the crypto adapters try to cover. Each
    # adapter maps these to its own venue-specific symbol format and silently
    # skips pairs it doesn't list.
    crypto_pairs: list[str] = ["BTC/USDT", "ETH/USDT", "BTC/USD", "ETH/USD"]

    # How often the orchestrator runs a full Scanner -> Validator cycle.
    scan_interval_seconds: float = 20.0

    # Validator thresholds.
    min_net_profit_pct: float = 0.05  # candidates below this net % are dropped
    max_quote_age_seconds: float = 30.0  # candidates built from stale quotes are dropped

    # Sports betting: The Odds API key. Adapter is a no-op without it.
    odds_api_key: str | None = None

    # CORS origins for the Next.js frontend during local dev.
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
