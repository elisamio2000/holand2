"""Phase C1b: Add scoring_models table and branch_version_id to assessment_branches

Revision ID: 20260715_02
Revises: 20260715_01
Create Date: 2026-07-15 03:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260715_02"
down_revision: str | None = "20260715_01"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Add branch_version_id column to assessment_branches
    op.add_column(
        "assessment_branches",
        sa.Column("branch_version_id", sa.Uuid(as_uuid=False), nullable=True),
    )
    op.create_index("ix_assessment_branches_branch_version_id", "assessment_branches", ["branch_version_id"], unique=False)

    # Create scoring_models table
    op.create_table(
        "scoring_models",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("assessment_version_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("algorithm", sa.String(length=100), nullable=True),
        sa.Column("weight", sa.Numeric(5,2), nullable=False, server_default="1.0"),
        sa.Column("output_type", sa.String(length=50), nullable=False),
        sa.Column("config_json", postgresql.JSONB(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(["assessment_version_id"], ["assessment_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scoring_models_assessment_version_id", "scoring_models", ["assessment_version_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_scoring_models_assessment_version_id", table_name="scoring_models")
    op.drop_table("scoring_models")

    op.drop_index("ix_assessment_branches_branch_version_id", table_name="assessment_branches")
    op.drop_column("assessment_branches", "branch_version_id")
