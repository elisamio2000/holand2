"""Recommendation feedback model for quality monitoring and alerting."""

from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, new_uuid


class RecommendationFeedback(Base, TimestampMixin):
    """User feedback on recommendation quality for monitoring and alerting."""

    __tablename__ = "recommendation_feedback"
    __table_args__ = (
        Index("ix_reco_feedback_recommendation_id", "recommendation_id"),
        Index("ix_reco_feedback_rating", "rating"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    recommendation_id: Mapped[str] = mapped_column(String(128), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..5
    accepted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
