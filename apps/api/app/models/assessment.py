"""Question bank & scoring-formula governance models (Phase 2).

Everything a scored assessment session depends on is versioned:

- ``AssessmentVersion`` — an immutable-once-published snapshot of the question
  set for one assessment type (holland / mbti).
- ``Question`` / ``QuestionOption`` — belong to exactly one ``AssessmentVersion``.
- ``ScoringFormulaVersion`` — the DSL expression(s) used to turn raw answers
  into normalized scores / type codes, versioned independently from the
  question set so formulas can be tuned without touching question wording.
- ``VersionAuditLog`` — append-only trail of every status transition
  (draft -> reviewed -> approved -> published -> archived) for both of the
  above, satisfying the governance requirements in
  docs/questionnaire-scoring-design-fa.md (#4, #6, #7) and
  docs/technical-architecture-fa.md (#7, #8).
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, new_uuid


class AssessmentType(str, enum.Enum):
    HOLLAND = "holland"
    MBTI = "mbti"
    COMBINED = "combined"


class VersionStatus(str, enum.Enum):
    """Governance workflow: draft -> reviewed -> approved -> published -> archived."""

    DRAFT = "draft"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class QuestionKind(str, enum.Enum):
    """How a question is answered and scored."""

    LIKERT = "likert"  # single statement, 1..5 agreement scale (Holland)
    FORCED_CHOICE = "forced_choice"  # pick option A or B, each maps to a pole (MBTI)


# ── Question bank ────────────────────────────────────────────────────────────
class AssessmentVersion(Base, TimestampMixin):
    """An immutable-once-published snapshot of one assessment's question set."""

    __tablename__ = "assessment_versions"
    __table_args__ = (
        UniqueConstraint("assessment_type", "version", name="uq_assessment_version"),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    assessment_type: Mapped[AssessmentType] = mapped_column(
        Enum(
            AssessmentType,
            name="assessment_type_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[VersionStatus] = mapped_column(
        Enum(
            VersionStatus,
            name="version_status_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=VersionStatus.DRAFT,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rollback_of: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_versions.id"), nullable=True
    )
    # Age-branching flags
    is_age_branched: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    publish_state: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


    questions: Mapped[list[Question]] = relationship(
        back_populates="assessment_version",
        order_by="Question.order_index",
        cascade="all, delete-orphan",
    )

    def is_immutable(self) -> bool:
        """Published/archived versions may never be edited in place."""
        return self.status in (VersionStatus.PUBLISHED, VersionStatus.ARCHIVED)


class Question(Base, TimestampMixin):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    assessment_version_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_versions.id"), nullable=False, index=True
    )
    kind: Mapped[QuestionKind] = mapped_column(
        Enum(
            QuestionKind,
            name="question_kind_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    # RIASEC letter (R/I/A/S/E/C) for Likert questions; for forced-choice
    # questions this holds the dichotomy pair, e.g. "EI", "SN", "TF", "JP".
    dimension: Mapped[str] = mapped_column(String(4), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    age_variants: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_reverse_scored: Mapped[bool] = mapped_column(default=False)

    assessment_version: Mapped[AssessmentVersion] = relationship(back_populates="questions")
    options: Mapped[list[QuestionOption]] = relationship(
        back_populates="question",
        order_by="QuestionOption.order_index",
        cascade="all, delete-orphan",
    )


class QuestionOption(Base, TimestampMixin):
    """A selectable answer for a question.

    - Likert questions have 5 options (value 1..5); ``pole``/``weight`` encode
      how much that value contributes to ``question.dimension``.
    - Forced-choice questions have exactly 2 options, each pinned to one pole
      of the dichotomy with weight 1.0.
    """

    __tablename__ = "question_options"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    question_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("questions.id"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    pole: Mapped[str] = mapped_column(String(1), nullable=False)  # e.g. "R", "E", "I"
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    question: Mapped[Question] = relationship(back_populates="options")


# ── Scoring formula governance ───────────────────────────────────────────────
class ScoringFormulaVersion(Base, TimestampMixin):
    """A versioned DSL formula definition.

    ``expression`` is evaluated by ``app.services.formula_engine`` against
    ``input_variables`` (raw per-dimension totals) to produce ``output_metric``.
    """

    __tablename__ = "scoring_formula_versions"
    __table_args__ = (
        UniqueConstraint("formula_key", "version", name="uq_formula_version"),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    formula_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    assessment_type: Mapped[AssessmentType] = mapped_column(
        Enum(
            AssessmentType,
            name="formula_assessment_type_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[VersionStatus] = mapped_column(
        Enum(
            VersionStatus,
            name="formula_version_status_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=VersionStatus.DRAFT,
    )

    expression: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    input_variables: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    output_metric: Mapped[str] = mapped_column(String(100), nullable=False)
    validation_rules: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    unit_tests: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)

    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rollback_of: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("scoring_formula_versions.id"), nullable=True
    )

    def is_immutable(self) -> bool:
        return self.status in (VersionStatus.PUBLISHED, VersionStatus.ARCHIVED)


class VersionEntityType(str, enum.Enum):
    ASSESSMENT_VERSION = "assessment_version"
    FORMULA_VERSION = "formula_version"


class VersionAuditLog(Base):
    """Append-only audit trail for every version status transition."""

    __tablename__ = "version_audit_logs"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    entity_type: Mapped[VersionEntityType] = mapped_column(
        Enum(
            VersionEntityType,
            name="version_entity_type_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    entity_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    actor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class VersionValidationReport(Base):
    """Persisted validation diagnostics for governance publish checks."""

    __tablename__ = "version_validation_reports"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    entity_type: Mapped[VersionEntityType] = mapped_column(
        Enum(
            VersionEntityType,
            name="version_entity_type_enum",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    entity_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), nullable=False, index=True)
    gate: Mapped[str] = mapped_column(String(50), nullable=False)
    target_status: Mapped[str] = mapped_column(String(50), nullable=False)
    ok: Mapped[bool] = mapped_column(default=False, nullable=False)
    report: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    actor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AssessmentBranch(Base, TimestampMixin):
    __tablename__ = "assessment_branches"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    assessment_version_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("assessment_versions.id"), nullable=False, index=True)
    age_group: Mapped[str] = mapped_column(String(20), nullable=False)
    created_from_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    branch_version_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[str] = mapped_column(String(50), nullable=False, default='draft')


__all__ = [
    "AssessmentType",
    "VersionStatus",
    "QuestionKind",
    "AssessmentVersion",
    "Question",
    "QuestionOption",
    "ScoringFormulaVersion",
    "VersionEntityType",
    "VersionAuditLog",
    "VersionValidationReport",
    "AssessmentBranch",
]
