"""Assessment session models (Phase 3).

A session is always pinned to one immutable ``AssessmentVersion`` (and,
once scored, one ``ScoringFormulaVersion``) so results stay reproducible even
after newer versions are published — see
docs/questionnaire-scoring-design-fa.md #4.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .assessment import AssessmentType
from .base import Base, TimestampMixin, new_uuid


class SessionStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class AssessmentSession(Base, TimestampMixin):
    __tablename__ = "assessment_sessions"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    user_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True, index=True)
    assessment_type: Mapped[AssessmentType] = mapped_column(
        Enum(AssessmentType, name="session_assessment_type_enum"), nullable=False
    )
    assessment_version_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_versions.id"), nullable=False, index=True
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status_enum"),
        nullable=False,
        default=SessionStatus.IN_PROGRESS,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    answers: Mapped[list[SessionAnswer]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    result: Mapped[SessionResult | None] = relationship(
        back_populates="session", uselist=False, cascade="all, delete-orphan"
    )


class SessionAnswer(Base, TimestampMixin):
    __tablename__ = "session_answers"
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_session_question_answer"),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_sessions.id"), nullable=False, index=True
    )
    question_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("questions.id"), nullable=False, index=True
    )
    option_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("question_options.id"), nullable=False
    )
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    session: Mapped[AssessmentSession] = relationship(back_populates="answers")


class SessionResult(Base, TimestampMixin):
    __tablename__ = "session_results"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        ForeignKey("assessment_sessions.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    formula_version_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("scoring_formula_versions.id"), nullable=True
    )
    raw_scores: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    normalized_scores: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    certainty: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    session: Mapped[AssessmentSession] = relationship(back_populates="result")


__all__ = [
    "SessionStatus",
    "AssessmentSession",
    "SessionAnswer",
    "SessionResult",
]
