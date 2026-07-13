from datetime import datetime, timedelta, timezone

from app.agents.validator import Validator
from app.models import MarketType, Opportunity


def _opportunity(
    gross_spread_pct: float,
    buy_fee_bps: float = 10.0,
    sell_fee_bps: float = 10.0,
    buy_age_seconds: float = 0.0,
    sell_age_seconds: float = 0.0,
    now: datetime | None = None,
) -> Opportunity:
    now = now or datetime.now(timezone.utc)
    return Opportunity(
        market=MarketType.CRYPTO,
        symbol="BTC/USDT",
        buy_source="a",
        buy_price=100.0,
        buy_fee_bps=buy_fee_bps,
        buy_observed_at=now - timedelta(seconds=buy_age_seconds),
        sell_source="b",
        sell_price=100.0 * (1 + gross_spread_pct / 100),
        sell_fee_bps=sell_fee_bps,
        sell_observed_at=now - timedelta(seconds=sell_age_seconds),
        gross_spread_pct=gross_spread_pct,
    )


async def test_validator_computes_net_profit_after_fees():
    validator = Validator(min_net_profit_pct=0.05, max_quote_age_seconds=30)
    now = datetime.now(timezone.utc)
    opp = _opportunity(gross_spread_pct=1.0, buy_fee_bps=10, sell_fee_bps=10, now=now)

    validated = validator.validate([opp], now=now)

    assert len(validated) == 1
    # 1.0% gross - (10+10)bps == 1.0% - 0.20% == 0.80%
    assert round(validated[0].net_profit_pct, 4) == 0.80


async def test_validator_drops_below_threshold():
    validator = Validator(min_net_profit_pct=0.5, max_quote_age_seconds=30)
    now = datetime.now(timezone.utc)
    opp = _opportunity(gross_spread_pct=0.3, buy_fee_bps=10, sell_fee_bps=10, now=now)

    validated = validator.validate([opp], now=now)

    assert validated == []


async def test_validator_drops_stale_quotes():
    validator = Validator(min_net_profit_pct=0.05, max_quote_age_seconds=10)
    now = datetime.now(timezone.utc)
    opp = _opportunity(gross_spread_pct=5.0, buy_age_seconds=60, now=now)

    validated = validator.validate([opp], now=now)

    assert validated == []


async def test_validator_confidence_rewards_margin_and_freshness():
    validator = Validator(min_net_profit_pct=0.01, max_quote_age_seconds=30)
    now = datetime.now(timezone.utc)

    strong = _opportunity(gross_spread_pct=2.0, buy_fee_bps=0, sell_fee_bps=0, now=now)
    weak = _opportunity(
        gross_spread_pct=0.05, buy_fee_bps=0, sell_fee_bps=0, sell_age_seconds=25, now=now
    )

    [strong_validated] = validator.validate([strong], now=now)
    [weak_validated] = validator.validate([weak], now=now)

    assert strong_validated.confidence > weak_validated.confidence
