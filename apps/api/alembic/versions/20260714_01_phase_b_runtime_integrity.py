"""Phase B: assessment runtime integrity — run/participant codes + event timeline

Additive migration only (nullable columns + new table/indexes). Hardening to
NOT NULL + unique on ``run_code`` is deferred to a follow-up migration once
the backfill (see app/scripts/backfill_run_codes.py) has been verified
complete in each environment — see docs/release-readiness-phased-remediation-plan-fa.md
BLK-04 / Phase B.

NOTE (pre-existing, out of scope for this migration): this repository had
multiple unmerged alembic heads initially. These have been consolidated with
Phase 6 (Admin LLM Integration) coming before this migration, which came after
Phase 3 (combined_sessions_contract).

Revision ID: 20260714_01
Revises: 20260710_01
Create Date: 2026-07-14 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260714_01"
down_revision: str | None = "20260710_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


session_event_type_enum = postgresql.ENUM(
    "question_view",
    "question_select",
    "question_revise",
    "navigation_next",
    "navigation_prev",
    "dwell",
    "revisit",
    name="session_event_type_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    session_event_type_enum.create(bind, checkfirst=True)

    # --- run_code / participant_code: nullable, additive only ---------------
    op.add_column("assessment_sessions", sa.Column("run_code", sa.String(length=8), nullable=True))
    op.add_column(
        "assessment_sessions", sa.Column("participant_code", sa.String(length=10), nullable=True)
    )
    # Non-unique indexes for now; uniqueness on run_code is added in the
    # follow-up hardening migration after backfill is verified.
    op.create_index(
        "ix_assessment_sessions_run_code", "assessment_sessions", ["run_code"], unique=False
    )
    op.create_index(
        "ix_assessment_sessions_participant_code",
        "assessment_sessions",
        ["participant_code"],
        unique=False,
    )

    # --- session_events: append-only runtime timeline -----------------------
    op.create_table(
        "session_events",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("session_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("event_type", session_event_type_enum, nullable=False),
        sa.Column("question_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("option_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("previous_option_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("client_seq", sa.Integer(), nullable=True),
        sa.Column("server_seq", sa.Integer(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("dwell_ms", sa.Integer(), nullable=True),
        sa.Column("event_metadata", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["assessment_sessions.id"]),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "server_seq", name="uq_session_event_server_seq"),
    )
    op.create_index("ix_session_events_session_id", "session_events", ["session_id"], unique=False)
    op.create_index("ix_session_events_question_id", "session_events", ["question_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_session_events_question_id", table_name="session_events")
    op.drop_index("ix_session_events_session_id", table_name="session_events")
    op.drop_table("session_events")

    op.drop_index("ix_assessment_sessions_participant_code", table_name="assessment_sessions")
    op.drop_index("ix_assessment_sessions_run_code", table_name="assessment_sessions")
    op.drop_column("assessment_sessions", "participant_code")
    op.drop_column("assessment_sessions", "run_code")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        session_event_type_enum.drop(bind, checkfirst=True)
