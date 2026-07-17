"""Phase A: identity and RBAC foundation

Revision ID: 20260714_02
Revises: 20260714_01
Create Date: 2026-07-14 09:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260714_02"
down_revision: str | None = "20260714_01"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("national_id", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("mobile_number", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("center_name", sa.String(length=150), nullable=True))

    op.create_index("ix_users_national_id", "users", ["national_id"], unique=True)
    op.create_index("ix_users_mobile_number", "users", ["mobile_number"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_mobile_number", table_name="users")
    op.drop_index("ix_users_national_id", table_name="users")

    op.drop_column("users", "center_name")
    op.drop_column("users", "mobile_number")
    op.drop_column("users", "national_id")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
