"""add counselor assignments and report user ownership

Revision ID: 20260709_03
Revises: 20260709_02
Create Date: 2026-07-09 09:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260709_03"
down_revision: str | None = "20260709_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("user_id", sa.String(length=36), nullable=True))
    op.create_index("ix_reports_user_id", "reports", ["user_id"], unique=False)

    op.create_table(
        "counselor_assignments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "counselor_user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "student_user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "counselor_user_id",
            "student_user_id",
            name="uq_counselor_student_assignment",
        ),
    )
    op.create_index(
        "ix_counselor_assignments_counselor_user_id",
        "counselor_assignments",
        ["counselor_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_counselor_assignments_student_user_id",
        "counselor_assignments",
        ["student_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_counselor_assignments_student_user_id",
        table_name="counselor_assignments",
    )
    op.drop_index(
        "ix_counselor_assignments_counselor_user_id",
        table_name="counselor_assignments",
    )
    op.drop_table("counselor_assignments")
    op.drop_index("ix_reports_user_id", table_name="reports")
    op.drop_column("reports", "user_id")

