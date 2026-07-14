"""Admin LLM Configuration Router - Provider & Template Management, Model Discovery."""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ai_provider import AIProviderConfig, LLMPromptTemplate
from app.services.llm_provider_service import LLMProviderService

router = APIRouter(prefix="/admin/llm", tags=["Admin LLM"])


# ==========================================
# Pydantic Schemas
# ==========================================


class AIProviderCreate(BaseModel):
    name: str = Field(..., max_length=100, description="Provider display name")
    provider_type: str = Field(..., description="Provider type: vllm, ollama, openai")
    base_url: str = Field(..., description="Base URL (e.g., http://localhost:18005)")
    api_key: Optional[str] = None
    default_model: Optional[str] = None
    config_json: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = False
    is_primary: bool = False


class AIProviderUpdate(BaseModel):
    name: Optional[str] = None
    provider_type: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    default_model: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_primary: Optional[bool] = None


class LLMPromptTemplateCreate(BaseModel):
    name: str = Field(..., max_length=100)
    template_type: str = Field(..., description="holland, mbti, combined, career_path")
    prompt_template: str
    system_prompt: Optional[str] = None
    generation_params: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    version: int = 1


class LLMPromptTemplateUpdate(BaseModel):
    name: Optional[str] = None
    template_type: Optional[str] = None
    prompt_template: Optional[str] = None
    system_prompt: Optional[str] = None
    generation_params: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class GenerateAIReportRequest(BaseModel):
    template_id: Optional[int] = Field(None, description="Prompt template ID (auto-select if omitted)")
    provider_id: Optional[int] = Field(None, description="Provider ID (use primary if omitted)")


# ==========================================
# Provider Endpoints
# ==========================================


@router.get("/providers", summary="List all LLM providers")
async def list_providers(db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    """List all configured LLM providers with health status."""
    stmt = select(AIProviderConfig).order_by(AIProviderConfig.is_primary.desc(), AIProviderConfig.id)
    result = await db.execute(stmt)
    providers = result.scalars().all()
    return [p.to_dict() for p in providers]


@router.post("/providers", status_code=status.HTTP_201_CREATED, summary="Create new LLM provider")
async def create_provider(
    payload: AIProviderCreate,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Create a new LLM provider configuration."""
    # If setting as primary, unset other primaries
    if payload.is_primary:
        stmt = select(AIProviderConfig).where(AIProviderConfig.is_primary == True)
        result = await db.execute(stmt)
        for provider in result.scalars():
            provider.is_primary = False

    provider = AIProviderConfig(
        name=payload.name,
        provider_type=payload.provider_type,
        base_url=payload.base_url,
        api_key=payload.api_key,
        default_model=payload.default_model,
        config_json=payload.config_json,
        is_active=payload.is_active,
        is_primary=payload.is_primary,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider.to_dict()


@router.get("/providers/{provider_id}", summary="Get provider details")
async def get_provider(provider_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Get a single provider by ID."""
    stmt = select(AIProviderConfig).where(AIProviderConfig.id == provider_id)
    result = await db.execute(stmt)
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider.to_dict()


@router.patch("/providers/{provider_id}", summary="Update provider configuration")
async def update_provider(
    provider_id: int,
    payload: AIProviderUpdate,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Update an existing LLM provider."""
    stmt = select(AIProviderConfig).where(AIProviderConfig.id == provider_id)
    result = await db.execute(stmt)
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # If setting as primary, unset other primaries
    if payload.is_primary:
        stmt_other = select(AIProviderConfig).where(
            AIProviderConfig.is_primary == True,
            AIProviderConfig.id != provider_id,
        )
        other_result = await db.execute(stmt_other)
        for other_provider in other_result.scalars():
            other_provider.is_primary = False

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(provider, key, value)

    await db.commit()
    await db.refresh(provider)
    return provider.to_dict()


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(provider_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete an LLM provider."""
    stmt = select(AIProviderConfig).where(AIProviderConfig.id == provider_id)
    result = await db.execute(stmt)
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    await db.delete(provider)
    await db.commit()


@router.post("/providers/{provider_id}/discover-models", summary="Discover available models")
async def discover_models(provider_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Discover available models from the provider (vLLM /v1/models or Ollama /api/tags)."""
    service = LLMProviderService(db)
    return await service.discover_models(provider_id)


@router.post("/providers/{provider_id}/health-check", summary="Check provider health")
async def health_check(provider_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Check if provider is reachable and update health status."""
    service = LLMProviderService(db)
    return await service.health_check(provider_id)


# ==========================================
# Prompt Template Endpoints
# ==========================================


@router.get("/templates", summary="List all prompt templates")
async def list_templates(db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    """List all configured prompt templates."""
    stmt = select(LLMPromptTemplate).order_by(LLMPromptTemplate.template_type, LLMPromptTemplate.version.desc())
    result = await db.execute(stmt)
    templates = result.scalars().all()
    return [t.to_dict() for t in templates]


@router.post("/templates", status_code=status.HTTP_201_CREATED, summary="Create new prompt template")
async def create_template(
    payload: LLMPromptTemplateCreate,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Create a new LLM prompt template."""
    template = LLMPromptTemplate(
        name=payload.name,
        template_type=payload.template_type,
        prompt_template=payload.prompt_template,
        system_prompt=payload.system_prompt,
        generation_params=payload.generation_params,
        is_active=payload.is_active,
        version=payload.version,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template.to_dict()


@router.get("/templates/{template_id}", summary="Get template details")
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Get a single template by ID."""
    stmt = select(LLMPromptTemplate).where(LLMPromptTemplate.id == template_id)
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template.to_dict()


@router.patch("/templates/{template_id}", summary="Update prompt template")
async def update_template(
    template_id: int,
    payload: LLMPromptTemplateUpdate,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Update an existing prompt template."""
    stmt = select(LLMPromptTemplate).where(LLMPromptTemplate.id == template_id)
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)
    return template.to_dict()


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a prompt template."""
    stmt = select(LLMPromptTemplate).where(LLMPromptTemplate.id == template_id)
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(template)
    await db.commit()


# ==========================================
# AI Report Generation Endpoint
# ==========================================


@router.post("/sessions/{session_id}/generate-ai-report", summary="Generate AI report for session")
async def generate_ai_report(
    session_id: str,
    payload: GenerateAIReportRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Generate AI-powered report for a completed assessment session.
    Falls back gracefully if LLM is unavailable (returns rule-based interpretation).
    """
    service = LLMProviderService(db)
    return await service.generate_ai_report(
        session_id=session_id,
        template_id=payload.template_id,
        provider_id=payload.provider_id,
    )
