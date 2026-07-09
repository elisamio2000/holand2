"""create recommendation feedback quality loop table

Revision ID: 20260709_03
Revises: f66a241cdea3
Create Date: 2026-07-09 09:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260709_03"
down_revision: str | None = "f66a241cdea3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recommendation_feedback",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("recommendation_id", sa.String(length=128), nullable=True),
        sa.Column("report_id", sa.String(length=36), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column("user_id", sa.String(length=128), nullable=True),
        sa.Column("helpful", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("accepted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reason_code", sa.String(length=64), nullable=True),
        sa.Column("reason_detail", sa.Text(), nullable=True),
        sa.Column("holland_code", sa.String(length=3), nullable=True),
        sa.Column("mbti_type", sa.String(length=4), nullable=True),
        sa.Column("age_band", sa.String(length=10), nullable=True),
        sa.Column("recommendation_confidence", sa.Float(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_reco_feedback_recommendation_id",
        "recommendation_feedback",
        ["recommendation_id"],
        unique=False,
    )
    op.create_index("ix_reco_feedback_report_id", "recommendation_feedback", ["report_id"], unique=False)
    op.create_index("ix_reco_feedback_session_id", "recommendation_feedback", ["session_id"], unique=False)
    op.create_index("ix_reco_feedback_rating", "recommendation_feedback", ["rating"], unique=False)
    op.create_index("ix_reco_feedback_helpful", "recommendation_feedback", ["helpful"], unique=False)
    op.create_index(
        "ix_reco_feedback_profile",
        "recommendation_feedback",
        ["holland_code", "mbti_type", "age_band"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reco_feedback_profile", table_name="recommendation_feedback")
    op.drop_index("ix_reco_feedback_helpful", table_name="recommendation_feedback")
    op.drop_index("ix_reco_feedback_rating", table_name="recommendation_feedback")
    op.drop_index("ix_reco_feedback_session_id", table_name="recommendation_feedback")
    op.drop_index("ix_reco_feedback_report_id", table_name="recommendation_feedback")
    op.drop_index("ix_reco_feedback_recommendation_id", table_name="recommendation_feedback")
    op.drop_table("recommendation_feedback")
