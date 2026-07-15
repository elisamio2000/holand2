"""Holand Guidance API — application entry point."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

from .config import get_settings
from .database import engine
from .monitoring import RequestObservabilityMiddleware, init_sentry_hooks
from .routers.admin_llm import router as admin_llm_router
from .routers.admin_rbac import router as admin_rbac_router
from .routers.admin_users import router as admin_users_router
from .routers.admin_versions import router as admin_versions_router
from .routers.analytics import router as analytics_router
from .routers.auth import router as auth_router
from .routers.counselor import router as counselor_router
from .routers.expert_lab import router as expert_lab_router
from .routers.monitoring import router as monitoring_router
from .routers.recommendation_quality import router as recommendation_quality_router
from .routers.recommendations import router as reco_router
from .routers.reports import router as reports_router
from .routers.sessions import router as sessions_router
from .routers.users import router as users_router
from .routers.authoring import router as authoring_router
from .routers.scoring_models import router as scoring_models_router
from .schemas import (
    HealthResponse,
    HollandRequest,
    HollandResult,
    MbtiRequest,
    MbtiResult,
)
from .scoring import score_holland, score_mbti
from .security import BodySizeLimitMiddleware, SecurityHeadersMiddleware, limiter

settings = get_settings()
logger = logging.getLogger(__name__)



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify DB connection on startup; seed default users; clean up on shutdown."""
    from sqlalchemy import text

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("Startup database connectivity check failed: %s", exc)

    # Seed default users on first startup
    try:
        await _seed_default_users()
    except Exception as exc:
        logger.exception("Default user seeding failed: %s", exc)

    yield
    await engine.dispose()


async def _seed_default_users() -> None:
    """Create default superadmin / admin / analyst / user accounts if absent."""
    from sqlalchemy import select

    from .database import AsyncSessionLocal
    from .models.user import User, UserRole
    from .services.auth_service import hash_password

    defaults = [
        {
            "username": "superadmin",
            "email": "superadmin@holand.dev",
            "display_name": "Holand Super Admin",
            "first_name": "Holand",
            "last_name": "SuperAdmin",
            "national_id": "seed-superadmin-001",
            "mobile_number": "+989100000001",
            "center_name": "Holand HQ",
            "password": "superadmin123",
            "role": UserRole.SUPER_ADMIN,
        },
        {
            "username": "admin",
            "email": "admin@holand.dev",
            "display_name": "Holand Admin",
            "first_name": "Holand",
            "last_name": "Admin",
            "national_id": "seed-admin-001",
            "mobile_number": "+989100000002",
            "center_name": "Holand HQ",
            "password": "admin123",
            "role": UserRole.ADMIN,
        },
        {
            "username": "analyst",
            "email": "analyst@holand.dev",
            "display_name": "Holand Analyst",
            "first_name": "Holand",
            "last_name": "Analyst",
            "national_id": "seed-analyst-001",
            "mobile_number": "+989100000003",
            "center_name": "Holand Guidance",
            "password": "analyst123",
            "role": UserRole.ANALYST,
        },
        {
            "username": "user",
            "email": "user@holand.dev",
            "display_name": "Demo User",
            "first_name": "Demo",
            "last_name": "User",
            "national_id": "seed-user-001",
            "mobile_number": "+989100000004",
            "center_name": "Holand Guidance",
            "password": "user123",
            "role": UserRole.USER,
        },
    ]

    async with AsyncSessionLocal() as db:
        for d in defaults:
            existing = await db.execute(select(User).where(User.username == d["username"]))
            existing_user = existing.scalar_one_or_none()
            if existing_user is not None:
                existing_user.role = d["role"]
                existing_user.display_name = d["display_name"]
                existing_user.first_name = d["first_name"]
                existing_user.last_name = d["last_name"]
                existing_user.national_id = d["national_id"]
                existing_user.mobile_number = d["mobile_number"]
                existing_user.center_name = d["center_name"]
                existing_user.is_active = True
                continue
            db.add(User(
                username=d["username"],
                email=d["email"],
                display_name=d["display_name"],
                first_name=d["first_name"],
                last_name=d["last_name"],
                national_id=d["national_id"],
                mobile_number=d["mobile_number"],
                center_name=d["center_name"],
                hashed_password=hash_password(d["password"]),
                role=d["role"],
                is_active=True,
            ))
        await db.commit()


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
app.add_middleware(RequestObservabilityMiddleware)
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
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_users_router)
app.include_router(admin_rbac_router)
app.include_router(admin_versions_router)
app.include_router(admin_llm_router)
app.include_router(sessions_router)
app.include_router(reco_router)
app.include_router(reports_router)
app.include_router(counselor_router)
app.include_router(analytics_router)
app.include_router(expert_lab_router)
app.include_router(recommendation_quality_router)
app.include_router(monitoring_router)
app.include_router(authoring_router)
app.include_router(scoring_models_router)

init_sentry_hooks()

# ── Static file serving for user uploads ─────────────────────────────────────
_avatars_dir = Path(settings.storage_local_path) / "avatars"
_avatars_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static/avatars", StaticFiles(directory=str(_avatars_dir)), name="static-avatars")


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
