"""Assessment session API (Phase 3): start a session, submit answers, complete
it, and fetch results — see docs/mvp-execution-plan-fa.md week 3."""

# NOTE: deliberately no `from __future__ import annotations` here. slowapi's
# `@limiter.limit` decorator wraps the endpoint with `functools.wraps`, whose
# copied `__annotations__` are resolved by FastAPI via `typing.get_type_hints`
# against the *wrapper's* `__globals__` (slowapi's module), not this module's.
# With postponed evaluation, that forward-reference resolution fails silently
# and FastAPI mis-classifies body params (e.g. Pydantic models) as required
# query params. Keeping annotations eagerly evaluated avoids this for the new
# rate-limited `/events` endpoint; see `submit_session_events` below.

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..deps import get_current_user
from ..config import get_settings
from ..models.assessment import (
    AssessmentType,
    AssessmentVersion,
    Question,
    QuestionKind,
    QuestionOption,
    ScoringFormulaVersion,
    VersionStatus,
)
from ..models.session import (
    AssessmentSession,
    SessionAnswer,
    SessionEvent,
    SessionEventType,
    SessionResult,
    SessionStatus,
)
from ..models.user import User
from ..schemas_session import (
    ResumeAnswerOut,
    ResumeSessionOut,
    SessionListItem,
    SessionListResponse,
    SessionOut,
    SessionResultOut,
    StartSessionIn,
    StartSessionOut,
    SubmitAnswersIn,
    SubmitAnswersOut,
    SubmitEventsIn,
    SubmitEventsOut,
)
from ..security import limiter
from ..services.assessment_scoring import (
    compute_holland_result,
    compute_mbti_result,
    compute_session_result,
)
from ..services.run_codes import generate_participant_code, generate_run_code

router = APIRouter(prefix="/sessions", tags=["Assessment Sessions"])
settings = get_settings()
_RUN_CODE_MAX_RETRIES = 5


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


