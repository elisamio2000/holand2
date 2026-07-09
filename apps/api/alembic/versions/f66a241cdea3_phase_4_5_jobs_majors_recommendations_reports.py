"""Phase 4+5: jobs, majors, recommendations, reports tables.

Revision ID: f66a241cdea3
Revises:
Create Date: 2026-07-09

Adds the standardized job/major taxonomy backbone plus the persisted
recommendation and report tables backing the Phase 4 recommendation engine
and Phase 5 reporting service.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f66a241cdea3"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("canonical_title", sa.String(length=200), nullable=False, unique=True),
        sa.Column("canonical_title_fa", sa.String(length=200), nullable=False),
        sa.Column("alt_titles", sa.JSON(), nullable=False),
        sa.Column(
            "taxonomy_source",
            sa.Enum("ISCO", "ESCO", "ONET", name="taxonomysource", native_enum=False, length=20),
            nullable=False,
        ),
        sa.Column("taxonomy_code", sa.String(length=50), nullable=False),
        sa.Column("riasec_profile", sa.String(length=6), nullable=False),
        sa.Column("required_skills", sa.JSON(), nullable=False),
        sa.Column(
            "education_level",
            sa.Enum(
                "high_school_track",
                "vocational",
                "associate",
                "bachelor",
                "master",
                "doctorate",
                name="degreelevel",
                native_enum=False,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("market_demand_score", sa.Float(), nullable=False, server_default="50"),
        sa.Column("salary_band", sa.String(length=50), nullable=True),
        sa.Column(
            "future_outlook",
            sa.Enum(
                "growth", "stable", "declining", name="futureoutlook", native_enum=False, length=20
            ),
            nullable=False,
            server_default="stable",
        ),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("local_relevance_score", sa.Float(), nullable=False, server_default="50"),
        sa.Column("deprecation_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deprioritized", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("suitable_age_bands", sa.JSON(), nullable=False),
        sa.Column("why_fa", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "majors",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("canonical_title", sa.String(length=200), nullable=False, unique=True),
        sa.Column("canonical_title_fa", sa.String(length=200), nullable=False),
        sa.Column("alt_titles", sa.JSON(), nullable=False),
        sa.Column(
            "degree_level",
            sa.Enum(
                "high_school_track",
                "vocational",
                "associate",
                "bachelor",
                "master",
                "doctorate",
                name="degreelevel",
                native_enum=False,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column("riasec_profile", sa.String(length=6), nullable=False),
        sa.Column("related_job_titles", sa.JSON(), nullable=False),
        sa.Column("core_skills", sa.JSON(), nullable=False),
        sa.Column("market_demand_score", sa.Float(), nullable=False, server_default="50"),
        sa.Column(
            "future_outlook",
            sa.Enum(
                "growth", "stable", "declining", name="futureoutlook", native_enum=False, length=20
            ),
            nullable=False,
            server_default="stable",
        ),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("local_relevance_score", sa.Float(), nullable=False, server_default="50"),
        sa.Column("deprecation_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deprioritized", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("suitable_age_bands", sa.JSON(), nullable=False),
        sa.Column("why_fa", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "recommendations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("holland_code", sa.String(length=3), nullable=False),
        sa.Column("mbti_type", sa.String(length=4), nullable=False),
        sa.Column("age_band", sa.String(length=10), nullable=False),
        sa.Column("careers", sa.JSON(), nullable=False),
        sa.Column("majors", sa.JSON(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False, server_default="50"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "recommendation_id",
            sa.String(length=36),
            sa.ForeignKey("recommendations.id"),
            nullable=True,
        ),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("holland_code", sa.String(length=3), nullable=False),
        sa.Column("mbti_type", sa.String(length=4), nullable=False),
        sa.Column("age_band", sa.String(length=10), nullable=False),
        sa.Column("summary_card", sa.JSON(), nullable=False),
        sa.Column("detailed_interpretation", sa.JSON(), nullable=False),
        sa.Column("action_plan", sa.JSON(), nullable=False),
        sa.Column("risk_flags", sa.JSON(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False, server_default="50"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_table("recommendations")
    op.drop_table("majors")
    op.drop_table("jobs")
