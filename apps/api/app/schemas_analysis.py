"""
Analysis API Schemas.

Pydantic models for request/response validation in analysis endpoints.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AnalysisResultResponse(BaseModel):
    """Response model for AnalysisResult entity."""

    id: UUID
    assessment_id: UUID
    user_id: UUID
    age_branch: str
    test_type: str
    raw_scores: dict[str, Any]
    results_json: dict[str, Any]
    generated_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisTemplateResponse(BaseModel):
    """Response model for AnalysisTemplate entity."""

    id: UUID
    test_type: str
    age_branch: str
    template_config_json: dict[str, Any]
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisTemplateCreate(BaseModel):
    """Request model for creating AnalysisTemplate."""

    test_type: str = Field(..., description="Test type identifier (e.g., 'holland', 'mbti')")
    age_branch: str = Field(..., description="Age branch (child/teen/adult/senior)")
    template_config_json: dict[str, Any] = Field(
        ...,
        description="Template configuration with rules, thresholds, tone, character limits",
    )
    version: Optional[int] = Field(default=1, description="Template version")


class AnalysisTemplateUpdate(BaseModel):
    """Request model for updating AnalysisTemplate."""

    template_config_json: dict[str, Any] = Field(
        ..., description="Updated template configuration"
    )
