"""Analytics event model — funnel instrumentation for assessment completion."""

from sqlalchemy import Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, new_uuid


class FunnelEvent(Base, TimestampMixin):
    """A single funnel event emitted by the client (assessment start/step/complete/drop)."""

    __tablename__ = "funnel_events"
    __table_args__ = (
        Index("ix_funnel_events_session_step", "session_id", "step"),
        Index("ix_funnel_events_event_name", "event_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False)
    event_name: Mapped[str] = mapped_column(String(64), nullable=False)
    step: Mapped[str] = mapped_column(String(64), nullable=False)
    duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(String(2000), nullable=True)