async def _auto_generate_report(
    db: AsyncSession,
    session: AssessmentSession,
    computed: dict,
    raw_totals: dict[str, float],
) -> None:
    """
    Auto-generate a full interpretive report after session completion.
    Uses the session's scoring result directly without re-scoring.
    Skips if a report for this session already exists.
    """
    from ..models.recommendation import Recommendation
    from ..models.report import Report
    from ..schemas import age_to_band, RecommendationResponseV2
    from ..scoring import score_holland, score_mbti, compute_holland_field_scores
    from ..services.interpretation_engine import (
        build_action_plan,
        build_confidence_score,
        build_interpretation,
        build_risk_flags,
        build_summary_card,
    )
    from ..services.recommendation_engine import build_recommendations_v2

    # Skip if report already exists
    existing = await db.execute(
        select(Report).where(Report.session_id == session.id)
    )
    if existing.scalars().first():
        return

    assessment_type = session.assessment_type.value

    # Build scores per assessment type
    if assessment_type == "holland":
        holland_raw = {k: raw_totals.get(k, 0.0) for k in ("R", "I", "A", "S", "E", "C")}
        mbti_raw = {k: 0.0 for k in ("E", "I", "S", "N", "T", "F", "J", "P")}
    elif assessment_type == "mbti":
        holland_raw = {k: 0.0 for k in ("R", "I", "A", "S", "E", "C")}
        mbti_raw = {k: raw_totals.get(k, 0.0) for k in ("E", "I", "S", "N", "T", "F", "J", "P")}
    else:  # combined
        holland_raw = {k: raw_totals.get(k, 0.0) for k in ("R", "I", "A", "S", "E", "C")}
        mbti_raw = {k: raw_totals.get(k, 0.0) for k in ("E", "I", "S", "N", "T", "F", "J", "P")}

    try:
        normalized_scores, holland_code, holland_quality, _ = score_holland(holland_raw)
    except ValueError:
        normalized_scores = {k: 0.0 for k in ("R", "I", "A", "S", "E", "C")}
        holland_code = "RIA"
        holland_quality = 0.0

    try:
        mbti_code, mbti_certainty, mbti_quality, _ = score_mbti(mbti_raw)
    except ValueError:
        mbti_code = "ESTJ"
        mbti_certainty = {}
        mbti_quality = 0.0

    # Compute congruence-based field scores from the Tajallinia Holland methodology
    field_data = compute_holland_field_scores(normalized_scores)
    field_scores = field_data["field_scores"]

    # Use a default age_band; will be refined when user profile is complete
    age_band = "18-24"

    # Default age: midpoint of band
    age_midpoints = {"13-17": 15, "18-24": 21, "25-30": 27, "30+": 35}
    age = age_midpoints.get(age_band, 21)

    recommendations = await build_recommendations_v2(
        db, holland_code=holland_code, mbti_type=mbti_code, age=age
    )

    def _holland_certainty_avg(top3_code: str, ns: dict) -> float:
        vals = [ns.get(c, 0.0) for c in top3_code]
        return round(sum(vals) / len(vals), 1) if vals else 50.0

    holland_certainty_avg = _holland_certainty_avg(holland_code, normalized_scores)

    summary_card = build_summary_card(holland_code, mbti_code, age_band, recommendations)
    detailed = build_interpretation(
        holland_code, normalized_scores, mbti_code, mbti_certainty, age_band, recommendations,
        field_scores=field_scores,
        raw_scores=holland_raw,
        max_raw_per_dimension=50.0,
    )
    action_plan = build_action_plan(recommendations, age_band)
    risk_flags = build_risk_flags(
        holland_certainty_avg, mbti_certainty, age_band, recommendations,
        normalized_scores=normalized_scores,
        holland_quality_score=holland_quality,
        mbti_quality_score=mbti_quality,
    )
    confidence = build_confidence_score(
        holland_certainty_avg, mbti_certainty, recommendations.confidence_score,
        holland_quality_score=holland_quality,
        mbti_quality_score=mbti_quality,
    )

    reco_row = Recommendation(
        session_id=session.id,
        holland_code=holland_code,
        mbti_type=mbti_code,
        age_band=age_band,
        careers=[c.model_dump() for c in recommendations.careers],
        majors=[m.model_dump() for m in recommendations.majors],
        confidence_score=recommendations.confidence_score,
    )
    db.add(reco_row)
    await db.flush()

    report_row = Report(
        recommendation_id=reco_row.id,
        user_id=session.user_id,
        session_id=session.id,
        holland_code=holland_code,
        mbti_type=mbti_code,
        age_band=age_band,
        summary_card=summary_card.model_dump(),
        detailed_interpretation=detailed.model_dump(),
        action_plan=action_plan.model_dump(),
        risk_flags=risk_flags,
        confidence_score=confidence,
    )
    db.add(report_row)
    await db.flush()


@router.get("/my", response_model=SessionListResponse)
async def list_my_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    limit: int = 20,
    status_filter: str | None = None,
) -> SessionListResponse:
    """Return the paginated list of assessment sessions for the authenticated user."""
    page = max(1, page)
    limit = max(1, min(limit, 100))
    offset = (page - 1) * limit

    base_where = [AssessmentSession.user_id == str(current_user.id)]
    if status_filter and status_filter != "all":
        try:
            base_where.append(AssessmentSession.status == SessionStatus(status_filter))
        except ValueError:
            pass  # Ignore unknown status values

    count_stmt = select(AssessmentSession).where(*base_where)
    count_result = await db.execute(count_stmt)
    all_sessions = count_result.scalars().all()
    total = len(all_sessions)

    list_stmt = (
        select(AssessmentSession)
        .options(
            selectinload(AssessmentSession.answers),
            selectinload(AssessmentSession.result),
        )
        .where(*base_where)
        .order_by(AssessmentSession.started_at.desc())
        .offset(offset)
        .limit(limit)
    )
    list_result = await db.execute(list_stmt)
    sessions = list_result.scalars().all()

    items = [
        SessionListItem(
            session_id=s.id,
            run_code=s.run_code,
            assessment_type=s.assessment_type,
            status=s.status,
            top_code=s.result.code if s.result else None,
            started_at=s.started_at,
            completed_at=s.completed_at,
            answered_count=len(s.answers),
        )
        for s in sessions
    ]

    return SessionListResponse(sessions=items, total=total, page=page, limit=limit)


_optional_bearer = HTTPBearer(auto_error=False)


