"""Recommendation feedback quality monitor endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..schemas import (
    RecommendationFeedbackCreate,
    RecommendationFeedbackOut,
    RecommendationQualityAlert,
    RecommendationQualityDriftResponse,
    RecommendationQualityTrendsResponse,
)
from ..security import limiter
from ..services import recommendation_quality as recommendation_quality_service

router = APIRouter(tags=["Recommendation Quality"])
settings = get_settings()


@router.post(
    "/recommendations/feedback",
    response_model=RecommendationFeedbackOut,
    status_code=201,
)
@limiter.limit(f"{settings.rate_limit_recommendation_feedback_per_minute}/minute")
async def create_recommendation_feedback(
    request: Request,
    payload: RecommendationFeedbackCreate,
    db: AsyncSession = Depends(get_db),
) -> RecommendationFeedbackOut:
    try:
        return await recommendation_quality_service.record_feedback(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/admin/alerts/recommendation-quality",
    response_model=RecommendationQualityAlert,
)
async def recommendation_quality_alert(
    db: AsyncSession = Depends(get_db),
) -> RecommendationQualityAlert:
    return await recommendation_quality_service.get_quality_alert(db)


@router.get(
    "/admin/recommendation-quality/trends",
    response_model=RecommendationQualityTrendsResponse,
)
async def recommendation_quality_trends(
    window_days: int = Query(default=14, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
) -> RecommendationQualityTrendsResponse:
    return await recommendation_quality_service.get_feedback_trends(db, window_days=window_days)


@router.get(
    "/admin/recommendation-quality/drift",
    response_model=RecommendationQualityDriftResponse,
)
async def recommendation_quality_drift(
    window_days: int = Query(default=7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
) -> RecommendationQualityDriftResponse:
    return await recommendation_quality_service.get_quality_drift(db, window_days=window_days)
