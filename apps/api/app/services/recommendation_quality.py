"""Recommendation quality monitor service."""

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.recommendation_quality import RecommendationFeedback
from ..schemas import (
    RecommendationFeedbackCreate,
    RecommendationFeedbackOut,
    RecommendationQualityAlert,
)

settings = get_settings()


def _is_low_quality_expression():
    return case(
        (
            (RecommendationFeedback.rating <= 2) | (RecommendationFeedback.accepted.is_(False)),
            1,
        ),
        else_=0,
    )


async def record_feedback(
    db: AsyncSession, payload: RecommendationFeedbackCreate
) -> RecommendationFeedbackOut:
    feedback = RecommendationFeedback(
        recommendation_id=payload.recommendation_id,
        user_id=payload.user_id,
        rating=payload.rating,
        accepted=payload.accepted,
        comment=payload.comment,
    )
    db.add(feedback)
    await db.flush()
    await db.refresh(feedback)
    return RecommendationFeedbackOut.model_validate(feedback)


async def get_quality_alert(db: AsyncSession) -> RecommendationQualityAlert:
    result = await db.execute(
        select(
            func.count(RecommendationFeedback.id),
            func.coalesce(func.sum(_is_low_quality_expression()), 0),
        )
    )
    total_feedback, low_quality_feedback = result.one()
    total_feedback = int(total_feedback or 0)
    low_quality_feedback = int(low_quality_feedback or 0)

    low_quality_ratio = (
        round((low_quality_feedback / total_feedback) * 100.0, 2)
        if total_feedback > 0
        else 0.0
    )
    threshold = float(settings.recommendation_quality_alert_threshold_percent)
    min_samples = int(settings.recommendation_quality_alert_min_samples)
    alert_triggered = total_feedback >= min_samples and low_quality_ratio >= threshold

    return RecommendationQualityAlert(
        alert_triggered=alert_triggered,
        threshold_percent=threshold,
        min_samples=min_samples,
        total_feedback=total_feedback,
        low_quality_feedback=low_quality_feedback,
        low_quality_ratio=low_quality_ratio,
    )
