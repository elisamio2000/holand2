"""Recommendation quality monitor service."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.recommendation import Recommendation
from ..models.recommendation_quality import RecommendationFeedback
from ..models.report import Report
from ..monitoring import (
    track_recommendation_feedback,
    track_recommendation_quality_alert,
    track_recommendation_quality_query,
)
from ..schemas import (
    RecommendationFeedbackCreate,
    RecommendationFeedbackOut,
    RecommendationFeedbackReasonStat,
    RecommendationQualityAlert,
    RecommendationQualityDriftResponse,
    RecommendationQualityTrendPoint,
    RecommendationQualityTrendsResponse,
)

settings = get_settings()


def _is_low_quality_expression():
    return case(
        (
            (RecommendationFeedback.helpful.is_(False))
            | (RecommendationFeedback.rating <= 2)
            | (RecommendationFeedback.accepted.is_(False)),
            1,
        ),
        else_=0,
    )


def _ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100.0, 2)


def _derive_helpfulness(payload: RecommendationFeedbackCreate) -> tuple[bool, int, bool]:
    helpful = payload.helpful
    if helpful is None:
        if payload.rating is not None:
            helpful = payload.rating >= 4
        elif payload.accepted is not None:
            helpful = payload.accepted
        else:
            helpful = False

    rating = payload.rating if payload.rating is not None else (5 if helpful else 2)
    accepted = payload.accepted if payload.accepted is not None else helpful
    return helpful, int(rating), bool(accepted)


async def record_feedback(
    db: AsyncSession, payload: RecommendationFeedbackCreate
) -> RecommendationFeedbackOut:
    report_row: Report | None = None
    recommendation_row: Recommendation | None = None

    if payload.report_id:
        report_row = await db.get(Report, payload.report_id)
        if report_row is None:
            raise ValueError("Report not found.")

    resolved_recommendation_id = payload.recommendation_id
    if report_row and report_row.recommendation_id:
        if resolved_recommendation_id and resolved_recommendation_id != report_row.recommendation_id:
            raise ValueError("recommendation_id does not match the report's recommendation.")
        resolved_recommendation_id = report_row.recommendation_id

    if resolved_recommendation_id:
        recommendation_row = await db.get(Recommendation, resolved_recommendation_id)
        if recommendation_row is None and payload.recommendation_id:
            raise ValueError("Recommendation not found.")

    helpful, rating, accepted = _derive_helpfulness(payload)
    reason_code = payload.reason_code if helpful is False else None
    reason_detail = payload.reason_detail if helpful is False else None

    inferred_session_id = payload.session_id
    if not inferred_session_id and recommendation_row:
        inferred_session_id = recommendation_row.session_id
    if not inferred_session_id and report_row:
        inferred_session_id = report_row.session_id

    holland_code = recommendation_row.holland_code if recommendation_row else None
    mbti_type = recommendation_row.mbti_type if recommendation_row else None
    age_band = recommendation_row.age_band if recommendation_row else None
    recommendation_confidence = (
        recommendation_row.confidence_score if recommendation_row else None
    )

    if report_row and not recommendation_row:
        holland_code = report_row.holland_code
        mbti_type = report_row.mbti_type
        age_band = report_row.age_band
        recommendation_confidence = report_row.confidence_score

    feedback = RecommendationFeedback(
        recommendation_id=resolved_recommendation_id,
        report_id=payload.report_id,
        session_id=inferred_session_id,
        user_id=payload.user_id,
        helpful=helpful,
        rating=rating,
        accepted=accepted,
        reason_code=reason_code,
        reason_detail=reason_detail,
        holland_code=holland_code,
        mbti_type=mbti_type,
        age_band=age_band,
        recommendation_confidence=recommendation_confidence,
        comment=payload.comment,
    )
    db.add(feedback)
    await db.flush()
    await db.refresh(feedback)
    track_recommendation_feedback(helpful=helpful, reason_code=reason_code)
    return RecommendationFeedbackOut.model_validate(feedback)


async def get_quality_alert(db: AsyncSession) -> RecommendationQualityAlert:
    result = await db.execute(
        select(
            func.count(RecommendationFeedback.id),
            func.coalesce(func.sum(_is_low_quality_expression()), 0),
            func.coalesce(
                func.sum(case((RecommendationFeedback.helpful.is_(True), 1), else_=0)),
                0,
            ),
        )
    )
    total_feedback, low_quality_feedback, helpful_feedback = result.one()
    total_feedback = int(total_feedback or 0)
    low_quality_feedback = int(low_quality_feedback or 0)
    helpful_feedback = int(helpful_feedback or 0)
    unhelpful_feedback = max(total_feedback - helpful_feedback, 0)

    low_quality_ratio = _ratio(low_quality_feedback, total_feedback)
    threshold = float(settings.recommendation_quality_alert_threshold_percent)
    min_samples = int(settings.recommendation_quality_alert_min_samples)
    alert_triggered = total_feedback >= min_samples and low_quality_ratio >= threshold
    severity = "ok"
    recommended_action = "continue-monitoring"
    if alert_triggered:
        if low_quality_ratio >= threshold + 20:
            severity = "critical"
            recommended_action = "pause-rollout-and-review-recommendation-rules"
        else:
            severity = "warning"
            recommended_action = "review-latest-feedback-and-adjust-recommendation-weights"

    alert = RecommendationQualityAlert(
        alert_triggered=alert_triggered,
        severity=severity,
        threshold_percent=threshold,
        min_samples=min_samples,
        total_feedback=total_feedback,
        helpful_feedback=helpful_feedback,
        unhelpful_feedback=unhelpful_feedback,
        low_quality_feedback=low_quality_feedback,
        low_quality_ratio=low_quality_ratio,
        recommended_action=recommended_action,
    )
    track_recommendation_quality_alert(triggered=alert_triggered, severity=severity)
    return alert


async def get_feedback_trends(
    db: AsyncSession, window_days: int = 14
) -> RecommendationQualityTrendsResponse:
    now = datetime.now(timezone.utc)  # noqa: UP017
    window_start = now - timedelta(days=window_days)

    trend_result = await db.execute(
        select(
            func.date(RecommendationFeedback.created_at).label("day"),
            func.count(RecommendationFeedback.id),
            func.coalesce(
                func.sum(case((RecommendationFeedback.helpful.is_(True), 1), else_=0)),
                0,
            ),
            func.coalesce(
                func.sum(case((RecommendationFeedback.helpful.is_(False), 1), else_=0)),
                0,
            ),
            func.avg(RecommendationFeedback.rating),
        )
        .where(RecommendationFeedback.created_at >= window_start)
        .group_by("day")
        .order_by("day")
    )
    trend_points: list[RecommendationQualityTrendPoint] = []
    total_feedback = 0
    helpful_feedback = 0
    unhelpful_feedback = 0
    for day, count, helpful_count, unhelpful_count, avg_rating in trend_result.all():
        day_total = int(count or 0)
        day_helpful = int(helpful_count or 0)
        day_unhelpful = int(unhelpful_count or 0)
        total_feedback += day_total
        helpful_feedback += day_helpful
        unhelpful_feedback += day_unhelpful
        trend_points.append(
            RecommendationQualityTrendPoint(
                day=str(day),
                feedback_count=day_total,
                helpful_feedback=day_helpful,
                unhelpful_feedback=day_unhelpful,
                helpful_ratio=_ratio(day_helpful, day_total),
                unhelpful_ratio=_ratio(day_unhelpful, day_total),
                avg_rating=round(float(avg_rating), 2) if avg_rating is not None else None,
            )
        )

    reason_result = await db.execute(
        select(RecommendationFeedback.reason_code, func.count(RecommendationFeedback.id))
        .where(
            and_(
                RecommendationFeedback.created_at >= window_start,
                RecommendationFeedback.helpful.is_(False),
                RecommendationFeedback.reason_code.is_not(None),
            )
        )
        .group_by(RecommendationFeedback.reason_code)
        .order_by(func.count(RecommendationFeedback.id).desc())
        .limit(8)
    )
    top_reasons = [
        RecommendationFeedbackReasonStat(reason_code=reason_code, count=int(count or 0))
        for reason_code, count in reason_result.all()
    ]

    track_recommendation_quality_query("trends")
    return RecommendationQualityTrendsResponse(
        window_days=window_days,
        total_feedback=total_feedback,
        helpful_feedback=helpful_feedback,
        unhelpful_feedback=unhelpful_feedback,
        unhelpful_ratio=_ratio(unhelpful_feedback, total_feedback),
        trend_points=trend_points,
        top_unhelpful_reasons=top_reasons,
    )


async def _window_rollup(
    db: AsyncSession, start: datetime, end: datetime
) -> tuple[int, int, float | None]:
    result = await db.execute(
        select(
            func.count(RecommendationFeedback.id),
            func.coalesce(
                func.sum(case((RecommendationFeedback.helpful.is_(False), 1), else_=0)),
                0,
            ),
            func.avg(RecommendationFeedback.rating),
        ).where(
            and_(
                RecommendationFeedback.created_at >= start,
                RecommendationFeedback.created_at < end,
            )
        )
    )
    total_feedback, unhelpful_feedback, avg_rating = result.one()
    return int(total_feedback or 0), int(unhelpful_feedback or 0), (
        round(float(avg_rating), 2) if avg_rating is not None else None
    )


async def get_quality_drift(
    db: AsyncSession, window_days: int = 7
) -> RecommendationQualityDriftResponse:
    now = datetime.now(timezone.utc)  # noqa: UP017
    current_start = now - timedelta(days=window_days)
    previous_start = current_start - timedelta(days=window_days)

    current_total, current_unhelpful, current_avg = await _window_rollup(db, current_start, now)
    previous_total, previous_unhelpful, previous_avg = await _window_rollup(
        db, previous_start, current_start
    )

    current_ratio = _ratio(current_unhelpful, current_total)
    previous_ratio = _ratio(previous_unhelpful, previous_total)
    unhelpful_ratio_delta = round(current_ratio - previous_ratio, 2)

    avg_rating_delta = None
    if current_avg is not None and previous_avg is not None:
        avg_rating_delta = round(current_avg - previous_avg, 2)

    drift_status = "stable"
    if unhelpful_ratio_delta >= 5.0 or (avg_rating_delta is not None and avg_rating_delta <= -0.3):
        drift_status = "degrading"
    elif unhelpful_ratio_delta <= -5.0 or (avg_rating_delta is not None and avg_rating_delta >= 0.3):
        drift_status = "improving"

    recommended_action = "continue-weekly-quality-review"
    if drift_status == "degrading":
        recommended_action = "review-unhelpful-reasons-and-adjust-ranking-heuristics"
    elif drift_status == "improving":
        recommended_action = "keep-current-heuristics-and-monitor"

    track_recommendation_quality_query("drift")
    return RecommendationQualityDriftResponse(
        window_days=window_days,
        current_total_feedback=current_total,
        previous_total_feedback=previous_total,
        current_unhelpful_ratio=current_ratio,
        previous_unhelpful_ratio=previous_ratio,
        unhelpful_ratio_delta=unhelpful_ratio_delta,
        current_avg_rating=current_avg,
        previous_avg_rating=previous_avg,
        avg_rating_delta=avg_rating_delta,
        drift_status=drift_status,
        recommended_action=recommended_action,
    )
