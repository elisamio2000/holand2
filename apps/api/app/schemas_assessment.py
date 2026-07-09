"""Pydantic schemas for the question bank & scoring-formula governance API
(Phase 2, admin/versioning endpoints)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .models.assessment import AssessmentType, QuestionKind, VersionStatus


# ── Question bank (read models) ──────────────────────────────────────────────
class QuestionOptionOut(BaseModel):
    id: str
    label: str
    value: int
    pole: str
    order_index: int

    model_config = {"from_attributes": True}


class QuestionOptionAdminOut(QuestionOptionOut):
    """Includes scoring weight — only exposed to admins, never to test-takers."""

    weight: float

    model_config = {"from_attributes": True}


class QuestionOut(BaseModel):
    id: str
    kind: QuestionKind
    dimension: str
    text: str
    order_index: int
    options: list[QuestionOptionOut]

    model_config = {"from_attributes": True}


class QuestionAdminOut(QuestionOut):
    options: list[QuestionOptionAdminOut]
    is_reverse_scored: bool

    model_config = {"from_attributes": True}


class AssessmentVersionOut(BaseModel):
    id: str
    assessment_type: AssessmentType
    version: int
    status: VersionStatus
    title: str
    notes: str | None
    effective_from: datetime | None
    effective_to: datetime | None
    created_by: str | None
    approved_by: str | None
    rollback_of: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssessmentVersionDetailOut(AssessmentVersionOut):
    questions: list[QuestionAdminOut]

    model_config = {"from_attributes": True}


# ── Draft creation ───────────────────────────────────────────────────────────
class QuestionOptionDraftIn(BaseModel):
    label: str
    value: int
    pole: str = Field(..., min_length=1, max_length=1)
    weight: float = 1.0
    order_index: int = 0


class QuestionDraftIn(BaseModel):
    kind: QuestionKind
    dimension: str = Field(..., min_length=1, max_length=4)
    text: str
    order_index: int = 0
    is_reverse_scored: bool = False
    options: list[QuestionOptionDraftIn]


class QuestionDraftPatchIn(BaseModel):
    kind: QuestionKind | None = None
    dimension: str | None = Field(default=None, min_length=1, max_length=4)
    text: str | None = None
    order_index: int | None = None
    is_reverse_scored: bool | None = None


class QuestionOrderItemIn(BaseModel):
    question_id: str
    order_index: int


class QuestionReorderIn(BaseModel):
    items: list[QuestionOrderItemIn] = Field(default_factory=list)


class QuestionOptionDraftPatchIn(BaseModel):
    label: str | None = None
    value: int | None = None
    pole: str | None = Field(default=None, min_length=1, max_length=1)
    weight: float | None = None
    order_index: int | None = None


class OptionOrderItemIn(BaseModel):
    option_id: str
    order_index: int


class OptionReorderIn(BaseModel):
    items: list[OptionOrderItemIn] = Field(default_factory=list)


class AssessmentVersionDraftIn(BaseModel):
    assessment_type: AssessmentType
    title: str
    notes: str | None = None
    created_by: str | None = None
    questions: list[QuestionDraftIn] = Field(default_factory=list)
    clone_from_version_id: str | None = Field(
        default=None,
        description="If set, clone questions from this published version instead of "
        "using the `questions` field.",
    )


class VersionActionIn(BaseModel):
    actor: str = Field(..., min_length=1, max_length=200)
    note: str | None = None


class RollbackIn(BaseModel):
    target_version_id: str = Field(..., description="Version id to roll back to")
    actor: str = Field(..., min_length=1, max_length=200)
    note: str | None = None


class VersionDiffOut(BaseModel):
    from_version_id: str
    to_version_id: str
    added: list[dict[str, Any]]
    removed: list[dict[str, Any]]
    changed: list[dict[str, Any]]


class SimulateAnswer(BaseModel):
    question_index: int = Field(..., description="0-based index into the draft's question list")
    option_index: int = Field(..., description="0-based index into that question's option list")


class SimulateAssessmentVersionIn(BaseModel):
    answers: list[SimulateAnswer]


class SimulateResultOut(BaseModel):
    raw_scores: dict[str, float]
    normalized_scores: dict[str, float]
    code: str
    certainty: dict[str, float] | None = None


# ── Scoring formulas ──────────────────────────────────────────────────────────
class ScoringFormulaVersionOut(BaseModel):
    id: str
    formula_key: str
    assessment_type: AssessmentType
    version: int
    status: VersionStatus
    expression: dict[str, Any]
    input_variables: list[str]
    output_metric: str
    validation_rules: dict[str, Any] | None
    unit_tests: list[dict[str, Any]] | None
    effective_from: datetime | None
    effective_to: datetime | None
    created_by: str | None
    approved_by: str | None
    rollback_of: str | None

    model_config = {"from_attributes": True}


class ScoringFormulaDraftIn(BaseModel):
    formula_key: str
    assessment_type: AssessmentType
    expression: dict[str, Any]
    input_variables: list[str]
    output_metric: str
    validation_rules: dict[str, Any] | None = None
    unit_tests: list[dict[str, Any]] | None = None
    created_by: str | None = None


class ScoringFormulaDraftPatchIn(BaseModel):
    expression: dict[str, Any] | None = None
    input_variables: list[str] | None = None
    output_metric: str | None = None
    validation_rules: dict[str, Any] | None = None
    unit_tests: list[dict[str, Any]] | None = None


class SimulateFormulaIn(BaseModel):
    variables: dict[str, float]


class SimulateFormulaOut(BaseModel):
    result: float


class PreflightIssueOut(BaseModel):
    code: str
    message: str
    blocking: bool
    path: str | None = None


class VersionPreflightOut(BaseModel):
    ready_to_publish: bool
    blocking_issue_count: int
    warning_count: int
    issues: list[PreflightIssueOut]


class AuditLogEntryOut(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    action: str
    from_status: str | None
    to_status: str | None
    actor: str | None
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
