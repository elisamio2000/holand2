"""Recommendation feedback quality monitor endpoints."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..schemas import (
    RecommendationFeedbackCreate,
    RecommendationFeedbackOut,
    RecommendationQualityAlert,
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
    return await recommendation_quality_service.record_feedback(db, payload)


@router.get(
    "/admin/alerts/recommendation-quality",
    response_model=RecommendationQualityAlert,
)
async def recommendation_quality_alert(
    db: AsyncSession = Depends(get_db),
) -> RecommendationQualityAlert:
    return await recommendation_quality_service.get_quality_alert(db)
