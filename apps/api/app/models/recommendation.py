"""Persisted recommendation batches produced by the recommendation engine."""

from sqlalchemy import JSON, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, new_uuid


class Recommendation(Base, TimestampMixin):
    """A single generated recommendation batch for a given assessment result.

    Not tied to a user/session FK yet because auth (Phase 1) and assessment
    sessions (Phase 3) are not implemented in this repository state; session_id
    is kept as a loosely-coupled nullable reference for forward compatibility.
    """

    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)

    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    holland_code: Mapped[str] = mapped_column(String(3), nullable=False)
    mbti_type: Mapped[str] = mapped_column(String(4), nullable=False)
    age_band: Mapped[str] = mapped_column(String(10), nullable=False)

    careers: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    majors: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Recommendation {self.holland_code}/{self.mbti_type} age={self.age_band}>"