async def _try_get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Return the authenticated User if a valid Bearer token is provided, else None."""
    if credentials is None or not credentials.credentials:
        return None
    try:
        from ..services.auth_service import JWTError, decode_access_token
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        return user if user and user.is_active else None
    except Exception:
        return None


async def _generate_unique_run_code(db: AsyncSession) -> str:
    for _ in range(_RUN_CODE_MAX_RETRIES):
        candidate = generate_run_code()
        existing = await db.execute(
            select(AssessmentSession.id).where(AssessmentSession.run_code == candidate)
        )
        if existing.scalar_one_or_none() is None:
            return candidate
    raise HTTPException(status_code=500, detail="Could not allocate a unique run code, please retry")


@router.post("/start", response_model=StartSessionOut, status_code=201)
async def start_session(
    payload: StartSessionIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User | None = Depends(_try_get_current_user),
) -> StartSessionOut:
    primary_version, secondary_version = await _get_published_versions_for_start(
        db, payload.assessment_type
    )

    # Prefer authenticated user over client-supplied user_id (security)
    resolved_user_id = str(current_user.id) if current_user else payload.user_id

    run_code = await _generate_unique_run_code(db)
    participant_code = generate_participant_code(resolved_user_id)

    session = AssessmentSession(
        user_id=resolved_user_id,
        run_code=run_code,
        participant_code=participant_code,
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
        run_code=session.run_code,
        participant_code=session.participant_code,
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
        run_code=session.run_code,
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


@router.get("/{session_id}/resume", response_model=ResumeSessionOut)
async def resume_session(
    session_id: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> ResumeSessionOut:
    """Authoritative runtime snapshot for resuming a session.

    This is the canonical source of truth on load/refresh — the frontend
    must reconcile (and override) any locally persisted state against this
    response rather than trusting its own localStorage copy (BLK-04 / Phase
    B: assessment-flow.store.ts local persistence is a resume *hint* only).
    """
    session = await _get_session(db, session_id)
    version, secondary_version = await _get_session_versions(db, session)
    total_questions = _count_total_questions(version, secondary_version)

    revise_counts: dict[str, int] = {}
    revise_result = await db.execute(
        select(SessionEvent.question_id, func.count(SessionEvent.id))
        .where(
            SessionEvent.session_id == session.id,
            SessionEvent.event_type == SessionEventType.QUESTION_REVISE,
        )
        .group_by(SessionEvent.question_id)
    )
    for question_id, count in revise_result.all():
        if question_id:
            revise_counts[question_id] = count

    answers = [
        ResumeAnswerOut(
            question_id=a.question_id,
            option_id=a.option_id,
            answered_at=a.answered_at,
            revision_count=revise_counts.get(a.question_id, 0),
        )
        for a in session.answers
    ]

    return ResumeSessionOut(
        session_id=session.id,
        run_code=session.run_code,
        assessment_type=session.assessment_type,
        status=session.status,
        started_at=session.started_at,
        completed_at=session.completed_at,
        total_questions=total_questions,
        answered_count=len(session.answers),
        answers=answers,
    )


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


_VALID_EVENT_TYPES = {member.value for member in SessionEventType if member != SessionEventType.REVISIT}


@router.post("/{session_id}/events", response_model=SubmitEventsOut)
@limiter.limit(f"{settings.rate_limit_session_events_per_minute}/minute")
async def submit_session_events(
    request: Request,
    session_id: str,
    payload: SubmitEventsIn,
    db: AsyncSession = Depends(get_db),
) -> SubmitEventsOut:
    """Batch-ingest runtime timeline events for a session.

    Gated behind ``settings.feature_session_events_enabled`` for the first
    release cycle — see rollout/rollback notes in the Phase B PR. Append-only:
    events are never mutated or deleted, and ``server_seq``/``received_at``
    (not the client-supplied ``client_seq``/``occurred_at``) are the
    authoritative ordering/audit fields.

    ``revisit`` is server-derived, not client-submitted (see
    ``ResumeSessionOut``/history reconstruction), so it is rejected here to
    keep the trust boundary clear.
    """
    if not settings.feature_session_events_enabled:
        raise HTTPException(status_code=503, detail="Session event ingestion is temporarily disabled")

    session = await _get_session(db, session_id)

    last_seq_result = await db.execute(
        select(func.max(SessionEvent.server_seq)).where(SessionEvent.session_id == session.id)
    )
    next_seq = (last_seq_result.scalar() or 0) + 1
    server_seq_start = next_seq
    received_at = _now()

    stored = 0
    for event_in in payload.events:
        if event_in.event_type not in _VALID_EVENT_TYPES:
            raise HTTPException(
                status_code=400, detail=f"Unsupported or server-only event_type '{event_in.event_type}'"
            )
        db.add(
            SessionEvent(
                session_id=session.id,
                event_type=SessionEventType(event_in.event_type),
                question_id=event_in.question_id,
                option_id=event_in.option_id,
                previous_option_id=event_in.previous_option_id,
                client_seq=event_in.client_seq,
                server_seq=next_seq,
                occurred_at=event_in.occurred_at,
                received_at=received_at,
                dwell_ms=event_in.dwell_ms,
            )
        )
        next_seq += 1
        stored += 1

    await db.flush()

    return SubmitEventsOut(
        accepted=True,
        session_id=session.id,
        server_seq_start=server_seq_start,
        server_seq_end=next_seq - 1,
        stored=stored,
    )


@router.post("/{session_id}/complete", response_model=SessionResultOut)
async def complete_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
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

    # Capture session data BEFORE the DB session closes, to pass to the background report task
    session_id_copy = session.id
    user_id_copy = session.user_id
    assessment_type_copy = session.assessment_type.value
    computed_copy = dict(computed)
    raw_totals_copy = dict(raw_totals)

    result_out = SessionResultOut(
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

    # Auto-generate report using FastAPI BackgroundTasks (runs after response is sent)
    background_tasks.add_task(
        _auto_generate_report_independent,
        session_id_copy, user_id_copy, assessment_type_copy, computed_copy, raw_totals_copy
    )

    return result_out


async def _auto_generate_report_independent(
    session_id: str,
    user_id: str | None,
    assessment_type: str,
    computed: dict,
    raw_totals: dict[str, float],
) -> None:
    """
    Generate a report for a completed session in a fresh, independent DB session.
    Called via asyncio.ensure_future so it does not affect the caller's transaction.
    """
    import asyncio
    import logging
    _log = logging.getLogger(__name__)

    await asyncio.sleep(1.0)  # allow the parent transaction to fully commit first
    from ..database import AsyncSessionLocal
    from ..models.session import AssessmentSession as _Session
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(_Session).where(_Session.id == session_id)
            )
            real_session = result.scalar_one_or_none()
            if real_session is None:
                _log.warning("[AutoReport] Session %s not found for report generation", session_id)
                return
            await _auto_generate_report(db, real_session, computed, raw_totals)
            await db.commit()
            _log.info("[AutoReport] Report generated successfully for session %s", session_id)
    except Exception as exc:
        _log.error("[AutoReport] Failed for session %s: %s", session_id, exc, exc_info=True)


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


@router.get("/{session_id}/ai-report")
async def get_session_ai_report(
    session_id: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> dict:
    """
    Return the latest completed AI report for a session.
    Returns the parsed_sections JSON so the frontend can display AI-generated insights.
    Returns 404 if no AI report exists for this session yet.
    """
    from ..models.ai_provider import SessionAIReport
    stmt = (
        select(SessionAIReport)
        .where(
            SessionAIReport.session_id == session_id,
            SessionAIReport.status == "completed",
        )
        .order_by(SessionAIReport.created_at.desc())
    )
    result = await db.execute(stmt)
    ai_report = result.scalars().first()
    if ai_report is None:
        raise HTTPException(status_code=404, detail="No completed AI report found for this session")
    return {
        "id": ai_report.id,
        "session_id": session_id,
        "model_name": ai_report.model_name,
        "parsed_sections": ai_report.parsed_sections or {},
        "raw_response": ai_report.raw_response,
        "generation_time_ms": ai_report.generation_time_ms,
        "tokens_used": ai_report.tokens_used,
        "status": ai_report.status,
        "created_at": ai_report.created_at.isoformat() if ai_report.created_at else None,
    }
