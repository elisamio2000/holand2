"""Analytics router — funnel event ingestion & summary reporting."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..schemas import (
    FunnelEventCreate,
    FunnelEventOut,
    FunnelSummaryResponse,
    ReportQualitySummaryResponse,
)
from ..security import limiter
from ..services import analytics as analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])
settings = get_settings()


@router.post("/events", response_model=FunnelEventOut, status_code=201)
@limiter.limit(f"{settings.rate_limit_analytics_events_per_minute}/minute")
async def create_event(
    request: Request, payload: FunnelEventCreate, db: AsyncSession = Depends(get_db)
) -> FunnelEventOut:
    event = await analytics_service.record_event(db, payload)
    return FunnelEventOut.model_validate(event)


@router.get("/funnel", response_model=FunnelSummaryResponse)
async def funnel_summary(db: AsyncSession = Depends(get_db)) -> FunnelSummaryResponse:
    return await analytics_service.get_funnel_summary(db)


@router.get("/report-quality", response_model=ReportQualitySummaryResponse)
async def report_quality_summary(db: AsyncSession = Depends(get_db)) -> ReportQualitySummaryResponse:
    return await analytics_service.get_report_quality_summary(db)
