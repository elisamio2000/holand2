"""add version validation reports table

Revision ID: 20260709_02
Revises: 20260709_01
Create Date: 2026-07-09 08:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260709_02"
down_revision: str | None = "20260709_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    version_entity_type_enum = postgresql.ENUM(
        "assessment_version",
        "formula_version",
        name="version_entity_type_enum",
        create_type=False,
    )
    op.create_table(
        "version_validation_reports",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("entity_type", version_entity_type_enum, nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("gate", sa.String(length=50), nullable=False),
        sa.Column("target_status", sa.String(length=50), nullable=False),
        sa.Column("ok", sa.Boolean(), nullable=False),
        sa.Column("report", sa.JSON(), nullable=False),
        sa.Column("actor", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_version_validation_reports_entity_id",
        "version_validation_reports",
        ["entity_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_version_validation_reports_entity_id", table_name="version_validation_reports")
    op.drop_table("version_validation_reports")
