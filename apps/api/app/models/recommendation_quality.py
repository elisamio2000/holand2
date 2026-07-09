"""Recommendation feedback model for quality monitoring and alerting."""

from sqlalchemy import Boolean, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, new_uuid


class RecommendationFeedback(Base, TimestampMixin):
    """User feedback on recommendation quality for monitoring and alerting."""

    __tablename__ = "recommendation_feedback"
    __table_args__ = (
        Index("ix_reco_feedback_recommendation_id", "recommendation_id"),
        Index("ix_reco_feedback_report_id", "report_id"),
        Index("ix_reco_feedback_session_id", "session_id"),
        Index("ix_reco_feedback_profile", "holland_code", "mbti_type", "age_band"),
        Index("ix_reco_feedback_rating", "rating"),
        Index("ix_reco_feedback_helpful", "helpful"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    recommendation_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    report_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    helpful: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..5
    accepted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reason_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reason_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    holland_code: Mapped[str | None] = mapped_column(String(3), nullable=True)
    mbti_type: Mapped[str | None] = mapped_column(String(4), nullable=True)
    age_band: Mapped[str | None] = mapped_column(String(10), nullable=True)
    recommendation_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
