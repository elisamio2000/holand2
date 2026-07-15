from __future__ import annotations

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models.assessment import AssessmentBranch, AssessmentVersion, Question, QuestionOption, VersionStatus


async def list_or_create_branches(db: AsyncSession, assessment_version_id: str) -> list[AssessmentBranch]:
    result = await db.execute(select(AssessmentBranch).where(AssessmentBranch.assessment_version_id == assessment_version_id))
    branches = result.scalars().all()
    if branches:
        return branches

    # Seed default 4 branches
    defaults = ["child", "teen", "adult", "senior"]
    for age in defaults:
        b = AssessmentBranch(assessment_version_id=assessment_version_id, age_group=age, state="draft", created_from_id=assessment_version_id)
        db.add(b)
    await db.flush()
    result = await db.execute(select(AssessmentBranch).where(AssessmentBranch.assessment_version_id == assessment_version_id))
    return result.scalars().all()


async def _next_version_number(db: AsyncSession, assessment_type: str) -> int:
    result = await db.execute(select(func.max(AssessmentVersion.version)).where(AssessmentVersion.assessment_type == assessment_type))
    latest = result.scalars().first()
    return (latest or 0) + 1


async def init_branch(db: AsyncSession, assessment_version_id: str, age_group: str) -> AssessmentBranch:
    # Find parent assessment version
    result = await db.execute(select(AssessmentVersion).where(AssessmentVersion.id == assessment_version_id).execution_options(populate_existing=True))
    parent = result.scalar_one_or_none()
    if parent is None:
        raise ValueError("Assessment version not found")

    # Ensure branch row exists
    result = await db.execute(
        select(AssessmentBranch).where(
            AssessmentBranch.assessment_version_id == assessment_version_id,
            AssessmentBranch.age_group == age_group,
        )
    )
    branch = result.scalar_one_or_none()
    if branch is None:
        branch = AssessmentBranch(assessment_version_id=assessment_version_id, age_group=age_group, state="draft", created_from_id=assessment_version_id)
        db.add(branch)
        await db.flush()

    # If branch already has branch_version_id, nothing to do
    if branch.branch_version_id:
        return branch

    # Clone parent AssessmentVersion into a new draft version for the branch
    next_ver = await _next_version_number(db, parent.assessment_type)
    new_title = f"{parent.title} ({age_group} branch)"
    new_version = AssessmentVersion(
        assessment_type=parent.assessment_type,
        version=next_ver,
        status=VersionStatus.DRAFT,
        title=new_title,
        notes=parent.notes,
    )

    db.add(new_version)
    await db.flush()

    # Clone questions and options
    await db.refresh(parent)
    for q in parent.questions:
        new_q = Question(
            assessment_version_id=new_version.id,
            kind=q.kind,
            dimension=q.dimension,
            text=q.text,
            age_variants=q.age_variants,
            order_index=q.order_index,
            is_reverse_scored=q.is_reverse_scored,
        )
        db.add(new_q)
        await db.flush()
        for opt in q.options:
            db.add(
                QuestionOption(
                    question_id=new_q.id,
                    label=opt.label,
                    value=opt.value,
                    pole=opt.pole,
                    weight=opt.weight,
                    order_index=opt.order_index,
                )
            )
    await db.flush()

    branch.created_from_id = assessment_version_id
    branch.branch_version_id = new_version.id
    await db.flush()
    return branch


async def set_branch_state(db: AsyncSession, assessment_version_id: str, age_group: str, new_state: str) -> AssessmentBranch:
    result = await db.execute(
        select(AssessmentBranch).where(
            AssessmentBranch.assessment_version_id == assessment_version_id,
            AssessmentBranch.age_group == age_group,
        )
    )
    branch = result.scalar_one_or_none()
    if branch is None:
        raise ValueError("Branch not found")
    branch.state = new_state
    await db.flush()
    return branch
