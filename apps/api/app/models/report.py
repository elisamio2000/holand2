"""Persisted generated reports (Phase 5 reporting service)."""

from sqlalchemy import JSON, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, new_uuid


class Report(Base, TimestampMixin):
    """A full generated report: interpretation + recommendations snapshot.

    Structure mirrors docs/esanj-benchmark-and-interpretation-requirements-fa.md
    section 7.2 output format: Summary Card, Detailed Interpretation,
    Action Plan, Risk Flags, Confidence Score.
    """

    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)

    recommendation_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("recommendations.id"), nullable=True
    )
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    holland_code: Mapped[str] = mapped_column(String(3), nullable=False)
    mbti_type: Mapped[str] = mapped_column(String(4), nullable=False)
    age_band: Mapped[str] = mapped_column(String(10), nullable=False)

    summary_card: Mapped[dict] = mapped_column(JSON, nullable=False)
    detailed_interpretation: Mapped[dict] = mapped_column(JSON, nullable=False)
    action_plan: Mapped[dict] = mapped_column(JSON, nullable=False)
    risk_flags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Report {self.holland_code}/{self.mbti_type} age={self.age_band}>"
