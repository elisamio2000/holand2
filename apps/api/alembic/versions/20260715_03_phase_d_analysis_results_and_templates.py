"""Phase D: Add analysis_results and analysis_templates tables for composite analysis.

This migration introduces the core entities for Phase D (Composite Analysis Engine):

1. analysis_results: Stores completed assessment analysis with raw scores and findings
2. analysis_templates: DB-first configuration for rules, thresholds, narrative tone

The analysis workflow: AssessmentSession → ScoringModel (Phase C) → AnalysisTemplate (rules)
→ AnalysisResult (findings) → AIProvider (Phase E)

Revision ID: 20260715_03
Revises: 20260715_02
Create Date: 2026-07-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260715_03'
down_revision = '20260715_02'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create analysis_results and analysis_templates tables."""

    # analysis_templates table: stores configuration
    op.create_table(
        'analysis_templates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('test_type', sa.String(50), nullable=False),
        sa.Column('age_branch', sa.String(20), nullable=False),
        sa.Column('template_config_json', sa.JSON(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('test_type', 'age_branch', name='uq_test_type_age_branch'),
    )

    # analysis_results table: stores completed analyses
    op.create_table(
        'analysis_results',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('assessment_session_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('age_branch', sa.String(20), nullable=False),
        sa.Column('test_type', sa.String(50), nullable=False),
        sa.Column('raw_scores', sa.JSON(), nullable=False),
        sa.Column('results_json', sa.JSON(), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['assessment_session_id'], ['assessment_sessions.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes for common queries
    op.create_index('ix_analysis_results_assessment_session_id', 'analysis_results', ['assessment_session_id'])
    op.create_index('ix_analysis_results_user_id', 'analysis_results', ['user_id'])
    op.create_index('ix_analysis_results_test_type', 'analysis_results', ['test_type'])
    op.create_index('ix_analysis_templates_test_type', 'analysis_templates', ['test_type'])


def downgrade() -> None:
    """Drop analysis_results and analysis_templates tables."""
    op.drop_index('ix_analysis_templates_test_type', table_name='analysis_templates')
    op.drop_index('ix_analysis_results_test_type', table_name='analysis_results')
    op.drop_index('ix_analysis_results_user_id', table_name='analysis_results')
    op.drop_index('ix_analysis_results_assessment_session_id', table_name='analysis_results')
    op.drop_table('analysis_results')
    op.drop_table('analysis_templates')
