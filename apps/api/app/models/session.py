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
        Enum(
            AssessmentType,
            name="session_assessment_type_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    assessment_version_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_versions.id"), nullable=False, index=True
    )
    secondary_assessment_version_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_versions.id"), nullable=True, index=True
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(
            SessionStatus,
            name="session_status_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=SessionStatus.IN_PROGRESS,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Phase B (Assessment Runtime Integrity): human-friendly, non-UUID
    # identifiers. Nullable during rollout (see migration 20260714_01) until
    # the backfill is verified and a follow-up migration hardens them to
    # NOT NULL + unique. NOT the same as ``SessionResult.code`` (the
    # psychometric Holland/MBTI type code) — kept deliberately distinct.
    run_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    participant_code: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)

    answers: Mapped[list[SessionAnswer]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    result: Mapped[SessionResult | None] = relationship(
        back_populates="session", uselist=False, cascade="all, delete-orphan"
    )
    ai_reports: Mapped[list[Any]] = relationship(
        "SessionAIReport", back_populates="session", cascade="all, delete-orphan"
    )
    events: Mapped[list[SessionEvent]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="SessionEvent.server_seq"
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
    secondary_formula_version_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("scoring_formula_versions.id"), nullable=True
    )
    raw_scores: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    normalized_scores: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    certainty: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    session: Mapped[AssessmentSession] = relationship(back_populates="result")


class SessionEventType(str, enum.Enum):
    """Runtime timeline events captured while a participant takes a session.

    ``revisit`` is a server-derived convenience marker (a ``question_view``
    for a question already seen earlier in the session) — clients may send a
    hint but the server is the source of truth; see
    ``services.session_events.derive_revisit_flags``.
    """

    QUESTION_VIEW = "question_view"
    QUESTION_SELECT = "question_select"
    QUESTION_REVISE = "question_revise"
    NAVIGATION_NEXT = "navigation_next"
    NAVIGATION_PREV = "navigation_prev"
    DWELL = "dwell"
    REVISIT = "revisit"


class SessionEvent(Base):
    """Append-only runtime timeline event for a session (Phase B).

    Ordering/trust model: ``server_seq`` (assigned monotonically per-session
    at insert time) and ``received_at`` (server clock) are authoritative for
    ordering and history integrity. ``client_seq`` and ``occurred_at`` are
    client-reported and are only used for dwell-time calculation and
    anomaly detection — never trusted alone for ordering or audit purposes.
    """

    __tablename__ = "session_events"
    __table_args__ = (
        UniqueConstraint("session_id", "server_seq", name="uq_session_event_server_seq"),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_sessions.id"), nullable=False, index=True
    )
    event_type: Mapped[SessionEventType] = mapped_column(
        Enum(
            SessionEventType,
            name="session_event_type_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    question_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("questions.id"), nullable=True, index=True
    )
    option_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    previous_option_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    client_seq: Mapped[int | None] = mapped_column(nullable=True)
    server_seq: Mapped[int] = mapped_column(nullable=False)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    dwell_ms: Mapped[int | None] = mapped_column(nullable=True)
    event_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    session: Mapped[AssessmentSession] = relationship(back_populates="events")


__all__ = [
    "SessionStatus",
    "AssessmentSession",
    "SessionAnswer",
    "SessionResult",
    "SessionEventType",
    "SessionEvent",
]
