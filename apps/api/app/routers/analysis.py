"""
Analysis API Router Module.

Exposes two endpoint groups:

**Set A: Analysis Results (Read)**
- GET /api/assessments/{assessment_id}/analysis
  Returns analysis results for a user's assessment

**Set B: Analysis Templates (Admin/Analyst)**
- GET /api/analysis-templates: List templates
- GET /api/analysis-templates/{template_id}: Get template detail
- POST /api/analysis-templates: Create template
- PUT /api/analysis-templates/{template_id}: Update template
- DELETE /api/analysis-templates/{template_id}: Delete template

All endpoints enforce RBAC: users can view own analyses, analysts/admins manage templates.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.analysis_result import AnalysisResult
from app.models.analysis_template import AnalysisTemplate
from app.models.user import User
from app.schemas_analysis import (
    AnalysisResultResponse,
    AnalysisTemplateCreate,
    AnalysisTemplateResponse,
    AnalysisTemplateUpdate,
)
from app.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["analysis"])


# ============================================================================
# SET A: Analysis Results (Read)
# ============================================================================


@router.get(
    "/assessments/{assessment_id}/analysis",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get analysis results for an assessment",
)
async def get_assessment_analysis(
    assessment_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    Retrieve analysis results for a completed assessment.

    Fetches all AnalysisResult records for the given assessment.
    If composite test, includes composite analysis alongside individual results.

    Args:
        assessment_id: UUID of the assessment
        current_user: Authenticated user (from token)
        session: Database session

    Returns:
        Dict with:
        - analysis_results: List of AnalysisResult objects
        - composite: Composite AnalysisResult if multi-test (optional)

    Raises:
        403: User not authorized to view this assessment
        404: Assessment or analysis not found
    """
    logger.info(f"GET /assessments/{assessment_id}/analysis - user={current_user.id}")

    # Check user owns this assessment
    from app.models.assessment_session import AssessmentSession

    stmt = select(AssessmentSession).where(AssessmentSession.id == assessment_id)
    result = await session.execute(stmt)
    assessment = result.scalars().first()

    if not assessment:
        logger.warning(f"Assessment {assessment_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    if assessment.user_id != current_user.id and current_user.role.value not in ["admin", "analyst"]:
        logger.warning(
            f"User {current_user.id} not authorized to view assessment {assessment_id}"
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Fetch individual analyses
    stmt = select(AnalysisResult).where(AnalysisResult.assessment_id == assessment_id)
    result = await session.execute(stmt)
    analyses = result.scalars().all()

    if not analyses:
        logger.info(f"No analyses found for assessment {assessment_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No analyses found")

    # Separate composite from individual
    individual = [a for a in analyses if a.test_type != "composite"]
    composite = next((a for a in analyses if a.test_type == "composite"), None)

    response = {"analysis_results": [AnalysisResultResponse.from_orm(a) for a in individual]}
    if composite:
        response["composite"] = AnalysisResultResponse.from_orm(composite)

    logger.debug(f"Returning {len(individual)} individual analyses + composite={composite is not None}")
    return response


# ============================================================================
# SET B: Analysis Templates (Admin/Analyst)
# ============================================================================


@router.get(
    "/analysis-templates",
    response_model=list[AnalysisTemplateResponse],
    status_code=status.HTTP_200_OK,
    summary="List analysis templates",
)
async def list_analysis_templates(
    test_type: Optional[str] = None,
    age_branch: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[AnalysisTemplateResponse]:
    """
    List analysis templates with optional filtering.

    Only accessible to analyst+ roles.

    Args:
        test_type: Filter by test type (optional)
        age_branch: Filter by age branch (optional)
        current_user: Authenticated user
        session: Database session

    Returns:
        List of AnalysisTemplateResponse objects

    Raises:
        403: User does not have analyst+ role
    """
    logger.info(f"GET /analysis-templates - user={current_user.id}, filters: test_type={test_type}, age_branch={age_branch}")

    # Check RBAC: analyst+ only
    if current_user.role.value not in ["admin", "analyst"]:
        logger.warning(f"User {current_user.id} not authorized (role={current_user.role.value})")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Analyst+ role required")

    # Build query
    stmt = select(AnalysisTemplate)
    if test_type:
        stmt = stmt.where(AnalysisTemplate.test_type == test_type)
    if age_branch:
        stmt = stmt.where(AnalysisTemplate.age_branch == age_branch)

    result = await session.execute(stmt)
    templates = result.scalars().all()

    logger.debug(f"Returning {len(templates)} templates")
    return [AnalysisTemplateResponse.from_orm(t) for t in templates]


@router.get(
    "/analysis-templates/{template_id}",
    response_model=AnalysisTemplateResponse,
    status_code=status.HTTP_200_OK,
    summary="Get analysis template detail",
)
async def get_analysis_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> AnalysisTemplateResponse:
    """
    Retrieve a single analysis template by ID.

    Only accessible to analyst+ roles.

    Args:
        template_id: UUID of template
        current_user: Authenticated user
        session: Database session

    Returns:
        AnalysisTemplateResponse

    Raises:
        403: User does not have analyst+ role
        404: Template not found
    """
    logger.info(f"GET /analysis-templates/{template_id} - user={current_user.id}")

    if current_user.role.value not in ["admin", "analyst"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Analyst+ role required")

    stmt = select(AnalysisTemplate).where(AnalysisTemplate.id == template_id)
    result = await session.execute(stmt)
    template = result.scalars().first()

    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    return AnalysisTemplateResponse.from_orm(template)


@router.post(
    "/analysis-templates",
    response_model=AnalysisTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create analysis template",
)
async def create_analysis_template(
    payload: AnalysisTemplateCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> AnalysisTemplateResponse:
    """
    Create a new analysis template.

    Only accessible to admin role.

    Args:
        payload: AnalysisTemplateCreate schema
        current_user: Authenticated user
        session: Database session

    Returns:
        Created AnalysisTemplateResponse

    Raises:
        403: User does not have admin role
        409: Template with same test_type+age_branch already exists
    """
    logger.info(
        f"POST /analysis-templates - user={current_user.id}, "
        f"test_type={payload.test_type}, age_branch={payload.age_branch}"
    )

    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    # Check uniqueness
    stmt = select(AnalysisTemplate).where(
        (AnalysisTemplate.test_type == payload.test_type)
        & (AnalysisTemplate.age_branch == payload.age_branch)
    )
    result = await session.execute(stmt)
    existing = result.scalars().first()

    if existing:
        logger.warning(f"Template already exists for {payload.test_type}+{payload.age_branch}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Template with this test_type + age_branch already exists",
        )

    # Create
    from uuid import uuid4

    template = AnalysisTemplate(
        id=uuid4(),
        test_type=payload.test_type,
        age_branch=payload.age_branch,
        template_config_json=payload.template_config_json,
        version=payload.version or 1,
    )
    session.add(template)
    await session.commit()

    logger.info(f"Template created: {template.id}")
    return AnalysisTemplateResponse.from_orm(template)


@router.put(
    "/analysis-templates/{template_id}",
    response_model=AnalysisTemplateResponse,
    status_code=status.HTTP_200_OK,
    summary="Update analysis template",
)
async def update_analysis_template(
    template_id: UUID,
    payload: AnalysisTemplateUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> AnalysisTemplateResponse:
    """
    Update an analysis template.

    Only accessible to admin role. Updates config and increments version.

    Args:
        template_id: UUID of template
        payload: AnalysisTemplateUpdate schema
        current_user: Authenticated user
        session: Database session

    Returns:
        Updated AnalysisTemplateResponse

    Raises:
        403: User does not have admin role
        404: Template not found
    """
    logger.info(f"PUT /analysis-templates/{template_id} - user={current_user.id}")

    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    stmt = select(AnalysisTemplate).where(AnalysisTemplate.id == template_id)
    result = await session.execute(stmt)
    template = result.scalars().first()

    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    # Update config and increment version
    template.template_config_json = payload.template_config_json
    template.version += 1

    await session.commit()

    logger.info(f"Template updated: {template_id}, version now {template.version}")
    return AnalysisTemplateResponse.from_orm(template)


@router.delete(
    "/analysis-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete analysis template",
)
async def delete_analysis_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete an analysis template.

    Only accessible to admin role.

    Args:
        template_id: UUID of template
        current_user: Authenticated user
        session: Database session

    Raises:
        403: User does not have admin role
        404: Template not found
    """
    logger.info(f"DELETE /analysis-templates/{template_id} - user={current_user.id}")

    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    stmt = select(AnalysisTemplate).where(AnalysisTemplate.id == template_id)
    result = await session.execute(stmt)
    template = result.scalars().first()

    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    await session.delete(template)
    await session.commit()

    logger.info(f"Template deleted: {template_id}")
