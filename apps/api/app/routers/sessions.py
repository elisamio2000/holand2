"""Assessment session API (Phase 3): start a session, submit answers, complete
it, and fetch results — see docs/mvp-execution-plan-fa.md week 3."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.assessment import (
    AssessmentType,
    AssessmentVersion,
    Question,
    QuestionKind,
    QuestionOption,
    ScoringFormulaVersion,
    VersionStatus,
)
from ..models.session import AssessmentSession, SessionAnswer, SessionResult, SessionStatus
from ..schemas_session import (
    SessionOut,
    SessionResultOut,
    StartSessionIn,
    StartSessionOut,
    SubmitAnswersIn,
    SubmitAnswersOut,
)
from ..services.assessment_scoring import (
    compute_holland_result,
    compute_mbti_result,
    compute_session_result,
)

router = APIRouter(prefix="/sessions", tags=["Assessment Sessions"])


def _now() -> datetime:
    return datetime.now(timezone.utc)  # noqa: UP017


def _score_option(question: Question, selected_option: QuestionOption) -> float:
    if not question.is_reverse_scored or question.kind != QuestionKind.LIKERT:
        return selected_option.weight

    ordered_options = sorted(question.options, key=lambda opt: opt.order_index)
    selected_index = next(
        (idx for idx, option in enumerate(ordered_options) if option.id == selected_option.id),
        None,
    )
    if selected_index is None:
        raise HTTPException(
            status_code=500,
            detail=f"Assessment data integrity error: option {selected_option.id} "
            f"is not linked to question {question.id}",
        )
    mirrored_option = ordered_options[len(ordered_options) - 1 - selected_index]
    return mirrored_option.weight


async def _get_published_version(db: AsyncSession, assessment_type) -> AssessmentVersion:
    result = await db.execute(
        select(AssessmentVersion)
        .options(selectinload(AssessmentVersion.questions).selectinload(Question.options))
        .where(
            AssessmentVersion.assessment_type == assessment_type,
            AssessmentVersion.status == VersionStatus.PUBLISHED,
        )
    )
    version = result.scalars().first()
    if version is None:
        raise HTTPException(
            status_code=409,
            detail=f"No published assessment version for '{assessment_type.value}' yet",
        )
    return version


async def _get_published_versions_for_start(
    db: AsyncSession, assessment_type: AssessmentType
) -> tuple[AssessmentVersion, AssessmentVersion | None]:
    if assessment_type == AssessmentType.COMBINED:
        holland_version = await _get_published_version(db, AssessmentType.HOLLAND)
        mbti_version = await _get_published_version(db, AssessmentType.MBTI)
        return holland_version, mbti_version
    version = await _get_published_version(db, assessment_type)
    return version, None


async def _get_session(db: AsyncSession, session_id: str) -> AssessmentSession:
    result = await db.execute(
        select(AssessmentSession)
        .options(selectinload(AssessmentSession.answers))
        .where(AssessmentSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def _get_version_with_questions(db: AsyncSession, version_id: str) -> AssessmentVersion:
    result = await db.execute(
        select(AssessmentVersion)
        .options(selectinload(AssessmentVersion.questions).selectinload(Question.options))
        .where(AssessmentVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Assessment version not found")
    return version


async def _get_session_versions(
    db: AsyncSession, session: AssessmentSession
) -> tuple[AssessmentVersion, AssessmentVersion | None]:
    primary_version = await _get_version_with_questions(db, session.assessment_version_id)
    secondary_version = None
    if session.secondary_assessment_version_id:
        secondary_version = await _get_version_with_questions(db, session.secondary_assessment_version_id)
    if session.assessment_type == AssessmentType.COMBINED and secondary_version is None:
        raise HTTPException(status_code=500, detail="Combined session is missing MBTI version linkage")
    return primary_version, secondary_version


def _build_question_map(*versions: AssessmentVersion) -> dict[str, Question]:
    return {q.id: q for version in versions for q in version.questions}


def _count_total_questions(*versions: AssessmentVersion | None) -> int:
    return sum(len(version.questions) for version in versions if version is not None)


@router.post("/start", response_model=StartSessionOut, status_code=201)
async def start_session(
    payload: StartSessionIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StartSessionOut:
    primary_version, secondary_version = await _get_published_versions_for_start(
        db, payload.assessment_type
    )

    session = AssessmentSession(
        user_id=payload.user_id,
        assessment_type=payload.assessment_type,
        assessment_version_id=primary_version.id,
        secondary_assessment_version_id=secondary_version.id if secondary_version else None,
        status=SessionStatus.IN_PROGRESS,
        started_at=_now(),
    )
    db.add(session)
    await db.flush()

    return StartSessionOut(
        session_id=session.id,
        assessment_type=session.assessment_type,
        assessment_version=primary_version.version,
        status=session.status,
        started_at=session.started_at,
        questions=[
            *primary_version.questions,
            *(secondary_version.questions if secondary_version else []),
        ],
    )


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> SessionOut:
    session = await _get_session(db, session_id)
    version, secondary_version = await _get_session_versions(db, session)
    return SessionOut(
        session_id=session.id,
        assessment_type=session.assessment_type,
        assessment_version=version.version,
        status=session.status,
        started_at=session.started_at,
        completed_at=session.completed_at,
        answered_count=len(session.answers),
        total_questions=_count_total_questions(version, secondary_version),
    )


@router.get("/{session_id}/questions")
async def get_session_questions(
    session_id: str, db: Annotated[AsyncSession, Depends(get_db)]
):
    session = await _get_session(db, session_id)
    version, secondary_version = await _get_session_versions(db, session)
    from ..schemas_assessment import QuestionOut

    all_questions = [*version.questions, *(secondary_version.questions if secondary_version else [])]
    return [QuestionOut.model_validate(q) for q in all_questions]


@router.post("/{session_id}/answers", response_model=SubmitAnswersOut)
async def submit_answers(
    session_id: str,
    payload: SubmitAnswersIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SubmitAnswersOut:
    session = await _get_session(db, session_id)
    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail=f"Session is '{session.status.value}', not in progress")

    version, secondary_version = await _get_session_versions(db, session)
    questions_by_id = _build_question_map(
        version, *([secondary_version] if secondary_version is not None else [])
    )

    existing_result = await db.execute(
        select(SessionAnswer).where(SessionAnswer.session_id == session.id)
    )
    answers_by_question = {a.question_id: a for a in existing_result.scalars().all()}

    for ans in payload.answers:
        question = questions_by_id.get(ans.question_id)
        if question is None:
            raise HTTPException(
                status_code=400, detail=f"Question {ans.question_id} is not part of this session"
            )
        option = next((o for o in question.options if o.id == ans.option_id), None)
        if option is None:
            raise HTTPException(
                status_code=400, detail=f"Option {ans.option_id} is invalid for question {ans.question_id}"
            )

        existing = answers_by_question.get(question.id)
        if existing is not None:
            existing.option_id = option.id
            existing.answered_at = _now()
        else:
            new_answer = SessionAnswer(
                session_id=session.id,
                question_id=question.id,
                option_id=option.id,
                answered_at=_now(),
            )
            db.add(new_answer)
            answers_by_question[question.id] = new_answer

    await db.flush()

    return SubmitAnswersOut(
        session_id=session.id,
        answered_count=len(answers_by_question),
        total_questions=_count_total_questions(version, secondary_version),
        status=session.status,
    )


@router.post("/{session_id}/complete", response_model=SessionResultOut)
async def complete_session(
    session_id: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> SessionResultOut:
    session = await _get_session(db, session_id)
    if session.status == SessionStatus.COMPLETED:
        return await _build_result_out(db, session)
    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail=f"Session is '{session.status.value}'")

    version, secondary_version = await _get_session_versions(db, session)
    total_questions = _count_total_questions(version, secondary_version)
    if len(session.answers) < total_questions:
        raise HTTPException(
            status_code=400,
            detail=f"Session incomplete: {len(session.answers)}/{total_questions} answered",
        )

    all_versions = [version, *([secondary_version] if secondary_version is not None else [])]
    questions_by_id = _build_question_map(*all_versions)
    options_by_id: dict[str, QuestionOption] = {o.id: o for v in all_versions for q in v.questions for o in q.options}
    raw_totals: dict[str, float] = {}
    for ans in session.answers:
        option = options_by_id.get(ans.option_id)
        if option is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Assessment data integrity error: "
                    f"option {ans.option_id} referenced by answer {ans.id} not found in version "
                    f"{session.assessment_version_id}"
                ),
            )
        question = questions_by_id.get(ans.question_id)
        if question is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Assessment data integrity error: "
                    f"question {ans.question_id} referenced by answer {ans.id} not found in version "
                    f"{session.assessment_version_id}"
                ),
            )
        if option.question_id != question.id:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Assessment data integrity error: "
                    f"option {option.id} does not belong to question {question.id}"
                ),
            )
        contribution = _score_option(question, option)
        raw_totals[option.pole] = raw_totals.get(option.pole, 0.0) + contribution

    primary_formula_result = await db.execute(
        select(ScoringFormulaVersion).where(
            ScoringFormulaVersion.assessment_type
            == (AssessmentType.HOLLAND if session.assessment_type == AssessmentType.COMBINED else session.assessment_type),
            ScoringFormulaVersion.status == VersionStatus.PUBLISHED,
        )
    )
    primary_formula = primary_formula_result.scalars().first()

    secondary_formula = None
    if session.assessment_type == AssessmentType.COMBINED:
        secondary_formula_result = await db.execute(
            select(ScoringFormulaVersion).where(
                ScoringFormulaVersion.assessment_type == AssessmentType.MBTI,
                ScoringFormulaVersion.status == VersionStatus.PUBLISHED,
            )
        )
        secondary_formula = secondary_formula_result.scalars().first()

    if session.assessment_type == AssessmentType.COMBINED:
        holland_raw = {dim: raw_totals.get(dim, 0.0) for dim in ("R", "I", "A", "S", "E", "C")}
        mbti_raw = {dim: raw_totals.get(dim, 0.0) for dim in ("E", "I", "S", "N", "T", "F", "J", "P")}
        holland_normalized, holland_code = compute_holland_result(holland_raw, primary_formula)
        mbti_code, mbti_certainty = compute_mbti_result(mbti_raw, secondary_formula)
        computed = {
            "normalized_scores": {"holland": holland_normalized, "mbti": mbti_raw},
            "code": f"{holland_code}-{mbti_code}",
            "certainty": {"mbti": mbti_certainty},
            "holland": {"code": holland_code, "normalized_scores": holland_normalized},
            "mbti": {"code": mbti_code, "normalized_scores": mbti_raw, "certainty": mbti_certainty},
        }
    else:
        computed = compute_session_result(session.assessment_type, raw_totals, primary_formula)

    session_result = SessionResult(
        session_id=session.id,
        formula_version_id=primary_formula.id if primary_formula else None,
        secondary_formula_version_id=secondary_formula.id if secondary_formula else None,
        raw_scores=raw_totals,
        normalized_scores=computed["normalized_scores"],
        code=computed["code"],
        certainty=computed["certainty"],
        computed_at=_now(),
    )
    db.add(session_result)

    session.status = SessionStatus.COMPLETED
    session.completed_at = _now()
    await db.flush()

    return SessionResultOut(
        session_id=session.id,
        assessment_type=session.assessment_type,
        assessment_version=version.version,
        secondary_assessment_version=secondary_version.version if secondary_version else None,
        formula_version=primary_formula.version if primary_formula else None,
        secondary_formula_version=secondary_formula.version if secondary_formula else None,
        raw_scores=raw_totals,
        normalized_scores=computed["normalized_scores"],
        code=computed["code"],
        certainty=computed["certainty"],
        holland=computed.get("holland"),
        mbti=computed.get("mbti"),
        computed_at=session_result.computed_at,
    )


async def _build_result_out(db: AsyncSession, session: AssessmentSession) -> SessionResultOut:
    result = await db.execute(
        select(SessionResult).where(SessionResult.session_id == session.id)
    )
    session_result = result.scalar_one_or_none()
    if session_result is None:
        raise HTTPException(status_code=404, detail="Result not found for this session")

    version, secondary_version = await _get_session_versions(db, session)
    formula_version_number = None
    if session_result.formula_version_id:
        f = await db.execute(
            select(ScoringFormulaVersion).where(
                ScoringFormulaVersion.id == session_result.formula_version_id
            )
        )
        formula = f.scalar_one_or_none()
        formula_version_number = formula.version if formula else None
    secondary_formula_version_number = None
    if session_result.secondary_formula_version_id:
        sf = await db.execute(
            select(ScoringFormulaVersion).where(
                ScoringFormulaVersion.id == session_result.secondary_formula_version_id
            )
        )
        secondary_formula = sf.scalar_one_or_none()
        secondary_formula_version_number = secondary_formula.version if secondary_formula else None

    holland = None
    mbti = None
    if session.assessment_type == AssessmentType.COMBINED and isinstance(session_result.normalized_scores, dict):
        holland_scores = session_result.normalized_scores.get("holland")
        mbti_scores = session_result.normalized_scores.get("mbti")
        if isinstance(holland_scores, dict):
            holland = {
                "code": session_result.code.split("-", 1)[0],
                "normalized_scores": holland_scores,
            }
        if isinstance(mbti_scores, dict):
            mbti_code = session_result.code.split("-", 1)[1] if "-" in session_result.code else session_result.code
            mbti = {
                "code": mbti_code,
                "normalized_scores": mbti_scores,
                "certainty": session_result.certainty.get("mbti")
                if isinstance(session_result.certainty, dict)
                else None,
            }

    return SessionResultOut(
        session_id=session.id,
        assessment_type=session.assessment_type,
        assessment_version=version.version,
        secondary_assessment_version=secondary_version.version if secondary_version else None,
        formula_version=formula_version_number,
        secondary_formula_version=secondary_formula_version_number,
        raw_scores=session_result.raw_scores,
        normalized_scores=session_result.normalized_scores,
        code=session_result.code,
        certainty=session_result.certainty,
        holland=holland,
        mbti=mbti,
        computed_at=session_result.computed_at,
    )


@router.get("/{session_id}/result", response_model=SessionResultOut)
async def get_session_result(
    session_id: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> SessionResultOut:
    session = await _get_session(db, session_id)
    if session.status != SessionStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Session is not completed yet")
    return await _build_result_out(db, session)
