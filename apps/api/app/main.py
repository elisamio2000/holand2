"""Holand Guidance API — application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

from .config import get_settings
from .database import engine
from .recommendations import build_recommendations
from .routers.analytics import router as analytics_router
from .routers.expert_lab import router as expert_lab_router
from .schemas import (
    HealthResponse,
    HollandRequest,
    HollandResult,
    MbtiRequest,
    MbtiResult,
    RecommendationRequest,
    RecommendationResponse,
)
from .scoring import score_holland, score_mbti
from .security import BodySizeLimitMiddleware, SecurityHeadersMiddleware, limiter

settings = get_settings()



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify DB connection on startup; clean up on shutdown."""
    from sqlalchemy import text
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        # Allow startup without DB for local dev without docker
        pass
    yield
    await engine.dispose()


app = FastAPI(
    title="Holand Guidance API",
    version="0.2.0",
    description="API for Holland and MBTI scoring, assessment engine, and career guidance.",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return _rate_limit_exceeded_handler(request, exc)


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# ── Security middleware (order matters: outermost added last runs first) ────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(analytics_router)
app.include_router(expert_lab_router)
# Phase 1: from .routers.auth import router as auth_router; app.include_router(auth_router)
# Phase 1: from .routers.users import router as users_router; app.include_router(users_router)
# Phase 3: from .routers.sessions import router as sessions_router; app.include_router(sessions_router)
# Phase 5: from .routers.reports import router as reports_router; app.include_router(reports_router)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/assessments/holland/score", response_model=HollandResult, tags=["Assessments"])
def holland_score(payload: HollandRequest) -> HollandResult:
    try:
        normalized_scores, top3_code, quality_score, quality_band = score_holland(payload.scores)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return HollandResult(
        normalized_scores=normalized_scores,
        top3_code=top3_code,
        quality_score=quality_score,
        quality_band=quality_band,
    )


@app.post("/assessments/mbti/score", response_model=MbtiResult, tags=["Assessments"])
def mbti_score(payload: MbtiRequest) -> MbtiResult:
    try:
        type_code, certainty, quality_score, quality_band = score_mbti(payload.scores)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MbtiResult(
        type_code=type_code,
        certainty=certainty,
        quality_score=quality_score,
        quality_band=quality_band,
    )


@app.post("/recommendations", response_model=RecommendationResponse, tags=["Recommendations"])
def recommendations(payload: RecommendationRequest) -> RecommendationResponse:
    careers, majors = build_recommendations(payload.holland_code, payload.mbti_type)
    return RecommendationResponse(careers=careers, majors=majors)
