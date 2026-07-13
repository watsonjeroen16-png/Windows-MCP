from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.orchestrator import Orchestrator
from app.api.routes import router
from app.config import settings

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.orchestrator = Orchestrator()
    await app.state.orchestrator.run_once()  # populate immediately instead of waiting a full interval
    app.state.orchestrator.start()
    yield
    await app.state.orchestrator.stop()


app = FastAPI(title="Arbitrage Scanner API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
