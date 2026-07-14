"""Phase 6: Admin LLM Integration - Provider Config, Prompt Templates, AI Reports

Revision ID: 20260710_01
Revises: f66a241cdea3
Create Date: 2026-07-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '20260710_01'
down_revision = 'f66a241cdea3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==========================================
    # ai_provider_configs table
    # ==========================================
    op.create_table(
        'ai_provider_configs',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=100), nullable=False, unique=True, comment='Provider display name (e.g., "vLLM Production")'),
        sa.Column('provider_type', sa.String(length=50), nullable=False, comment='Provider type: "vllm", "ollama", "openai"'),
        sa.Column('base_url', sa.String(length=500), nullable=False, comment='Base URL for API endpoint (e.g., http://localhost:18005)'),
        sa.Column('api_key', sa.String(length=500), nullable=True, comment='Optional API key for authentication'),
        sa.Column('default_model', sa.String(length=200), nullable=True, comment='Default model name to use'),
        sa.Column('config_json', JSONB(), nullable=True, comment='Additional provider-specific config (timeout, headers, etc.)'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='Whether this provider is currently active'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='Primary provider for new reports'),
        sa.Column('health_status', sa.String(length=50), nullable=True, comment='Last health check status: "healthy", "degraded", "offline"'),
        sa.Column('last_health_check', sa.DateTime(timezone=True), nullable=True, comment='Timestamp of last successful health check'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_ai_provider_configs_provider_type', 'ai_provider_configs', ['provider_type'])
    op.create_index('ix_ai_provider_configs_is_active', 'ai_provider_configs', ['is_active'])
    op.create_index('ix_ai_provider_configs_is_primary', 'ai_provider_configs', ['is_primary'])

    # ==========================================
    # llm_prompt_templates table
    # ==========================================
    op.create_table(
        'llm_prompt_templates',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=100), nullable=False, unique=True, comment='Template identifier (e.g., "holland_interpretation_v1")'),
        sa.Column('template_type', sa.String(length=50), nullable=False, comment='Template category: "holland", "mbti", "combined", "career_path"'),
        sa.Column('prompt_template', sa.Text(), nullable=False, comment='Jinja2 template with placeholders: {{HOLLAND_CODE}}, {{MBTI_TYPE}}, {{AGE_BAND}}, etc.'),
        sa.Column('system_prompt', sa.Text(), nullable=True, comment='Optional system prompt for models that support it'),
        sa.Column('generation_params', JSONB(), nullable=True, comment='LLM params: temperature, max_tokens, top_p, etc.'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true'), comment='Whether this template is currently active'),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1'), comment='Version number for tracking template evolution'),
        sa.Column('created_by', sa.Integer(), nullable=True, comment='User ID who created this template'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_llm_prompt_templates_template_type', 'llm_prompt_templates', ['template_type'])
    op.create_index('ix_llm_prompt_templates_is_active', 'llm_prompt_templates', ['is_active'])

    # ==========================================
    # session_ai_reports table
    # ==========================================
    op.create_table(
        'session_ai_reports',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('session_id', sa.Uuid(as_uuid=False), sa.ForeignKey('assessment_sessions.id', ondelete='CASCADE'), nullable=False, comment='Reference to assessment session'),
        sa.Column('provider_config_id', sa.Integer(), sa.ForeignKey('ai_provider_configs.id', ondelete='SET NULL'), nullable=True, comment='Provider used for generation'),
        sa.Column('template_id', sa.Integer(), sa.ForeignKey('llm_prompt_templates.id', ondelete='SET NULL'), nullable=True, comment='Template used for generation'),
        sa.Column('model_name', sa.String(length=200), nullable=True, comment='Actual model name used (may differ from provider default)'),
        sa.Column('prompt_sent', sa.Text(), nullable=True, comment='Complete prompt sent to LLM (after template rendering)'),
        sa.Column('raw_response', sa.Text(), nullable=True, comment='Raw LLM response before parsing'),
        sa.Column('parsed_sections', JSONB(), nullable=True, comment='Structured parsed sections: {personality: "", strengths: "", careers: [], etc.}'),
        sa.Column('generation_time_ms', sa.Integer(), nullable=True, comment='Time taken for LLM response in milliseconds'),
        sa.Column('tokens_used', sa.Integer(), nullable=True, comment='Approximate token count (prompt + completion)'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default=sa.text("'pending'"), comment='Generation status: "pending", "completed", "failed", "timeout"'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='Error details if status=failed'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_session_ai_reports_session_id', 'session_ai_reports', ['session_id'])
    op.create_index('ix_session_ai_reports_status', 'session_ai_reports', ['status'])
    op.create_index('ix_session_ai_reports_provider_config_id', 'session_ai_reports', ['provider_config_id'])

    # Insert default vLLM provider config
    op.execute("""
        INSERT INTO ai_provider_configs (name, provider_type, base_url, is_active, is_primary, health_status, config_json)
        VALUES (
            'vLLM Local (Port 18005)',
            'vllm',
            'http://localhost:18005',
            true,
            true,
            'unknown',
            '{"timeout": 60, "verify_ssl": false}'::jsonb
        )
    """)

    # Insert default Holland interpretation template
    op.execute("""
        INSERT INTO llm_prompt_templates (name, template_type, prompt_template, system_prompt, generation_params, is_active)
        VALUES (
            'holland_detailed_interpretation_v1',
            'holland',
            'شما یک مشاور شغلی حرفه‌ای هستید. کاربر تست هالند را انجام داده و کد شخصیتی او {{HOLLAND_CODE}} است (RIASEC). سن کاربر در بازه {{AGE_BAND}} است.

لطفاً یک تفسیر جامع و شخصی‌سازی شده برای این کاربر بنویسید که شامل موارد زیر باشد:

1. **توضیح شخصیت**: توصیف کامل از ویژگی‌های شخصیتی بر اساس کد {{HOLLAND_CODE}}
2. **نقاط قوت**: حداقل 4-5 نقطه قوت کاربر
3. **چالش‌های احتمالی**: موانع و چالش‌هایی که ممکن است در مسیر شغلی با آن مواجه شود
4. **پیشنهاد شغلی**: حداقل 8-10 شغل مناسب (با توجه به بازه سنی {{AGE_BAND}})
5. **پیشنهاد رشته تحصیلی**: 5-7 رشته دانشگاهی مرتبط
6. **برنامه عملی**: اقدامات عملی 3 ماهه، 6 ماهه و 12 ماهه

خروجی را به فارسی و با فرمت JSON ارائه دهید:
{
  "personality_description": "...",
  "strengths": ["...", "..."],
  "challenges": ["...", "..."],
  "recommended_jobs": [{"title": "...", "fit_score": 90}, ...],
  "recommended_majors": [{"title": "...", "universities": ["...", "..."]}, ...],
  "action_plan": {
    "3_months": ["...", "..."],
    "6_months": ["...", "..."],
    "12_months": ["...", "..."]
  }
}',
            'شما یک مشاور شغلی خبره با تخصص در تفسیر تست‌های شخصیت‌شناسی هستید. همواره پاسخ‌های دقیق، کاربردی و امیدوارکننده ارائه دهید.',
            '{"temperature": 0.7, "max_tokens": 2000, "top_p": 0.9}'::jsonb,
            true
        )
    """)


def downgrade() -> None:
    op.drop_index('ix_session_ai_reports_provider_config_id', table_name='session_ai_reports')
    op.drop_index('ix_session_ai_reports_status', table_name='session_ai_reports')
    op.drop_index('ix_session_ai_reports_session_id', table_name='session_ai_reports')
    op.drop_table('session_ai_reports')

    op.drop_index('ix_llm_prompt_templates_is_active', table_name='llm_prompt_templates')
    op.drop_index('ix_llm_prompt_templates_template_type', table_name='llm_prompt_templates')
    op.drop_table('llm_prompt_templates')

    op.drop_index('ix_ai_provider_configs_is_primary', table_name='ai_provider_configs')
    op.drop_index('ix_ai_provider_configs_is_active', table_name='ai_provider_configs')
    op.drop_index('ix_ai_provider_configs_provider_type', table_name='ai_provider_configs')
    op.drop_table('ai_provider_configs')
