from __future__ import annotations

from fastapi import APIRouter, Request

from app.models import MarketType, ValidatedOpportunity

router = APIRouter(prefix="/api")


@router.get("/health")
async def health(request: Request) -> dict:
    orchestrator = request.app.state.orchestrator
    return {
        "status": "ok",
        "last_run_at": orchestrator.last_run_at,
        "opportunity_count": len(orchestrator.latest),
    }


@router.get("/opportunities", response_model=list[ValidatedOpportunity])
async def list_opportunities(request: Request) -> list[ValidatedOpportunity]:
    return request.app.state.orchestrator.latest


@router.get("/opportunities/{market}", response_model=list[ValidatedOpportunity])
async def list_opportunities_by_market(market: MarketType, request: Request) -> list[ValidatedOpportunity]:
    return request.app.state.orchestrator.latest_for_market(market)


@router.post("/scan", response_model=list[ValidatedOpportunity])
async def trigger_scan(request: Request) -> list[ValidatedOpportunity]:
    orchestrator = request.app.state.orchestrator
    return await orchestrator.run_once()
