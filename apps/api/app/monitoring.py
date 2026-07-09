"""Monitoring and observability primitives (logs, sentry hooks, metrics baseline)."""

import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .config import get_settings

settings = get_settings()


@dataclass
class MetricsBaseline:
    started_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)  # noqa: UP017
    )
    requests_total: int = 0
    error_responses_total: int = 0
    by_path: dict[str, int] = field(default_factory=dict)
    recommendation_feedback_total: int = 0
    recommendation_feedback_helpful_total: int = 0
    recommendation_feedback_unhelpful_total: int = 0
    recommendation_feedback_reasons: dict[str, int] = field(default_factory=dict)
    recommendation_quality_alerts_triggered_total: int = 0
    recommendation_quality_alerts_by_severity: dict[str, int] = field(default_factory=dict)
    recommendation_quality_trend_queries_total: int = 0
    recommendation_quality_drift_queries_total: int = 0
    recommendation_quality_heuristic_applied_total: int = 0

    def track(self, path: str, status_code: int) -> None:
        self.requests_total += 1
        self.by_path[path] = self.by_path.get(path, 0) + 1
        if status_code >= 500:
            self.error_responses_total += 1

    def track_recommendation_feedback(self, helpful: bool, reason_code: str | None) -> None:
        self.recommendation_feedback_total += 1
        if helpful:
            self.recommendation_feedback_helpful_total += 1
        else:
            self.recommendation_feedback_unhelpful_total += 1
            if reason_code:
                self.recommendation_feedback_reasons[reason_code] = (
                    self.recommendation_feedback_reasons.get(reason_code, 0) + 1
                )

    def track_recommendation_alert(self, triggered: bool, severity: str) -> None:
        if triggered:
            self.recommendation_quality_alerts_triggered_total += 1
        self.recommendation_quality_alerts_by_severity[severity] = (
            self.recommendation_quality_alerts_by_severity.get(severity, 0) + 1
        )

    def track_recommendation_quality_query(self, kind: str) -> None:
        if kind == "trends":
            self.recommendation_quality_trend_queries_total += 1
            return
        if kind == "drift":
            self.recommendation_quality_drift_queries_total += 1

    def track_recommendation_heuristic_applied(self) -> None:
        self.recommendation_quality_heuristic_applied_total += 1


metrics_baseline = MetricsBaseline()


def _setup_logger() -> logging.Logger:
    logger = logging.getLogger("holand.api")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    logger.setLevel(getattr(logging, settings.observability_log_level.upper(), logging.INFO))
    return logger


logger = _setup_logger()


def init_sentry_hooks() -> None:
    """Initialize sentry hook if DSN is provided and sentry-sdk is installed."""
    if not settings.sentry_dsn:
        logger.info(json.dumps({"event": "sentry.disabled", "reason": "missing_dsn"}))
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env,
            traces_sample_rate=settings.sentry_traces_sample_rate,
        )
        logger.info(json.dumps({"event": "sentry.initialized", "environment": settings.app_env}))
    except ImportError:
        logger.warning(
            json.dumps(
                {"event": "sentry.unavailable", "reason": "sentry_sdk_not_installed"}
            )
        )


def _structured_log(payload: dict) -> None:
    logger.info(json.dumps(payload, ensure_ascii=False))


class RequestObservabilityMiddleware(BaseHTTPMiddleware):
    """Structured request logging + baseline metrics collection."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - started) * 1000.0, 2)

        metrics_baseline.track(request.url.path, response.status_code)
        response.headers["X-Request-Id"] = request_id

        _structured_log(
            {
                "event": "http.request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "timestamp": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
            }
        )
        return response


def get_metrics_snapshot() -> dict:
    now = datetime.now(timezone.utc)  # noqa: UP017
    uptime_seconds = int((now - metrics_baseline.started_at).total_seconds())
    return {
        "started_at": metrics_baseline.started_at.isoformat(),
        "uptime_seconds": uptime_seconds,
        "requests_total": metrics_baseline.requests_total,
        "error_responses_total": metrics_baseline.error_responses_total,
        "by_path": metrics_baseline.by_path,
        "quality_loop_kpis": {
            "feedback_total": metrics_baseline.recommendation_feedback_total,
            "feedback_helpful_total": metrics_baseline.recommendation_feedback_helpful_total,
            "feedback_unhelpful_total": metrics_baseline.recommendation_feedback_unhelpful_total,
            "feedback_reasons": metrics_baseline.recommendation_feedback_reasons,
            "alerts_triggered_total": metrics_baseline.recommendation_quality_alerts_triggered_total,
            "alerts_by_severity": metrics_baseline.recommendation_quality_alerts_by_severity,
            "trend_queries_total": metrics_baseline.recommendation_quality_trend_queries_total,
            "drift_queries_total": metrics_baseline.recommendation_quality_drift_queries_total,
            "heuristics_applied_total": metrics_baseline.recommendation_quality_heuristic_applied_total,
        },
    }


def track_recommendation_feedback(helpful: bool, reason_code: str | None) -> None:
    metrics_baseline.track_recommendation_feedback(helpful=helpful, reason_code=reason_code)
    _structured_log(
        {
            "event": "recommendation.feedback.ingested",
            "helpful": helpful,
            "reason_code": reason_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
        }
    )


def track_recommendation_quality_alert(triggered: bool, severity: str) -> None:
    metrics_baseline.track_recommendation_alert(triggered=triggered, severity=severity)
    _structured_log(
        {
            "event": "recommendation.quality.alert.evaluated",
            "triggered": triggered,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
        }
    )


def track_recommendation_quality_query(kind: str) -> None:
    metrics_baseline.track_recommendation_quality_query(kind=kind)
    _structured_log(
        {
            "event": "recommendation.quality.query",
            "kind": kind,
            "timestamp": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
        }
    )


def track_recommendation_heuristic_applied(
    holland_code: str, mbti_type: str, age_band: str, unhelpful_ratio: float, sample_size: int
) -> None:
    metrics_baseline.track_recommendation_heuristic_applied()
    _structured_log(
        {
            "event": "recommendation.quality.heuristic_applied",
            "holland_code": holland_code,
            "mbti_type": mbti_type,
            "age_band": age_band,
            "unhelpful_ratio": unhelpful_ratio,
            "sample_size": sample_size,
            "timestamp": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
        }
    )
