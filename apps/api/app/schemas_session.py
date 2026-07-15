"""Pydantic schemas for the assessment session API (Phase 3)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .models.assessment import AssessmentType
from .models.session import SessionStatus
from .schemas_assessment import QuestionOut


class StartSessionIn(BaseModel):
    assessment_type: AssessmentType
    user_id: str | None = None


class StartSessionOut(BaseModel):
    session_id: str
    run_code: str | None = None
    participant_code: str | None = None
    assessment_type: AssessmentType
    assessment_version: int
    status: SessionStatus
    started_at: datetime
    questions: list[QuestionOut]


class SessionOut(BaseModel):
    session_id: str
    run_code: str | None = None
    assessment_type: AssessmentType
    assessment_version: int
    status: SessionStatus
    started_at: datetime
    completed_at: datetime | None
    answered_count: int
    total_questions: int


class SubmitAnswerIn(BaseModel):
    question_id: str
    option_id: str


class SubmitAnswersIn(BaseModel):
    answers: list[SubmitAnswerIn] = Field(..., min_length=1)


class SubmitAnswersOut(BaseModel):
    session_id: str
    answered_count: int
    total_questions: int
    status: SessionStatus


class SessionResultOut(BaseModel):
    session_id: str
    assessment_type: AssessmentType
    assessment_version: int
    secondary_assessment_version: int | None = None
    formula_version: int | None
    secondary_formula_version: int | None = None
    raw_scores: dict[str, float]
    normalized_scores: dict[str, Any]
    code: str
    certainty: dict[str, Any] | None
    holland: dict[str, Any] | None = None
    mbti: dict[str, Any] | None = None
    computed_at: datetime


class SessionListItem(BaseModel):
    """Summary of a single assessment session for the history list."""

    session_id: str
    run_code: str | None = None
    assessment_type: AssessmentType
    status: SessionStatus
    top_code: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    answered_count: int

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    sessions: list[SessionListItem]
    total: int
    page: int
    limit: int


class ResumeAnswerOut(BaseModel):
    """A single answer as known to the backend, for authoritative resume."""

    question_id: str
    option_id: str
    answered_at: datetime
    revision_count: int = 0


class ResumeSessionOut(BaseModel):
    """Authoritative runtime snapshot for resuming a session after a
    refresh/tab-close, rebuilt from ``session_answers`` + ``session_events``.
    The frontend must treat this — not its local persisted state — as the
    source of truth on load (see BLK-04 / Phase B).

    ``last_question_id`` is intentionally omitted: position is client-derived
    from ``answers`` + question order, keeping the resume contract minimal.
    """

    session_id: str
    run_code: str | None = None
    assessment_type: AssessmentType
    status: SessionStatus
    started_at: datetime
    completed_at: datetime | None = None
    total_questions: int
    answered_count: int
    answers: list[ResumeAnswerOut]


class SessionEventIn(BaseModel):
    """A single client-reported runtime timeline event.

    ``client_seq``/``occurred_at`` are advisory only (dwell-time + anomaly
    detection); the server assigns the authoritative ``server_seq`` and
    ``received_at`` on ingestion.
    """

    event_type: str
    question_id: str | None = None
    option_id: str | None = None
    previous_option_id: str | None = None
    client_seq: int | None = None
    occurred_at: datetime | None = None
    dwell_ms: int | None = Field(default=None, ge=0)


class SubmitEventsIn(BaseModel):
    events: list[SessionEventIn] = Field(..., min_length=1, max_length=200)


class SubmitEventsOut(BaseModel):
    accepted: bool
    session_id: str
    server_seq_start: int
    server_seq_end: int
    stored: int
