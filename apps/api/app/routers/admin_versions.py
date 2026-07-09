"""Canonical versioning/governance API for assessment authoring.

`/admin/assessment-versions` and `/admin/formula-versions` are the canonical
authoring workflow surfaces for create/edit/version/publish of Holland/MBTI
content. The `/expert-lab` routes are not canonical for runtime governance.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..deps import require_admin
from ..models.assessment import (
    AssessmentType,
    AssessmentVersion,
    Question,
    QuestionOption,
    ScoringFormulaVersion,
    VersionAuditLog,
    VersionEntityType,
    VersionStatus,
    VersionValidationReport,
)
from ..schemas_assessment import (
    AssessmentVersionDetailOut,
    AssessmentVersionDraftIn,
    AssessmentVersionOut,
    AuditLogEntryOut,
    QuestionBankQualityReportOut,
    OptionReorderIn,
    PreflightIssueOut,
    QuestionDraftIn,
    QuestionDraftPatchIn,
    QuestionOptionDraftIn,
    QuestionOptionDraftPatchIn,
    QuestionReorderIn,
    RollbackIn,
    ScoringFormulaDraftIn,
    ScoringFormulaDraftPatchIn,
    ScoringFormulaVersionOut,
    SimulateAssessmentVersionIn,
    SimulateFormulaIn,
    SimulateFormulaOut,
    SimulateResultOut,
    ValidationReportOut,
    VersionActionIn,
    VersionDiffOut,
    VersionPreflightOut,
)
from ..services.assessment_scoring import compute_session_result
from ..services.formula_engine import (
    FormulaError,
    evaluate_formula,
    validate_formula,
    validate_formula_drift,
    validate_formula_version_payload,
)
from ..services.question_bank_quality import build_quality_report
from ..services.versioning import VersioningError, assert_transition_allowed, log_transition

router = APIRouter(
    prefix="/admin",
    tags=["Question Bank Governance"],
    dependencies=[Depends(require_admin)],
)


def _now() -> datetime:
    return datetime.now(timezone.utc)  # noqa: UP017


# ── helpers ───────────────────────────────────────────────────────────────────
async def _get_assessment_version(db: AsyncSession, version_id: str) -> AssessmentVersion:
    result = await db.execute(
        select(AssessmentVersion)
        .options(selectinload(AssessmentVersion.questions).selectinload(Question.options))
        .where(AssessmentVersion.id == version_id)
        .execution_options(populate_existing=True)
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    return version


def _ensure_assessment_version_editable(version: AssessmentVersion) -> None:
    if version.status != VersionStatus.DRAFT:
        raise HTTPException(
            status_code=409,
            detail=f"Version {version.version} is '{version.status.value}' and not editable",
        )


async def _get_formula_version(db: AsyncSession, formula_id: str) -> ScoringFormulaVersion:
    result = await db.execute(
        select(ScoringFormulaVersion).where(ScoringFormulaVersion.id == formula_id)
    )
    formula = result.scalar_one_or_none()
    if formula is None:
        raise HTTPException(status_code=404, detail="Formula version not found")
    return formula


def _ensure_formula_version_editable(formula: ScoringFormulaVersion) -> None:
    if formula.status != VersionStatus.DRAFT:
        raise HTTPException(
            status_code=409,
            detail=f"Formula version {formula.version} is '{formula.status.value}' and not editable",
        )


async def _next_version_number(
    db: AsyncSession, model, filter_col, filter_value
) -> int:
    result = await db.execute(
        select(model.version).where(filter_col == filter_value).order_by(model.version.desc())
    )
    latest = result.scalars().first()
    return (latest or 0) + 1


async def _record_validation_report(
    db: AsyncSession,
    *,
    entity_type: VersionEntityType,
    entity_id: str,
    gate: str,
    target_status: VersionStatus,
    ok: bool,
    report: dict,
    actor: str | None,
) -> VersionValidationReport:
    entry = VersionValidationReport(
        entity_type=entity_type,
        entity_id=entity_id,
        gate=gate,
        target_status=target_status.value,
        ok=ok,
        report=report,
        actor=actor,
    )
    db.add(entry)
    await db.flush()
    return entry


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


def _apply_question_fields(question: Question, payload: QuestionDraftPatchIn) -> None:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(question, field, value)


def _apply_option_fields(option: QuestionOption, payload: QuestionOptionDraftPatchIn) -> None:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(option, field, value)


@router.post(
    "/assessment-versions/{version_id}/questions",
    response_model=AssessmentVersionDetailOut,
    status_code=201,
)
async def add_question_to_assessment_version(
    version_id: str,
    payload: QuestionDraftIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentVersion:
    version = await _get_assessment_version(db, version_id)
    _ensure_assessment_version_editable(version)

    question = Question(
        assessment_version_id=version.id,
        kind=payload.kind,
        dimension=payload.dimension,
        text=payload.text,
        order_index=payload.order_index,
        is_reverse_scored=payload.is_reverse_scored,
    )
    db.add(question)
    await db.flush()
    for opt in payload.options:
        db.add(
            QuestionOption(
                question_id=question.id,
                label=opt.label,
                value=opt.value,
                pole=opt.pole,
                weight=opt.weight,
                order_index=opt.order_index,
            )
        )
    await db.flush()
    return await _get_assessment_version(db, version.id)


@router.patch(
    "/assessment-versions/{version_id}/questions/{question_id}",
    response_model=AssessmentVersionDetailOut,
)
async def update_question_in_assessment_version(
    version_id: str,
    question_id: str,
    payload: QuestionDraftPatchIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentVersion:
    version = await _get_assessment_version(db, version_id)
    _ensure_assessment_version_editable(version)
    question = next((q for q in version.questions if q.id == question_id), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found in this assessment version")

    _apply_question_fields(question, payload)
    await db.flush()
    return await _get_assessment_version(db, version.id)


@router.delete(
    "/assessment-versions/{version_id}/questions/{question_id}",
    response_model=AssessmentVersionDetailOut,
)
async def delete_question_from_assessment_version(
    version_id: str,
    question_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentVersion:
    version = await _get_assessment_version(db, version_id)
    _ensure_assessment_version_editable(version)
    question = next((q for q in version.questions if q.id == question_id), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found in this assessment version")
    await db.delete(question)
    await db.flush()
    return await _get_assessment_version(db, version.id)


@router.post(
    "/assessment-versions/{version_id}/questions/reorder",
    response_model=AssessmentVersionDetailOut,
)
async def reorder_questions_in_assessment_version(
    version_id: str,
    payload: QuestionReorderIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentVersion:
    version = await _get_assessment_version(db, version_id)
    _ensure_assessment_version_editable(version)
    by_id = {q.id: q for q in version.questions}
    for item in payload.items:
        question = by_id.get(item.question_id)
        if question is None:
            raise HTTPException(status_code=404, detail=f"Question {item.question_id} not found in version")
        question.order_index = item.order_index
    await db.flush()
    return await _get_assessment_version(db, version.id)


@router.post(
    "/assessment-versions/{version_id}/questions/{question_id}/options",
    response_model=AssessmentVersionDetailOut,
    status_code=201,
)
async def add_option_to_question(
    version_id: str,
    question_id: str,
    payload: QuestionOptionDraftIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentVersion:
    version = await _get_assessment_version(db, version_id)
    _ensure_assessment_version_editable(version)
    question = next((q for q in version.questions if q.id == question_id), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found in this assessment version")
    db.add(
        QuestionOption(
            question_id=question.id,
            label=payload.label,
            value=payload.value,
            pole=payload.pole,
            weight=payload.weight,
            order_index=payload.order_index,
        )
    )
    await db.flush()
    return await _get_assessment_version(db, version.id)


@router.patch(
    "/assessment-versions/{version_id}/questions/{question_id}/options/{option_id}",
    response_model=AssessmentVersionDetailOut,
)
async def update_option_in_question(
    version_id: str,
    question_id: str,
    option_id: str,
    payload: QuestionOptionDraftPatchIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentVersion:
    version = await _get_assessment_version(db, version_id)
    _ensure_assessment_version_editable(version)
    question = next((q for q in version.questions if q.id == question_id), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found in this assessment version")
    option = next((o for o in question.options if o.id == option_id), None)
    if option is None:
        raise HTTPException(status_code=404, detail="Option not found in this question")
    _apply_option_fields(option, payload)
    await db.flush()
    return await _get_assessment_version(db, version.id)


@router.delete(
    "/assessment-versions/{version_id}/questions/{question_id}/options/{option_id}",
    response_model=AssessmentVersionDetailOut,
)
async def delete_option_from_question(
    version_id: str,
    question_id: str,
    option_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentVersion:
    version = await _get_assessment_version(db, version_id)
    _ensure_assessment_version_editable(version)
    question = next((q for q in version.questions if q.id == question_id), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found in this assessment version")
    option = next((o for o in question.options if o.id == option_id), None)
    if option is None:
        raise HTTPException(status_code=404, detail="Option not found in this question")
    await db.delete(option)
    await db.flush()
    return await _get_assessment_version(db, version.id)


@router.post(
    "/assessment-versions/{version_id}/questions/{question_id}/options/reorder",
    response_model=AssessmentVersionDetailOut,
)
async def reorder_question_options(
    version_id: str,
    question_id: str,
    payload: OptionReorderIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentVersion:
    version = await _get_assessment_version(db, version_id)
    _ensure_assessment_version_editable(version)
    question = next((q for q in version.questions if q.id == question_id), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found in this assessment version")
    by_id = {o.id: o for o in question.options}
    for item in payload.items:
        option = by_id.get(item.option_id)
        if option is None:
            raise HTTPException(status_code=404, detail=f"Option {item.option_id} not found in question")
        option.order_index = item.order_index
    await db.flush()
    return await _get_assessment_version(db, version.id)


def _assessment_preflight_issues(version: AssessmentVersion) -> list[PreflightIssueOut]:
    issues: list[PreflightIssueOut] = []
    if not version.questions:
        issues.append(
            PreflightIssueOut(
                code="no_questions",
                message="Assessment draft must include at least one question",
                blocking=True,
                path="questions",
            )
        )
        return issues

    for q_idx, question in enumerate(version.questions):
        path = f"questions[{q_idx}]"
        if not question.text.strip():
            issues.append(
                PreflightIssueOut(
                    code="question_text_empty",
                    message="Question text cannot be empty",
                    blocking=True,
                    path=f"{path}.text",
                )
            )
        if len(question.options) < 2:
            issues.append(
                PreflightIssueOut(
                    code="question_options_too_few",
                    message="Each question must have at least 2 options",
                    blocking=True,
                    path=f"{path}.options",
                )
            )

        if version.assessment_type == AssessmentType.HOLLAND:
            if question.dimension not in {"R", "I", "A", "S", "E", "C"}:
                issues.append(
                    PreflightIssueOut(
                        code="invalid_holland_dimension",
                        message="Holland question dimension must be one of R, I, A, S, E, C",
                        blocking=True,
                        path=f"{path}.dimension",
                    )
                )
            if question.kind != "likert":
                issues.append(
                    PreflightIssueOut(
                        code="invalid_holland_question_kind",
                        message="Holland questions must use likert kind",
                        blocking=True,
                        path=f"{path}.kind",
                    )
                )
        elif version.assessment_type == AssessmentType.MBTI:
            if question.dimension not in {"EI", "SN", "TF", "JP"}:
                issues.append(
                    PreflightIssueOut(
                        code="invalid_mbti_dimension",
                        message="MBTI question dimension must be one of EI, SN, TF, JP",
                        blocking=True,
                        path=f"{path}.dimension",
                    )
                )
            if question.kind != "forced_choice":
                issues.append(
                    PreflightIssueOut(
                        code="invalid_mbti_question_kind",
                        message="MBTI questions must use forced_choice kind",
                        blocking=True,
                        path=f"{path}.kind",
                    )
                )
            if len(question.options) != 2:
                issues.append(
                    PreflightIssueOut(
                        code="invalid_mbti_option_count",
                        message="MBTI forced-choice questions must have exactly 2 options",
                        blocking=True,
                        path=f"{path}.options",
                    )
                )

        for o_idx, option in enumerate(question.options):
            if not option.label.strip():
                issues.append(
                    PreflightIssueOut(
                        code="option_label_empty",
                        message="Option label cannot be empty",
                        blocking=True,
                        path=f"{path}.options[{o_idx}].label",
                    )
                )
    return issues


@router.get(
    "/assessment-versions/{version_id}/preflight",
    response_model=VersionPreflightOut,
)
async def preflight_assessment_version(
    version_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VersionPreflightOut:
    version = await _get_assessment_version(db, version_id)
    issues = _assessment_preflight_issues(version)
    blocking = sum(1 for issue in issues if issue.blocking)
    warnings = len(issues) - blocking
    return VersionPreflightOut(
        ready_to_publish=blocking == 0,
        blocking_issue_count=blocking,
        warning_count=warnings,
        issues=issues,
    )


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
        quality_report = build_quality_report(version.assessment_type, version.questions)
        await _record_validation_report(
            db,
            entity_type=VersionEntityType.ASSESSMENT_VERSION,
            entity_id=version.id,
            gate="question_bank_quality",
            target_status=target,
            ok=quality_report["error_count"] == 0,
            report=quality_report,
            actor=payload.actor,
        )
        if quality_report["error_count"] > 0:
            error_codes = ", ".join(
                issue["code"] for issue in quality_report["issues"] if issue["severity"] == "error"
            )
            raise HTTPException(
                status_code=409,
                detail=(
                    "Assessment publish gate failed: "
                    f"quality report contains blocking errors ({error_codes})"
                ),
            )

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
    payload: VersionActionIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AssessmentVersion:
    return await _transition_assessment_version(db, version_id, VersionStatus.REVIEWED, payload)


@router.post("/assessment-versions/{version_id}/approve", response_model=AssessmentVersionDetailOut)
async def approve_assessment_version(
    version_id: str,
    payload: VersionActionIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AssessmentVersion:
    return await _transition_assessment_version(db, version_id, VersionStatus.APPROVED, payload)


@router.post("/assessment-versions/{version_id}/publish", response_model=AssessmentVersionDetailOut)
async def publish_assessment_version(
    version_id: str,
    payload: VersionActionIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> AssessmentVersion:
    preflight = await preflight_assessment_version(version_id=version_id, db=db)
    if preflight.blocking_issue_count > 0:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Assessment version is not ready to publish",
                "blocking_issues": [issue.model_dump() for issue in preflight.issues if issue.blocking],
            },
        )
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

    current_status = current.status
    if current_status == VersionStatus.PUBLISHED:
        current.status = VersionStatus.ARCHIVED
        current.effective_to = _now()

    await log_transition(
        db,
        entity_type=VersionEntityType.ASSESSMENT_VERSION,
        entity_id=new_version.id,
        action="rollback",
        from_status=current_status,
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


@router.patch("/formula-versions/{formula_id}", response_model=ScoringFormulaVersionOut)
async def update_formula_version_draft(
    formula_id: str,
    payload: ScoringFormulaDraftPatchIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ScoringFormulaVersion:
    formula = await _get_formula_version(db, formula_id)
    _ensure_formula_version_editable(formula)
    updates = payload.model_dump(exclude_unset=True)
    expression = updates.get("expression", formula.expression)
    input_variables = updates.get("input_variables", formula.input_variables)
    expr = expression.get("expr", "") if isinstance(expression, dict) else ""
    try:
        validate_formula(expr, input_variables)
    except FormulaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    for field, value in updates.items():
        setattr(formula, field, value)
    await db.flush()
    await db.refresh(formula)
    return formula


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
        existing_published_result = await db.execute(
            select(ScoringFormulaVersion).where(
                ScoringFormulaVersion.formula_key == formula.formula_key,
                ScoringFormulaVersion.status == VersionStatus.PUBLISHED,
                ScoringFormulaVersion.id != formula.id,
            )
        )
        existing_published = list(existing_published_result.scalars().all())

        expr = formula.expression.get("expr", "") if isinstance(formula.expression, dict) else ""
        try:
            validate_formula_version_payload(
                expression=expr,
                input_variables=formula.input_variables,
                validation_rules=formula.validation_rules,
                unit_tests=formula.unit_tests,
            )
            max_drift = None
            if isinstance(formula.validation_rules, dict):
                max_drift = formula.validation_rules.get("max_drift")
            if max_drift is not None:
                if not isinstance(max_drift, int | float):
                    raise FormulaError("validation_rules.max_drift must be numeric when provided")
                sample_variables = [
                    case.get("variables")
                    for case in (formula.unit_tests or [])
                    if isinstance(case, dict) and isinstance(case.get("variables"), dict)
                ]
                for prev in existing_published:
                    prev_expr = prev.expression.get("expr", "") if isinstance(prev.expression, dict) else ""
                    validate_formula_drift(
                        previous_expression=prev_expr,
                        candidate_expression=expr,
                        samples=sample_variables,
                        max_drift=float(max_drift),
                    )
            await _record_validation_report(
                db,
                entity_type=VersionEntityType.FORMULA_VERSION,
                entity_id=formula.id,
                gate="formula_publish",
                target_status=target,
                ok=True,
                report={
                    "ok": True,
                    "error_count": 0,
                    "warning_count": 0,
                    "issues": [],
                    "metrics": {
                        "unit_test_count": len(formula.unit_tests or []),
                        "validation_rules": formula.validation_rules or {},
                        "compared_published_versions": len(existing_published),
                    },
                },
                actor=payload.actor,
            )
        except FormulaError as exc:
            await _record_validation_report(
                db,
                entity_type=VersionEntityType.FORMULA_VERSION,
                entity_id=formula.id,
                gate="formula_publish",
                target_status=target,
                ok=False,
                report={
                    "ok": False,
                    "error_count": 1,
                    "warning_count": 0,
                    "issues": [
                        {
                            "code": "formula_publish_gate_failed",
                            "severity": "error",
                            "message": str(exc),
                            "context": {},
                        }
                    ],
                    "metrics": {
                        "unit_test_count": len(formula.unit_tests or []),
                        "validation_rules": formula.validation_rules or {},
                        "compared_published_versions": len(existing_published),
                    },
                },
                actor=payload.actor,
            )
            raise HTTPException(
                status_code=409,
                detail=f"Formula publish gate failed: {exc}",
            ) from exc

        for prev in existing_published:
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
    payload: VersionActionIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ScoringFormulaVersion:
    return await _transition_formula_version(db, formula_id, VersionStatus.REVIEWED, payload)


@router.post("/formula-versions/{formula_id}/approve", response_model=ScoringFormulaVersionOut)
async def approve_formula_version(
    formula_id: str,
    payload: VersionActionIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ScoringFormulaVersion:
    return await _transition_formula_version(db, formula_id, VersionStatus.APPROVED, payload)


@router.post("/formula-versions/{formula_id}/publish", response_model=ScoringFormulaVersionOut)
async def publish_formula_version(
    formula_id: str,
    payload: VersionActionIn,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> ScoringFormulaVersion:
    preflight = await preflight_formula_version(formula_id=formula_id, db=db)
    if preflight.blocking_issue_count > 0:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Formula version is not ready to publish",
                "blocking_issues": [issue.model_dump() for issue in preflight.issues if issue.blocking],
            },
        )
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

    current_status = current.status
    if current_status == VersionStatus.PUBLISHED:
        current.status = VersionStatus.ARCHIVED
        current.effective_to = _now()

    await log_transition(
        db,
        entity_type=VersionEntityType.FORMULA_VERSION,
        entity_id=new_formula.id,
        action="rollback",
        from_status=current_status,
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


def _formula_preflight_issues(formula: ScoringFormulaVersion) -> list[PreflightIssueOut]:
    issues: list[PreflightIssueOut] = []
    expr = formula.expression.get("expr", "") if isinstance(formula.expression, dict) else ""
    if not expr.strip():
        issues.append(
            PreflightIssueOut(
                code="formula_expression_empty",
                message="Formula expression cannot be empty",
                blocking=True,
                path="expression.expr",
            )
        )
        return issues

    try:
        validate_formula(expr, formula.input_variables)
    except FormulaError as exc:
        issues.append(
            PreflightIssueOut(
                code="formula_validation_failed",
                message=str(exc),
                blocking=True,
                path="expression",
            )
        )

    if not formula.input_variables:
        issues.append(
            PreflightIssueOut(
                code="formula_input_variables_empty",
                message="Formula must declare at least one input variable",
                blocking=True,
                path="input_variables",
            )
        )

    if not formula.output_metric.strip():
        issues.append(
            PreflightIssueOut(
                code="formula_output_metric_empty",
                message="Formula output metric cannot be empty",
                blocking=True,
                path="output_metric",
            )
        )

    return issues


@router.get("/formula-versions/{formula_id}/preflight", response_model=VersionPreflightOut)
async def preflight_formula_version(
    formula_id: str,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> VersionPreflightOut:
    formula = await _get_formula_version(db, formula_id)
    issues = _formula_preflight_issues(formula)
    blocking = sum(1 for issue in issues if issue.blocking)
    warnings = len(issues) - blocking
    return VersionPreflightOut(
        ready_to_publish=blocking == 0,
        blocking_issue_count=blocking,
        warning_count=warnings,
        issues=issues,
    )


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


@router.get("/version-validation-reports", response_model=list[ValidationReportOut])
async def list_validation_reports(
    entity_id: Annotated[str | None, Query()] = None,
    entity_type: Annotated[VersionEntityType | None, Query()] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[VersionValidationReport]:
    stmt = select(VersionValidationReport).order_by(VersionValidationReport.created_at.desc())
    if entity_id is not None:
        stmt = stmt.where(VersionValidationReport.entity_id == entity_id)
    if entity_type is not None:
        stmt = stmt.where(VersionValidationReport.entity_type == entity_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())
