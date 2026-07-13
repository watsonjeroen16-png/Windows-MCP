from __future__ import annotations

from datetime import datetime, timezone

from app.config import settings
from app.models import Opportunity, ValidatedOpportunity


class Validator:
    """Agent 2: re-checks each Scanner candidate against fees and staleness,
    computes net profit after both legs' taker fees, and assigns a confidence
    score. Candidates that don't clear the configured thresholds are dropped."""

    def __init__(
        self,
        min_net_profit_pct: float | None = None,
        max_quote_age_seconds: float | None = None,
    ):
        self.min_net_profit_pct = (
            min_net_profit_pct if min_net_profit_pct is not None else settings.min_net_profit_pct
        )
        self.max_quote_age_seconds = (
            max_quote_age_seconds
            if max_quote_age_seconds is not None
            else settings.max_quote_age_seconds
        )

    def validate(
        self, candidates: list[Opportunity], now: datetime | None = None
    ) -> list[ValidatedOpportunity]:
        now = now or datetime.now(timezone.utc)
        validated: list[ValidatedOpportunity] = []
        for c in candidates:
            result = self._validate_one(c, now)
            if result is not None:
                validated.append(result)
        return validated

    def _validate_one(self, c: Opportunity, now: datetime) -> ValidatedOpportunity | None:
        reasons: list[str] = []

        buy_age = (now - c.buy_observed_at).total_seconds()
        sell_age = (now - c.sell_observed_at).total_seconds()
        if buy_age > self.max_quote_age_seconds or sell_age > self.max_quote_age_seconds:
            return None

        total_fee_pct = (c.buy_fee_bps + c.sell_fee_bps) / 100
        net_profit_pct = c.gross_spread_pct - total_fee_pct

        if net_profit_pct < self.min_net_profit_pct:
            return None

        confidence = self._confidence(net_profit_pct, buy_age, sell_age, reasons)

        return ValidatedOpportunity(
            market=c.market,
            symbol=c.symbol,
            buy_source=c.buy_source,
            buy_price=c.buy_price,
            sell_source=c.sell_source,
            sell_price=c.sell_price,
            gross_spread_pct=c.gross_spread_pct,
            net_profit_pct=net_profit_pct,
            confidence=confidence,
            reasons=reasons,
            observed_at=c.observed_at,
        )

    def _confidence(
        self, net_profit_pct: float, buy_age: float, sell_age: float, reasons: list[str]
    ) -> float:
        # Bigger net margins and fresher quotes both raise confidence. This is
        # a simple heuristic, not a statistical model - it exists so obviously
        # thin/stale candidates rank below clearly-real ones in the UI.
        margin_score = min(net_profit_pct / 1.0, 1.0)  # saturates at 1% net profit
        freshness_score = 1.0 - min(max(buy_age, sell_age) / self.max_quote_age_seconds, 1.0)
        confidence = round(0.7 * margin_score + 0.3 * freshness_score, 3)

        if margin_score < 0.3:
            reasons.append("thin net margin")
        if freshness_score < 0.5:
            reasons.append("quotes nearing staleness cutoff")
        if not reasons:
            reasons.append("clears margin and freshness thresholds")

        return confidence
