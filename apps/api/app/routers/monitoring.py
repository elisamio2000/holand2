"""Monitoring endpoints for baseline observability."""

from fastapi import APIRouter

from ..monitoring import get_metrics_snapshot
from ..schemas import MonitoringMetricsResponse

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.get("/metrics", response_model=MonitoringMetricsResponse)
async def metrics() -> MonitoringMetricsResponse:
    return MonitoringMetricsResponse(**get_metrics_snapshot())
