"""Monitoring endpoints for baseline observability."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_operational_env_issues, get_settings
from ..database import get_db
from ..monitoring import emit_operational_alert, get_metrics_snapshot
from ..schemas import (
    MonitoringMetricsResponse,
    MonitoringReadinessCheck,
    MonitoringReadinessResponse,
    MonitoringReadinessThresholds,
)
from ..services import analytics as analytics_service
from ..services import recommendation_quality as recommendation_quality_service

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])
settings = get_settings()


@router.get("/metrics", response_model=MonitoringMetricsResponse)
async def metrics() -> MonitoringMetricsResponse:
    return MonitoringMetricsResponse(**get_metrics_snapshot())


@router.get("/readiness", response_model=MonitoringReadinessResponse)
async def readiness(db: AsyncSession = Depends(get_db)) -> MonitoringReadinessResponse:
    metrics = get_metrics_snapshot()
    total_requests = int(metrics["requests_total"])
    total_5xx = int(metrics["error_responses_total"])
    error_rate = (round((total_5xx / total_requests) * 100.0, 2) if total_requests > 0 else 0.0)

    funnel = await analytics_service.get_funnel_summary(db, steps=["start", "complete"])
    by_step = {item.step: item for item in funnel.steps}
    started_sessions = by_step["start"].unique_sessions
    completed_sessions = by_step["complete"].unique_sessions
    completion_rate = (
        round((completed_sessions / started_sessions) * 100.0, 2) if started_sessions > 0 else 0.0
    )

    quality_alert = await recommendation_quality_service.get_quality_alert(db)
    env_issues = get_operational_env_issues(settings)
    env_message = "; ".join(env_issues) if env_issues else "Environment validation passed."

    checks = [
        MonitoringReadinessCheck(
            name="api_error_5xx_rate",
            passed=error_rate < settings.beta_5xx_error_rate_threshold_percent,
            owner=settings.beta_owner_sre,
            observed=f"{error_rate}%",
            threshold=f"< {settings.beta_5xx_error_rate_threshold_percent}%",
            message="5xx response rate must remain below threshold.",
        ),
        MonitoringReadinessCheck(
            name="assessment_completion_rate",
            passed=(
                started_sessions >= settings.beta_completion_min_sessions
                and completion_rate >= settings.beta_completion_rate_threshold_percent
            ),
            owner=settings.beta_owner_product,
            observed=f"{completion_rate}% ({completed_sessions}/{started_sessions} sessions)",
            threshold=(
                f">= {settings.beta_completion_rate_threshold_percent}% with "
                f"{settings.beta_completion_min_sessions}+ started sessions"
            ),
            message="Assessment completion must meet beta threshold with enough samples.",
        ),
        MonitoringReadinessCheck(
            name="recommendation_quality_alert",
            passed=not quality_alert.alert_triggered,
            owner=settings.beta_owner_backend,
            observed=f"triggered={quality_alert.alert_triggered}, ratio={quality_alert.low_quality_ratio}%",
            threshold=f"alert false and ratio < {quality_alert.threshold_percent}%",
            message=f"Quality alert code: {quality_alert.alert_code}.",
        ),
        MonitoringReadinessCheck(
            name="operational_environment_validation",
            passed=len(env_issues) == 0,
            owner=settings.beta_owner_sre,
            observed="valid" if not env_issues else "invalid",
            threshold="no staging/production env validation errors",
            message=env_message,
        ),
    ]

    blocking_checks = [check for check in checks if not check.passed]
    go_no_go = "go" if not blocking_checks else "no-go"
    if blocking_checks:
        emit_operational_alert(
            {
                "status": "no-go",
                "alert_code": "BETA_READINESS_BLOCKED",
                "blocking_checks": [item.name for item in blocking_checks],
                "owners": [item.owner for item in blocking_checks],
            }
        )

    return MonitoringReadinessResponse(
        go_no_go=go_no_go,
        checked_at=datetime.now(timezone.utc).isoformat(),  # noqa: UP017
        checks=checks,
        thresholds=MonitoringReadinessThresholds(
            completion_rate_threshold_percent=settings.beta_completion_rate_threshold_percent,
            completion_min_sessions=settings.beta_completion_min_sessions,
            error_5xx_rate_threshold_percent=settings.beta_5xx_error_rate_threshold_percent,
            recommendation_quality_threshold_percent=settings.recommendation_quality_alert_threshold_percent,
        ),
    )
