"""Analytics service: funnel event ingestion and drop-off aggregation.

Instruments the assessment-completion funnel (week-7 plan item:
"رخدادنگاری قیف تکمیل آزمون" — event logging for the completion funnel).
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.analytics import FunnelEvent
from ..schemas import FunnelEventCreate, FunnelStepSummary, FunnelSummaryResponse

# Canonical funnel step order used to compute sequential drop-off rates.
DEFAULT_FUNNEL_STEPS = ["start", "in_progress", "review", "complete"]


async def record_event(db: AsyncSession, payload: FunnelEventCreate) -> FunnelEvent:
    event = FunnelEvent(
        session_id=payload.session_id,
        event_name=payload.event_name,
        step=payload.step,
        duration_ms=payload.duration_ms,
        metadata_json=payload.metadata_json,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def get_funnel_summary(
    db: AsyncSession, steps: list[str] | None = None
) -> FunnelSummaryResponse:
    steps = steps or DEFAULT_FUNNEL_STEPS

    result = await db.execute(
        select(
            FunnelEvent.step,
            func.count(FunnelEvent.id),
            func.count(func.distinct(FunnelEvent.session_id)),
            func.avg(FunnelEvent.duration_ms),
        ).group_by(FunnelEvent.step)
    )
    rows = {row[0]: row for row in result.all()}

    total_sessions_result = await db.execute(
        select(func.count(func.distinct(FunnelEvent.session_id)))
    )
    total_sessions = total_sessions_result.scalar_one() or 0

    step_summaries: list[FunnelStepSummary] = []
    unique_by_step: dict[str, int] = {}
    for step in steps:
        row = rows.get(step)
        event_count = row[1] if row else 0
        unique_sessions = row[2] if row else 0
        avg_duration = float(row[3]) if row and row[3] is not None else None
        unique_by_step[step] = unique_sessions
        step_summaries.append(
            FunnelStepSummary(
                step=step,
                event_count=event_count,
                unique_sessions=unique_sessions,
                avg_duration_ms=avg_duration,
            )
        )

    drop_off_rate: dict[str, float] = {}
    for previous, current in zip(steps, steps[1:], strict=False):
        prev_count = unique_by_step.get(previous, 0)
        current_count = unique_by_step.get(current, 0)
        if prev_count == 0:
            drop_off_rate[f"{previous}->{current}"] = 0.0
        else:
            drop_off_rate[f"{previous}->{current}"] = round(
                (1 - (current_count / prev_count)) * 100.0, 2
            )

    return FunnelSummaryResponse(
        total_sessions=total_sessions,
        steps=step_summaries,
        drop_off_rate=drop_off_rate,
    )
