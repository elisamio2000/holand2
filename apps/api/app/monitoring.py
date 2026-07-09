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

    def track(self, path: str, status_code: int) -> None:
        self.requests_total += 1
        self.by_path[path] = self.by_path.get(path, 0) + 1
        if status_code >= 500:
            self.error_responses_total += 1


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


def _structured_log(payload: dict, *, level: int = logging.INFO) -> None:
    logger.log(level, json.dumps(payload, ensure_ascii=False))


def emit_operational_alert(payload: dict) -> None:
    _structured_log(
        {
            "event": "ops.alert",
            "schema_version": "2026-07-beta",
            "timestamp": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
            **payload,
        },
        level=logging.WARNING,
    )


class RequestObservabilityMiddleware(BaseHTTPMiddleware):
    """Structured request logging + baseline metrics collection."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - started) * 1000.0, 2)

        metrics_baseline.track(request.url.path, response.status_code)
        response.headers["X-Request-Id"] = request_id

        log_level = logging.WARNING if response.status_code >= 500 else logging.INFO
        _structured_log(
            {
                "event": "http.request",
                "schema_version": "2026-07-beta",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "timestamp": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
            },
            level=log_level,
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
    }
