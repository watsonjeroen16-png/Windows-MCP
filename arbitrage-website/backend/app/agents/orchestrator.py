from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from app.agents.scanner import Scanner
from app.agents.validator import Validator
from app.config import settings
from app.markets.crypto import default_crypto_adapters
from app.models import MarketType, ValidatedOpportunity

logger = logging.getLogger(__name__)


class Orchestrator:
    """Runs Scanner -> Validator on a fixed interval and caches the latest
    validated opportunities in memory for the API layer to serve."""

    def __init__(self, scanner: Scanner | None = None, validator: Validator | None = None):
        self.scanner = scanner or Scanner(default_crypto_adapters())
        self.validator = validator or Validator()
        self._latest: list[ValidatedOpportunity] = []
        self._last_run_at: datetime | None = None
        self._task: asyncio.Task | None = None

    @property
    def latest(self) -> list[ValidatedOpportunity]:
        return self._latest

    @property
    def last_run_at(self) -> datetime | None:
        return self._last_run_at

    def latest_for_market(self, market: MarketType) -> list[ValidatedOpportunity]:
        return [o for o in self._latest if o.market == market]

    async def run_once(self) -> list[ValidatedOpportunity]:
        async with httpx.AsyncClient() as client:
            candidates = await self.scanner.scan(client)
        validated = self.validator.validate(candidates)
        validated.sort(key=lambda o: o.net_profit_pct, reverse=True)
        self._latest = validated
        self._last_run_at = datetime.now(timezone.utc)
        logger.info(
            "scan cycle complete: %d candidates -> %d validated", len(candidates), len(validated)
        )
        return validated

    async def _loop(self) -> None:
        while True:
            try:
                await self.run_once()
            except Exception:
                logger.exception("scan cycle failed")
            await asyncio.sleep(settings.scan_interval_seconds)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
