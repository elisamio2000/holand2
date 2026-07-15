from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..deps import require_admin
from ..models.scoring_model import ScoringModel
from ..models.assessment import AssessmentVersion
from ..schemas_assessment import ScoringFormulaDraftIn

router = APIRouter(prefix="/assessments", tags=["Scoring Models"], dependencies=[Depends(require_admin)])


@router.post("/{version_id}/scoring-models", status_code=201)
async def create_scoring_model(version_id: str, payload: ScoringFormulaDraftIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AssessmentVersion).where(AssessmentVersion.id == version_id))
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    # create model
    model = ScoringModel(
        assessment_version_id=version.id,
        name=payload.formula_key,
        algorithm="dsl",
        weight=1.0,
        output_type="score",
        config_json=payload.expression,
        version=1,
    )
    db.add(model)
    await db.flush()
    return model


@router.get("/{version_id}/scoring-models")
async def list_scoring_models(version_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScoringModel).where(ScoringModel.assessment_version_id == version_id))
    return result.scalars().all()


@router.put("/{version_id}/scoring-models/{model_id}")
async def update_scoring_model(version_id: str, model_id: str, payload: ScoringFormulaDraftIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScoringModel).where(ScoringModel.id == model_id, ScoringModel.assessment_version_id == version_id))
    model = result.scalar_one_or_none()
    if model is None:
        raise HTTPException(status_code=404, detail="Scoring model not found")
    model.name = payload.formula_key
    model.config_json = payload.expression
    model.version = model.version + 1
    await db.flush()
    return model


@router.delete("/{version_id}/scoring-models/{model_id}", status_code=204)
async def delete_scoring_model(version_id: str, model_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScoringModel).where(ScoringModel.id == model_id, ScoringModel.assessment_version_id == version_id))
    model = result.scalar_one_or_none()
    if model is None:
        raise HTTPException(status_code=404, detail="Scoring model not found")
    await db.delete(model)
    await db.flush()
    return None
