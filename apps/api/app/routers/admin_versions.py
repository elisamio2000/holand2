"""Versioning / governance API for the question bank & scoring formulas
(Phase 2) — see docs/technical-architecture-fa.md #7 for the endpoint list
this implements (draft/simulate/review/approve/publish/rollback/diff)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.assessment import (
    AssessmentType,
    AssessmentVersion,
    Question,
    QuestionOption,
    ScoringFormulaVersion,
    VersionAuditLog,
    VersionEntityType,
    VersionStatus,
)
from ..schemas_assessment import (
    AssessmentVersionDetailOut,
    AssessmentVersionDraftIn,
    AssessmentVersionOut,
    AuditLogEntryOut,
    QuestionBankQualityReportOut,
    RollbackIn,
    ScoringFormulaDraftIn,
    ScoringFormulaVersionOut,
    SimulateAssessmentVersionIn,
    SimulateFormulaIn,
    SimulateFormulaOut,
    SimulateResultOut,
    VersionActionIn,
    VersionDiffOut,
)
from ..services.assessment_scoring import compute_session_result
from ..services.formula_engine import FormulaError, evaluate_formula, validate_formula
from ..services.question_bank_quality import build_quality_report
from ..services.versioning import VersioningError, assert_transition_allowed, log_transition

router = APIRouter(prefix="/admin", tags=["Question Bank Governance"])


def _now() -> datetime:
    return datetime.now(timezone.utc)  # noqa: UP017


# ── helpers ───────────────────────────────────────────────────────────────────
async def _get_assessment_version(db: AsyncSession, version_id: str) -> AssessmentVersion:
    result = await db.execute(
        select(AssessmentVersion)
        .options(selectinload(AssessmentVersion.questions).selectinload(Question.options))
        .where(AssessmentVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    return version


async def _get_formula_version(db: AsyncSession, formula_id: str) -> ScoringFormulaVersion:
    result = await db.execute(
        select(ScoringFormulaVersion).where(ScoringFormulaVersion.id == formula_id)
    )
    formula = result.scalar_one_or_none()
    if formula is None:
        raise HTTPException(status_code=404, detail="Formula version not found")
    return formula


async def _next_version_number(
    db: AsyncSession, model, filter_col, filter_value
) -> int:
    result = await db.execute(
        select(model.version).where(filter_col == filter_value).order_by(model.version.desc())
    )
    latest = result.scalars().first()
    return (latest or 0) + 1


# ── Assessment versions: create / read ───────────────────────────────────────
@router.post(
    "/assessment-versions/draft",
    response_model=AssessmentVersionDetailOut,
    status_code=201,
)
async def create_assessment_version_draft(
    payload: AssessmentVersionDraftIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentVersion:
    version_number = await _next_version_number(
        db, AssessmentVersion, AssessmentVersion.assessment_type, payload.assessment_type
    )

    draft = AssessmentVersion(
        assessment_type=payload.assessment_type,
        version=version_number,
        status=VersionStatus.DRAFT,
        title=payload.title,
        notes=payload.notes,
        created_by=payload.created_by,
    )
    db.add(draft)
    await db.flush()

    if payload.clone_from_version_id:
        source = await _get_assessment_version(db, payload.clone_from_version_id)
        for q in source.questions:
            new_q = Question(
                assessment_version_id=draft.id,
                kind=q.kind,
                dimension=q.dimension,
                text=q.text,
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
    else:
        for q in payload.questions:
            new_q = Question(
                assessment_version_id=draft.id,
                kind=q.kind,
                dimension=q.dimension,
                text=q.text,
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

    await log_transition(
        db,
        entity_type=VersionEntityType.ASSESSMENT_VERSION,
        entity_id=draft.id,
        action="create_draft",
        from_status=None,
        to_status=VersionStatus.DRAFT,
        actor=payload.created_by,
    )
    await db.flush()
    return await _get_assessment_version(db, draft.id)


@router.get("/assessment-versions", response_model=list[AssessmentVersionOut])
async def list_assessment_versions(
    assessment_type: Annotated[AssessmentType | None, Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[AssessmentVersion]:
    stmt = select(AssessmentVersion).order_by(
        AssessmentVersion.assessment_type, AssessmentVersion.version
    )
    if assessment_type is not None:
        stmt = stmt.where(AssessmentVersion.assessment_type == assessment_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/assessment-versions/{version_id}", response_model=AssessmentVersionDetailOut)
async def get_assessment_version(
    version_id: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> AssessmentVersion:
    return await _get_assessment_version(db, version_id)


@router.get(
    "/assessment-versions/{version_id}/quality-report",
    response_model=QuestionBankQualityReportOut,
)
async def get_assessment_version_quality_report(
    version_id: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> QuestionBankQualityReportOut:
    version = await _get_assessment_version(db, version_id)
    report = build_quality_report(version.assessment_type, version.questions)
    return QuestionBankQualityReportOut.model_validate(report)


# ── Assessment versions: workflow transitions ────────────────────────────────
async def _transition_assessment_version(
    db: AsyncSession, version_id: str, target: VersionStatus, payload: VersionActionIn
) -> AssessmentVersion:
    version = await _get_assessment_version(db, version_id)
    try:
        assert_transition_allowed(version.status, target)
    except VersioningError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    from_status = version.status
    version.status = target
    if target == VersionStatus.APPROVED:
        version.approved_by = payload.actor
    if target == VersionStatus.PUBLISHED:
        # Archive any currently-published version of the same assessment type.
        result = await db.execute(
            select(AssessmentVersion).where(
                AssessmentVersion.assessment_type == version.assessment_type,
                AssessmentVersion.status == VersionStatus.PUBLISHED,
                AssessmentVersion.id != version.id,
            )
        )
        for prev in result.scalars().all():
            prev.status = VersionStatus.ARCHIVED
            prev.effective_to = _now()
            await log_transition(
                db,
                entity_type=VersionEntityType.ASSESSMENT_VERSION,
                entity_id=prev.id,
                action="superseded",
                from_status=VersionStatus.PUBLISHED,
                to_status=VersionStatus.ARCHIVED,
                actor=payload.actor,
                note=f"Superseded by version {version.version}",
            )
        version.effective_from = _now()

    await log_transition(
        db,
        entity_type=VersionEntityType.ASSESSMENT_VERSION,
        entity_id=version.id,
        action=target.value,
        from_status=from_status,
        to_status=target,
        actor=payload.actor,
        note=payload.note,
    )
    await db.flush()
    return await _get_assessment_version(db, version.id)


@router.post("/assessment-versions/{version_id}/review", response_model=AssessmentVersionDetailOut)
async def review_assessment_version(
    version_id: str,
    payload: VersionActionIn | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AssessmentVersion:
    payload = payload or VersionActionIn()
    return await _transition_assessment_version(db, version_id, VersionStatus.REVIEWED, payload)


@router.post("/assessment-versions/{version_id}/approve", response_model=AssessmentVersionDetailOut)
async def approve_assessment_version(
    version_id: str,
    payload: VersionActionIn | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AssessmentVersion:
    payload = payload or VersionActionIn()
    return await _transition_assessment_version(db, version_id, VersionStatus.APPROVED, payload)


@router.post("/assessment-versions/{version_id}/publish", response_model=AssessmentVersionDetailOut)
async def publish_assessment_version(
    version_id: str,
    payload: VersionActionIn | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AssessmentVersion:
    payload = payload or VersionActionIn()
    return await _transition_assessment_version(db, version_id, VersionStatus.PUBLISHED, payload)


@router.post("/assessment-versions/{version_id}/rollback", response_model=AssessmentVersionDetailOut)
async def rollback_assessment_version(
    version_id: str,
    payload: RollbackIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AssessmentVersion:
    """Clone `target_version_id`'s content into a brand-new published version,
    archiving whatever is currently published for this assessment type."""
    current = await _get_assessment_version(db, version_id)
    target = await _get_assessment_version(db, payload.target_version_id)
    if target.assessment_type != current.assessment_type:
        raise HTTPException(status_code=400, detail="Rollback target must be the same assessment type")

    version_number = await _next_version_number(
        db, AssessmentVersion, AssessmentVersion.assessment_type, current.assessment_type
    )
    new_version = AssessmentVersion(
        assessment_type=target.assessment_type,
        version=version_number,
        status=VersionStatus.PUBLISHED,
        title=f"{target.title} (rollback)",
        notes=payload.note,
        created_by=payload.actor,
        approved_by=payload.actor,
        rollback_of=target.id,
        effective_from=_now(),
    )
    db.add(new_version)
    await db.flush()

    for q in target.questions:
        new_q = Question(
            assessment_version_id=new_version.id,
            kind=q.kind,
            dimension=q.dimension,
            text=q.text,
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

    if current.status == VersionStatus.PUBLISHED:
        current.status = VersionStatus.ARCHIVED
        current.effective_to = _now()

    await log_transition(
        db,
        entity_type=VersionEntityType.ASSESSMENT_VERSION,
        entity_id=new_version.id,
        action="rollback",
        from_status=current.status,
        to_status=VersionStatus.PUBLISHED,
        actor=payload.actor,
        note=f"Rolled back to content of version {target.version}",
    )
    await db.flush()
    return await _get_assessment_version(db, new_version.id)


@router.get("/assessment-versions/{version_id}/diff", response_model=VersionDiffOut)
async def diff_assessment_versions(
    version_id: str,
    compare_to: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> VersionDiffOut:
    a = await _get_assessment_version(db, version_id)
    b = await _get_assessment_version(db, compare_to)

    def _key(q: Question) -> tuple[str, str]:
        return (q.dimension, q.text)

    a_by_key = {_key(q): q for q in a.questions}
    b_by_key = {_key(q): q for q in b.questions}

    added = [
        {"dimension": k[0], "text": k[1]} for k in b_by_key.keys() - a_by_key.keys()
    ]
    removed = [
        {"dimension": k[0], "text": k[1]} for k in a_by_key.keys() - b_by_key.keys()
    ]
    changed = []
    for key in a_by_key.keys() & b_by_key.keys():
        qa, qb = a_by_key[key], b_by_key[key]
        a_weights = {(o.pole, o.value): o.weight for o in qa.options}
        b_weights = {(o.pole, o.value): o.weight for o in qb.options}
        if a_weights != b_weights or qa.order_index != qb.order_index:
            changed.append(
                {
                    "dimension": key[0],
                    "text": key[1],
                    "from_weights": {f"{p}:{v}": w for (p, v), w in a_weights.items()},
                    "to_weights": {f"{p}:{v}": w for (p, v), w in b_weights.items()},
                }
            )

    return VersionDiffOut(
        from_version_id=a.id, to_version_id=b.id, added=added, removed=removed, changed=changed
    )


@router.post("/assessment-versions/{version_id}/simulate", response_model=SimulateResultOut)
async def simulate_assessment_version(
    version_id: str,
    payload: SimulateAssessmentVersionIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> SimulateResultOut:
    """Sandbox: score a hypothetical answer set against a draft (or any) version
    without persisting a session — see docs #6 Impact Analysis / Sandbox."""
    version = await _get_assessment_version(db, version_id)

    raw_totals: dict[str, float] = {}
    for ans in payload.answers:
        if not (0 <= ans.question_index < len(version.questions)):
            raise HTTPException(status_code=400, detail=f"Invalid question_index {ans.question_index}")
        question = version.questions[ans.question_index]
        if not (0 <= ans.option_index < len(question.options)):
            raise HTTPException(status_code=400, detail=f"Invalid option_index {ans.option_index}")
        option = question.options[ans.option_index]
        raw_totals[option.pole] = raw_totals.get(option.pole, 0.0) + option.weight

    formula = await _latest_published_formula(db, version.assessment_type)
    result = compute_session_result(version.assessment_type, raw_totals, formula)
    return SimulateResultOut(
        raw_scores=raw_totals,
        normalized_scores=result["normalized_scores"],
        code=result["code"],
        certainty=result["certainty"],
    )


