from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class MarketType(str, Enum):
    CRYPTO = "crypto"
    SPORTS_BETTING = "sports_betting"
    RETAIL = "retail"


class Quote(BaseModel):
    """A single price observation for one instrument at one source."""

    market: MarketType
    symbol: str  # e.g. "BTC/USDT" for crypto, "LAL@BOS ML" for sports
    source: str  # e.g. "binance", "kraken", "draftkings"
    price: float
    taker_fee_bps: float = 0.0  # fee in basis points charged to act on this quote
    min_size: float | None = None  # smallest tradable/bettable size, if known
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Opportunity(BaseModel):
    """A raw candidate spread found by the Scanner, before fee/risk validation."""

    market: MarketType
    symbol: str
    buy_source: str
    buy_price: float
    buy_fee_bps: float = 0.0
    buy_observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sell_source: str
    sell_price: float
    sell_fee_bps: float = 0.0
    sell_observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    gross_spread_pct: float
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ValidatedOpportunity(BaseModel):
    """An Opportunity that has passed the Validator's fee/risk checks."""

    market: MarketType
    symbol: str
    buy_source: str
    buy_price: float
    sell_source: str
    sell_price: float
    gross_spread_pct: float
    net_profit_pct: float
    confidence: float  # 0-1, higher is better
    reasons: list[str] = Field(default_factory=list)
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
