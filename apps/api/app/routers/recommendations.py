"""Phase 4: age-aware recommendation API."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.job import Job, Major
from ..schemas import RecommendationRequestV2, RecommendationResponseV2
from ..services.recommendation_engine import build_recommendations_v2

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=RecommendationResponseV2)
async def recommendations_v2(
    payload: RecommendationRequestV2,
    session: DbSession,
) -> RecommendationResponseV2:
    return await build_recommendations_v2(
        session,
        holland_code=payload.holland_code,
        mbti_type=payload.mbti_type,
        age=payload.age,
        limit=payload.limit,
    )


@router.get("/catalog/jobs")
async def list_job_catalog(session: DbSession) -> list[str]:
    result = await session.execute(
        select(Job.canonical_title_fa).where(Job.deprecation_flag.is_(False))
    )
    return list(result.scalars().all())


@router.get("/catalog/majors")
async def list_major_catalog(session: DbSession) -> list[str]:
    result = await session.execute(
        select(Major.canonical_title_fa).where(Major.deprecation_flag.is_(False))
    )
    return list(result.scalars().all())
