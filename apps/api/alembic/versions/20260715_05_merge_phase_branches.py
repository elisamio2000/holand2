"""Merge alembic migration branches Phase A/B and Phase C1-C2.

The codebase had two parallel migration branches:
- Branch 1: f66a241cdea3 -> 20260710_01 -> 20260715_01 (Phase C1: Age Branching) -> 20260715_02
- Branch 2: 20260709_03_combined -> 20260714_01 (Phase B) -> 20260714_02 (Phase A)

Both branches include essential schema changes that must coexist:
- Branch 1: Admin LLM Integration (20260710_01), age branching
- Branch 2: Assessment runtime integrity (Phase B), identity/RBAC (Phase A)

This merge consolidates both into a single linear history, with Branch 1 as primary
(since it's the more recent and further-progressed branch).

Revision ID: 20260715_05
Revises: 20260715_02
Branch: 20260714_02
Create Date: 2026-07-15 04:30:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260715_05"
down_revision = "20260715_02"
branch_labels = None
depends_on = "20260714_02"


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