async def _latest_published_formula(
    db: AsyncSession, assessment_type: AssessmentType
) -> ScoringFormulaVersion | None:
    result = await db.execute(
        select(ScoringFormulaVersion).where(
            ScoringFormulaVersion.assessment_type == assessment_type,
            ScoringFormulaVersion.status == VersionStatus.PUBLISHED,
        )
    )
    return result.scalars().first()


# ── Scoring formula versions ─────────────────────────────────────────────────
@router.post("/formula-versions/draft", response_model=ScoringFormulaVersionOut, status_code=201)
async def create_formula_version_draft(
    payload: ScoringFormulaDraftIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ScoringFormulaVersion:
    try:
        validate_formula(payload.expression.get("expr", ""), payload.input_variables)
    except FormulaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    version_number = await _next_version_number(
        db, ScoringFormulaVersion, ScoringFormulaVersion.formula_key, payload.formula_key
    )
    draft = ScoringFormulaVersion(
        formula_key=payload.formula_key,
        assessment_type=payload.assessment_type,
        version=version_number,
        status=VersionStatus.DRAFT,
        expression=payload.expression,
        input_variables=payload.input_variables,
        output_metric=payload.output_metric,
        validation_rules=payload.validation_rules,
        unit_tests=payload.unit_tests,
        created_by=payload.created_by,
    )
    db.add(draft)
    await db.flush()
    await log_transition(
        db,
        entity_type=VersionEntityType.FORMULA_VERSION,
        entity_id=draft.id,
        action="create_draft",
        from_status=None,
        to_status=VersionStatus.DRAFT,
        actor=payload.created_by,
    )
    await db.flush()
    await db.refresh(draft)
    return draft


@router.get("/formula-versions", response_model=list[ScoringFormulaVersionOut])
async def list_formula_versions(
    formula_key: Annotated[str | None, Query()] = None,
    assessment_type: Annotated[AssessmentType | None, Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[ScoringFormulaVersion]:
    stmt = select(ScoringFormulaVersion).order_by(
        ScoringFormulaVersion.formula_key, ScoringFormulaVersion.version
    )
    if formula_key is not None:
        stmt = stmt.where(ScoringFormulaVersion.formula_key == formula_key)
    if assessment_type is not None:
        stmt = stmt.where(ScoringFormulaVersion.assessment_type == assessment_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/formula-versions/{formula_id}", response_model=ScoringFormulaVersionOut)
async def get_formula_version(
    formula_id: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> ScoringFormulaVersion:
    return await _get_formula_version(db, formula_id)


async def _transition_formula_version(
    db: AsyncSession, formula_id: str, target: VersionStatus, payload: VersionActionIn
) -> ScoringFormulaVersion:
    formula = await _get_formula_version(db, formula_id)
    try:
        assert_transition_allowed(formula.status, target)
    except VersioningError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    from_status = formula.status
    formula.status = target
    if target == VersionStatus.APPROVED:
        formula.approved_by = payload.actor
    if target == VersionStatus.PUBLISHED:
        result = await db.execute(
            select(ScoringFormulaVersion).where(
                ScoringFormulaVersion.formula_key == formula.formula_key,
                ScoringFormulaVersion.status == VersionStatus.PUBLISHED,
                ScoringFormulaVersion.id != formula.id,
            )
        )
        for prev in result.scalars().all():
            prev.status = VersionStatus.ARCHIVED
            prev.effective_to = _now()
            await log_transition(
                db,
                entity_type=VersionEntityType.FORMULA_VERSION,
                entity_id=prev.id,
                action="superseded",
                from_status=VersionStatus.PUBLISHED,
                to_status=VersionStatus.ARCHIVED,
                actor=payload.actor,
                note=f"Superseded by version {formula.version}",
            )
        formula.effective_from = _now()

    await log_transition(
        db,
        entity_type=VersionEntityType.FORMULA_VERSION,
        entity_id=formula.id,
        action=target.value,
        from_status=from_status,
        to_status=target,
        actor=payload.actor,
        note=payload.note,
    )
    await db.flush()
    await db.refresh(formula)
    return formula


@router.post("/formula-versions/{formula_id}/review", response_model=ScoringFormulaVersionOut)
async def review_formula_version(
    formula_id: str,
    payload: VersionActionIn | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ScoringFormulaVersion:
    payload = payload or VersionActionIn()
    return await _transition_formula_version(db, formula_id, VersionStatus.REVIEWED, payload)


@router.post("/formula-versions/{formula_id}/approve", response_model=ScoringFormulaVersionOut)
async def approve_formula_version(
    formula_id: str,
    payload: VersionActionIn | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ScoringFormulaVersion:
    payload = payload or VersionActionIn()
    return await _transition_formula_version(db, formula_id, VersionStatus.APPROVED, payload)


@router.post("/formula-versions/{formula_id}/publish", response_model=ScoringFormulaVersionOut)
async def publish_formula_version(
    formula_id: str,
    payload: VersionActionIn | None = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ScoringFormulaVersion:
    payload = payload or VersionActionIn()
    return await _transition_formula_version(db, formula_id, VersionStatus.PUBLISHED, payload)


@router.post("/formula-versions/{formula_id}/rollback", response_model=ScoringFormulaVersionOut)
async def rollback_formula_version(
    formula_id: str,
    payload: RollbackIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ScoringFormulaVersion:
    current = await _get_formula_version(db, formula_id)
    target = await _get_formula_version(db, payload.target_version_id)
    if target.formula_key != current.formula_key:
        raise HTTPException(status_code=400, detail="Rollback target must have the same formula_key")

    version_number = await _next_version_number(
        db, ScoringFormulaVersion, ScoringFormulaVersion.formula_key, current.formula_key
    )
    new_formula = ScoringFormulaVersion(
        formula_key=target.formula_key,
        assessment_type=target.assessment_type,
        version=version_number,
        status=VersionStatus.PUBLISHED,
        expression=target.expression,
        input_variables=target.input_variables,
        output_metric=target.output_metric,
        validation_rules=target.validation_rules,
        unit_tests=target.unit_tests,
        created_by=payload.actor,
        approved_by=payload.actor,
        rollback_of=target.id,
        effective_from=_now(),
    )
    db.add(new_formula)
    await db.flush()

    if current.status == VersionStatus.PUBLISHED:
        current.status = VersionStatus.ARCHIVED
        current.effective_to = _now()

    await log_transition(
        db,
        entity_type=VersionEntityType.FORMULA_VERSION,
        entity_id=new_formula.id,
        action="rollback",
        from_status=current.status,
        to_status=VersionStatus.PUBLISHED,
        actor=payload.actor,
        note=f"Rolled back to content of version {target.version}",
    )
    await db.flush()
    await db.refresh(new_formula)
    return new_formula


@router.post("/formula-versions/{formula_id}/simulate", response_model=SimulateFormulaOut)
async def simulate_formula_version(
    formula_id: str,
    payload: SimulateFormulaIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> SimulateFormulaOut:
    formula = await _get_formula_version(db, formula_id)
    expr = formula.expression.get("expr", "") if isinstance(formula.expression, dict) else ""
    try:
        value = evaluate_formula(expr, payload.variables)
    except FormulaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SimulateFormulaOut(result=value)


# ── Audit log ─────────────────────────────────────────────────────────────────
@router.get("/version-audit-logs", response_model=list[AuditLogEntryOut])
async def list_audit_logs(
    entity_id: Annotated[str | None, Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[VersionAuditLog]:
    stmt = select(VersionAuditLog).order_by(VersionAuditLog.created_at.desc())
    if entity_id is not None:
        stmt = stmt.where(VersionAuditLog.entity_id == entity_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())
