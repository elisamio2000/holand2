"""Admin LLM Integration Models - AI Provider Config, Prompt Templates, AI Reports"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import Base


class AIProviderConfig(Base):
    """
    Configuration for AI/LLM providers (vLLM, Ollama, OpenAI-compatible endpoints).
    Stores connection details, health status, and provider-specific settings.
    """

    __tablename__ = "ai_provider_configs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, comment="Provider display name (e.g., 'vLLM Production')")
    provider_type = Column(String(50), nullable=False, index=True, comment="Provider type: 'vllm', 'ollama', 'openai'")
    base_url = Column(String(500), nullable=False, comment="Base URL for API endpoint (e.g., http://localhost:18005)")
    api_key = Column(String(500), nullable=True, comment="Optional API key for authentication")
    default_model = Column(String(200), nullable=True, comment="Default model name to use")
    config_json = Column(JSONB, nullable=True, comment="Additional provider-specific config (timeout, headers, etc.)")
    is_active = Column(Boolean, default=False, nullable=False, index=True, comment="Whether this provider is currently active")
    is_primary = Column(Boolean, default=False, nullable=False, index=True, comment="Primary provider for new reports")
    health_status = Column(String(50), nullable=True, comment="Last health check status: 'healthy', 'degraded', 'offline'")
    last_health_check = Column(DateTime(timezone=True), nullable=True, comment="Timestamp of last successful health check")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    ai_reports = relationship("SessionAIReport", back_populates="provider_config", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<AIProviderConfig(id={self.id}, name='{self.name}', type='{self.provider_type}', active={self.is_active})>"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "name": self.name,
            "provider_type": self.provider_type,
            "base_url": self.base_url,
            "api_key_set": bool(self.api_key),  # Don't expose actual key
            "default_model": self.default_model,
            "config_json": self.config_json or {},
            "is_active": self.is_active,
            "is_primary": self.is_primary,
            "health_status": self.health_status,
            "last_health_check": self.last_health_check.isoformat() if self.last_health_check else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class LLMPromptTemplate(Base):
    """
    Prompt templates for LLM report generation.
    Supports Jinja2 placeholders: {{HOLLAND_CODE}}, {{MBTI_TYPE}}, {{AGE_BAND}}, etc.
    """

    __tablename__ = "llm_prompt_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, comment="Template identifier (e.g., 'holland_interpretation_v1')")
    template_type = Column(String(50), nullable=False, index=True, comment="Template category: 'holland', 'mbti', 'combined', 'career_path'")
    prompt_template = Column(Text, nullable=False, comment="Jinja2 template with placeholders")
    system_prompt = Column(Text, nullable=True, comment="Optional system prompt for models that support it")
    generation_params = Column(JSONB, nullable=True, comment="LLM params: temperature, max_tokens, top_p, etc.")
    is_active = Column(Boolean, default=True, nullable=False, index=True, comment="Whether this template is currently active")
    version = Column(Integer, default=1, nullable=False, comment="Version number for tracking template evolution")
    created_by = Column(Integer, nullable=True, comment="User ID who created this template")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    ai_reports = relationship("SessionAIReport", back_populates="template", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<LLMPromptTemplate(id={self.id}, name='{self.name}', type='{self.template_type}', v{self.version})>"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "name": self.name,
            "template_type": self.template_type,
            "prompt_template": self.prompt_template,
            "system_prompt": self.system_prompt,
            "generation_params": self.generation_params or {},
            "is_active": self.is_active,
            "version": self.version,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class SessionAIReport(Base):
    """
    AI-generated reports for assessment sessions.
    Stores LLM responses, prompts, metadata, and generation statistics.
    """

    __tablename__ = "session_ai_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Uuid(as_uuid=False), ForeignKey("assessment_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_config_id = Column(Integer, ForeignKey("ai_provider_configs.id", ondelete="SET NULL"), nullable=True, index=True)
    template_id = Column(Integer, ForeignKey("llm_prompt_templates.id", ondelete="SET NULL"), nullable=True)
    model_name = Column(String(200), nullable=True, comment="Actual model name used")
    prompt_sent = Column(Text, nullable=True, comment="Complete prompt sent to LLM (after template rendering)")
    raw_response = Column(Text, nullable=True, comment="Raw LLM response before parsing")
    parsed_sections = Column(JSONB, nullable=True, comment="Structured parsed sections")
    generation_time_ms = Column(Integer, nullable=True, comment="Time taken for LLM response in milliseconds")
    tokens_used = Column(Integer, nullable=True, comment="Approximate token count (prompt + completion)")
    status = Column(String(50), default="pending", nullable=False, index=True, comment="Generation status: pending, completed, failed, timeout")
    error_message = Column(Text, nullable=True, comment="Error details if status=failed")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    session = relationship("AssessmentSession", back_populates="ai_reports")
    provider_config = relationship("AIProviderConfig", back_populates="ai_reports")
    template = relationship("LLMPromptTemplate", back_populates="ai_reports")

    def __repr__(self) -> str:
        return f"<SessionAIReport(id={self.id}, session_id={self.session_id}, status='{self.status}')>"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "provider_config_id": self.provider_config_id,
            "template_id": self.template_id,
            "model_name": self.model_name,
            "prompt_sent": self.prompt_sent,
            "raw_response": self.raw_response,
            "parsed_sections": self.parsed_sections or {},
            "generation_time_ms": self.generation_time_ms,
            "tokens_used": self.tokens_used,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
