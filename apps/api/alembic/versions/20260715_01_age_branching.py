"""Phase C1: Age-branching schema migration

Revision ID: 20260715_01
Revises: 20260710_01
Create Date: 2026-07-15 03:10:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260715_01"
down_revision: str | None = "20260710_01"
branch_labels: str | None = None
depends_on: str | None = None


age_group_enum = postgresql.ENUM("child", "teen", "adult", "senior", name="age_group_enum", create_type=False)
branch_state_enum = postgresql.ENUM("draft", "reviewed", "approved", "published", name="branch_state_enum", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    age_group_enum.create(bind, checkfirst=True)
    branch_state_enum.create(bind, checkfirst=True)

    # Add columns to assessment_versions
    op.add_column(
        "assessment_versions",
        sa.Column("is_age_branched", sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column(
        "assessment_versions",
        sa.Column("publish_state", postgresql.JSONB(), nullable=True),
    )

    # Add age_variants to questions
    op.add_column(
        "questions",
        sa.Column("age_variants", postgresql.JSONB(), nullable=True),
    )

    # Add columns to assessment_sessions
    op.add_column(
        "assessment_sessions",
        sa.Column("user_age_group", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "assessment_sessions",
        sa.Column("selected_age_branch", sa.String(length=20), nullable=True),
    )

    # Create assessment_branches table
    op.create_table(
        "assessment_branches",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("assessment_version_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("age_group", sa.String(length=20), nullable=False),
        sa.Column("created_from_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("state", branch_state_enum, nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(["assessment_version_id"], ["assessment_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_version_id", "age_group", name="uq_assessment_branch"),
    )

    op.create_index("ix_assessment_branches_assessment_version_id", "assessment_branches", ["assessment_version_id"], unique=False)
    op.create_index("ix_assessment_branches_age_group", "assessment_branches", ["age_group"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_assessment_branches_age_group", table_name="assessment_branches")
    op.drop_index("ix_assessment_branches_assessment_version_id", table_name="assessment_branches")
    op.drop_table("assessment_branches")

    op.drop_column("assessment_sessions", "selected_age_branch")
    op.drop_column("assessment_sessions", "user_age_group")

    op.drop_column("questions", "age_variants")

    op.drop_column("assessment_versions", "publish_state")
    op.drop_column("assessment_versions", "is_age_branched")

    bind = op.get_bind()
    branch_state_enum.drop(bind, checkfirst=True)
    age_group_enum.drop(bind, checkfirst=True)
