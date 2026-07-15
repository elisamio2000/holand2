from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..deps import require_admin
from ..models.assessment import AssessmentVersion, AssessmentBranch, Question
from ..schemas_assessment import QuestionDraftIn, QuestionReorderIn, QuestionOut, QuestionAdminOut
from ..services.branch_service import list_or_create_branches, init_branch, set_branch_state

router = APIRouter(prefix="/assessments", tags=["Assessments - Authoring"], dependencies=[Depends(require_admin)])


@router.get("/{version_id}/branches")
async def get_branches(version_id: str, db: AsyncSession = Depends(get_db)):
    # verify assessment version exists
    result = await db.execute(select(AssessmentVersion).where(AssessmentVersion.id == version_id))
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    branches = await list_or_create_branches(db, version_id)
    return branches


@router.post("/{version_id}/branches/{age_group}/init")
async def post_init_branch(version_id: str, age_group: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AssessmentVersion).where(AssessmentVersion.id == version_id))
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    branch = await init_branch(db, version_id, age_group)
    return branch


@router.put("/{version_id}/branches/{age_group}/state")
async def put_branch_state(version_id: str, age_group: str, payload: dict, db: AsyncSession = Depends(get_db)):
    new_state = payload.get("state")
    if new_state not in ("draft", "reviewed", "approved", "published"):
        raise HTTPException(status_code=400, detail="Invalid state")
    try:
        branch = await set_branch_state(db, version_id, age_group, new_state)
    except ValueError:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


# Simple question proxies (authoring-level convenience endpoints)
@router.get("/{version_id}/questions", response_model=list[QuestionOut])
async def get_questions(version_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AssessmentVersion)
        .options(selectinload(AssessmentVersion.questions).selectinload(Question.options))
        .where(AssessmentVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    return version.questions


@router.post("/{version_id}/questions", response_model=QuestionAdminOut, status_code=201)
async def create_question(version_id: str, payload: QuestionDraftIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AssessmentVersion).where(AssessmentVersion.id == version_id))
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    # ensure version is editable
    from ..models.assessment import VersionStatus
    if version.status != VersionStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Assessment version not editable")

    q = Question(
        assessment_version_id=version.id,
        kind=payload.kind,
        dimension=payload.dimension,
        text=payload.text,
        order_index=payload.order_index,
        is_reverse_scored=payload.is_reverse_scored,
    )
    db.add(q)
    await db.flush()
    # add options
    from ..models.assessment import QuestionOption
    for opt in payload.options:
        db.add(QuestionOption(question_id=q.id, label=opt.label, value=opt.value, pole=opt.pole, weight=opt.weight, order_index=opt.order_index))
    await db.flush()
    return q


@router.post("/{version_id}/questions/reorder")
async def reorder_questions(version_id: str, payload: QuestionReorderIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AssessmentVersion).where(AssessmentVersion.id == version_id))
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    from ..models.assessment import VersionStatus
    if version.status != VersionStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Assessment version not editable")
    by_id = {q.id: q for q in version.questions}
    for item in payload.items:
        question = by_id.get(item.question_id)
        if question is None:
            raise HTTPException(status_code=404, detail=f"Question {item.question_id} not found")
        question.order_index = item.order_index
    await db.flush()
    return version.questions


# Question updates and deletions
@router.put("/{version_id}/questions/{question_id}", response_model=QuestionAdminOut)
async def update_question(version_id: str, question_id: str, payload: QuestionDraftIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AssessmentVersion).where(AssessmentVersion.id == version_id))
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    from ..models.assessment import VersionStatus
    if version.status != VersionStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Assessment version not editable")
    
    result = await db.execute(select(Question).where(Question.id == question_id, Question.assessment_version_id == version_id))
    q = result.scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found")
    
    q.kind = payload.kind
    q.dimension = payload.dimension
    q.text = payload.text
    q.order_index = payload.order_index
    q.is_reverse_scored = payload.is_reverse_scored
    
    # Update options
    from ..models.assessment import QuestionOption
    await db.execute(
        select(QuestionOption).where(QuestionOption.question_id == q.id)
    )
    result = await db.execute(select(QuestionOption).where(QuestionOption.question_id == q.id))
    existing_opts = result.scalars().all()
    for opt in existing_opts:
        db.delete(opt)
    
    for opt in payload.options:
        db.add(QuestionOption(question_id=q.id, label=opt.label, value=opt.value, pole=opt.pole, weight=opt.weight, order_index=opt.order_index))
    
    await db.flush()
    return q


@router.delete("/{version_id}/questions/{question_id}", status_code=204)
async def delete_question(version_id: str, question_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AssessmentVersion).where(AssessmentVersion.id == version_id))
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    from ..models.assessment import VersionStatus
    if version.status != VersionStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Assessment version not editable")
    
    result = await db.execute(select(Question).where(Question.id == question_id, Question.assessment_version_id == version_id))
    q = result.scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found")
    
    db.delete(q)
    await db.flush()
