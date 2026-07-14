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
    assessment_type: AssessmentType
    assessment_version: int
    status: SessionStatus
    started_at: datetime
    questions: list[QuestionOut]


class SessionOut(BaseModel):
    session_id: str
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
