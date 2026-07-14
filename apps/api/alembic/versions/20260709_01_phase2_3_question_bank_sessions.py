"""phase2+3 question bank, formulas, and session models

Revision ID: 20260709_01
Revises:
Create Date: 2026-07-09 03:52:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260709_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


assessment_type_enum = postgresql.ENUM("holland", "mbti", name="assessment_type_enum", create_type=False)
version_status_enum = postgresql.ENUM(
    "draft", "reviewed", "approved", "published", "archived", name="version_status_enum", create_type=False
)
question_kind_enum = postgresql.ENUM("likert", "forced_choice", name="question_kind_enum", create_type=False)
formula_assessment_type_enum = postgresql.ENUM("holland", "mbti", name="formula_assessment_type_enum", create_type=False)
formula_version_status_enum = postgresql.ENUM(
    "draft", "reviewed", "approved", "published", "archived", name="formula_version_status_enum", create_type=False
)
version_entity_type_enum = postgresql.ENUM(
    "assessment_version", "formula_version", name="version_entity_type_enum", create_type=False
)
session_assessment_type_enum = postgresql.ENUM("holland", "mbti", name="session_assessment_type_enum", create_type=False)
session_status_enum = postgresql.ENUM(
    "in_progress", "completed", "abandoned", name="session_status_enum", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    assessment_type_enum.create(bind, checkfirst=True)
    version_status_enum.create(bind, checkfirst=True)
    question_kind_enum.create(bind, checkfirst=True)
    formula_assessment_type_enum.create(bind, checkfirst=True)
    formula_version_status_enum.create(bind, checkfirst=True)
    version_entity_type_enum.create(bind, checkfirst=True)
    session_assessment_type_enum.create(bind, checkfirst=True)
    session_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "assessment_versions",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("assessment_type", assessment_type_enum, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", version_status_enum, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=200), nullable=True),
        sa.Column("approved_by", sa.String(length=200), nullable=True),
        sa.Column("rollback_of", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["rollback_of"], ["assessment_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_type", "version", name="uq_assessment_version"),
    )
    op.create_index(
        "ix_assessment_versions_assessment_type", "assessment_versions", ["assessment_type"], unique=False
    )

    op.create_table(
        "questions",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("assessment_version_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("kind", question_kind_enum, nullable=False),
        sa.Column("dimension", sa.String(length=4), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("is_reverse_scored", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["assessment_version_id"], ["assessment_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_questions_assessment_version_id", "questions", ["assessment_version_id"], unique=False)
    op.create_index("ix_questions_dimension", "questions", ["dimension"], unique=False)

    op.create_table(
        "question_options",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("question_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("label", sa.String(length=300), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("pole", sa.String(length=1), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_question_options_question_id", "question_options", ["question_id"], unique=False)

    op.create_table(
        "scoring_formula_versions",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("formula_key", sa.String(length=100), nullable=False),
        sa.Column("assessment_type", formula_assessment_type_enum, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", formula_version_status_enum, nullable=False),
        sa.Column("expression", sa.JSON(), nullable=False),
        sa.Column("input_variables", sa.JSON(), nullable=False),
        sa.Column("output_metric", sa.String(length=100), nullable=False),
        sa.Column("validation_rules", sa.JSON(), nullable=True),
        sa.Column("unit_tests", sa.JSON(), nullable=True),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=200), nullable=True),
        sa.Column("approved_by", sa.String(length=200), nullable=True),
        sa.Column("rollback_of", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["rollback_of"], ["scoring_formula_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("formula_key", "version", name="uq_formula_version"),
    )
    op.create_index(
        "ix_scoring_formula_versions_formula_key", "scoring_formula_versions", ["formula_key"], unique=False
    )

    op.create_table(
        "version_audit_logs",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("entity_type", version_entity_type_enum, nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("from_status", sa.String(length=50), nullable=True),
        sa.Column("to_status", sa.String(length=50), nullable=True),
        sa.Column("actor", sa.String(length=200), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_version_audit_logs_entity_id", "version_audit_logs", ["entity_id"], unique=False)

    op.create_table(
        "assessment_sessions",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("assessment_type", session_assessment_type_enum, nullable=False),
        sa.Column("assessment_version_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("status", session_status_enum, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["assessment_version_id"], ["assessment_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assessment_sessions_user_id", "assessment_sessions", ["user_id"], unique=False)
    op.create_index(
        "ix_assessment_sessions_assessment_version_id",
        "assessment_sessions",
        ["assessment_version_id"],
        unique=False,
    )

    op.create_table(
        "session_answers",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("session_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("question_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("option_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["option_id"], ["question_options.id"]),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["assessment_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "question_id", name="uq_session_question_answer"),
    )
    op.create_index("ix_session_answers_session_id", "session_answers", ["session_id"], unique=False)
    op.create_index("ix_session_answers_question_id", "session_answers", ["question_id"], unique=False)

    op.create_table(
        "session_results",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("session_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("formula_version_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("raw_scores", sa.JSON(), nullable=False),
        sa.Column("normalized_scores", sa.JSON(), nullable=False),
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column("certainty", sa.JSON(), nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["formula_version_id"], ["scoring_formula_versions.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["assessment_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_index("ix_session_results_session_id", "session_results", ["session_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_session_results_session_id", table_name="session_results")
    op.drop_table("session_results")
    op.drop_index("ix_session_answers_question_id", table_name="session_answers")
    op.drop_index("ix_session_answers_session_id", table_name="session_answers")
    op.drop_table("session_answers")
    op.drop_index("ix_assessment_sessions_assessment_version_id", table_name="assessment_sessions")
    op.drop_index("ix_assessment_sessions_user_id", table_name="assessment_sessions")
    op.drop_table("assessment_sessions")
    op.drop_index("ix_version_audit_logs_entity_id", table_name="version_audit_logs")
    op.drop_table("version_audit_logs")
    op.drop_index("ix_scoring_formula_versions_formula_key", table_name="scoring_formula_versions")
    op.drop_table("scoring_formula_versions")
    op.drop_index("ix_question_options_question_id", table_name="question_options")
    op.drop_table("question_options")
    op.drop_index("ix_questions_dimension", table_name="questions")
    op.drop_index("ix_questions_assessment_version_id", table_name="questions")
    op.drop_table("questions")
    op.drop_index("ix_assessment_versions_assessment_type", table_name="assessment_versions")
    op.drop_table("assessment_versions")

    bind = op.get_bind()
    session_status_enum.drop(bind, checkfirst=True)
    session_assessment_type_enum.drop(bind, checkfirst=True)
    version_entity_type_enum.drop(bind, checkfirst=True)
    formula_version_status_enum.drop(bind, checkfirst=True)
    formula_assessment_type_enum.drop(bind, checkfirst=True)
    question_kind_enum.drop(bind, checkfirst=True)
    version_status_enum.drop(bind, checkfirst=True)
    assessment_type_enum.drop(bind, checkfirst=True)
