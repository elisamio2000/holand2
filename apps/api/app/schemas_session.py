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
    formula_version: int | None
    raw_scores: dict[str, float]
    normalized_scores: dict[str, Any]
    code: str
    certainty: dict[str, float] | None
    computed_at: datetime
