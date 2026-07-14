"""add combined assessment type and session version pinning fields

Revision ID: 20260709_03_combined
Revises: 20260709_02
Create Date: 2026-07-09 10:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260709_03_combined"
down_revision: str | None = "20260709_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_enum_value_if_needed(enum_name: str, value: str) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    # PostgreSQL enum ALTER TYPE does not accept bind params for the value literal.
    op.execute(sa.text(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{value}'"))


def upgrade() -> None:
    _add_enum_value_if_needed("assessment_type_enum", "combined")
    _add_enum_value_if_needed("formula_assessment_type_enum", "combined")
    _add_enum_value_if_needed("session_assessment_type_enum", "combined")

    op.add_column(
        "assessment_sessions",
        sa.Column("secondary_assessment_version_id", sa.Uuid(as_uuid=False), nullable=True),
    )
    op.create_index(
        "ix_assessment_sessions_secondary_assessment_version_id",
        "assessment_sessions",
        ["secondary_assessment_version_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_assessment_sessions_secondary_assessment_version_id",
        "assessment_sessions",
        "assessment_versions",
        ["secondary_assessment_version_id"],
        ["id"],
    )

    op.add_column(
        "session_results",
        sa.Column("secondary_formula_version_id", sa.Uuid(as_uuid=False), nullable=True),
    )
    op.create_foreign_key(
        "fk_session_results_secondary_formula_version_id",
        "session_results",
        "scoring_formula_versions",
        ["secondary_formula_version_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_session_results_secondary_formula_version_id",
        "session_results",
        type_="foreignkey",
    )
    op.drop_column("session_results", "secondary_formula_version_id")

    op.drop_constraint(
        "fk_assessment_sessions_secondary_assessment_version_id",
        "assessment_sessions",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_assessment_sessions_secondary_assessment_version_id",
        table_name="assessment_sessions",
    )
    op.drop_column("assessment_sessions", "secondary_assessment_version_id")
