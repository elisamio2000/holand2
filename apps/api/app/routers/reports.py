"""Phase 5: report generation API.

Ties together scoring, the recommendation engine, and the Persian
interpretation engine into a single explainable report, and persists a
snapshot so it can be retrieved later (docs section 5: "امکان ذخیره و
دریافت گزارش وجود داشته باشد").
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.recommendation import Recommendation
from ..models.report import Report
from ..schemas import (
    RecommendationResponseV2,
    ReportRequest,
    ReportResponse,
    age_to_band,
)
from ..scoring import score_holland, score_mbti
from ..services.interpretation_engine import (
    build_action_plan,
    build_confidence_score,
    build_interpretation,
    build_risk_flags,
    build_summary_card,
)
from ..services.recommendation_engine import build_recommendations_v2

router = APIRouter(prefix="/reports", tags=["Reports"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


def _holland_certainty(top3_code: str, normalized_scores: dict) -> float:
    """Heuristic certainty: how strongly the top-3 interests stand out.

    A flat distribution (~16.6% per dimension) yields low certainty; a
    concentrated top-3 yields high certainty.
    """
    if not top3_code:
        return 50.0
    values = [normalized_scores.get(letter, 0.0) for letter in top3_code]
    return round(sum(values) / len(values), 1)


def _to_report_response(
    report_row: Report,
    recommendation_row: Recommendation | None,
) -> ReportResponse:
    recommendations = RecommendationResponseV2(
        age_band=report_row.age_band,
        careers=(recommendation_row.careers if recommendation_row else []),
        majors=(recommendation_row.majors if recommendation_row else []),
        confidence_score=(
            recommendation_row.confidence_score if recommendation_row else report_row.confidence_score
        ),
    )

    return ReportResponse(
        id=report_row.id,
        holland_code=report_row.holland_code,
        mbti_type=report_row.mbti_type,
        age_band=report_row.age_band,
        summary_card=report_row.summary_card,
        detailed_interpretation=report_row.detailed_interpretation,
        action_plan=report_row.action_plan,
        risk_flags=report_row.risk_flags,
        confidence_score=report_row.confidence_score,
        recommendations=recommendations,
    )


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    payload: ReportRequest,
    session: DbSession,
) -> ReportResponse:
    try:
        normalized_scores, holland_code, holland_quality_score, _holland_quality_band = score_holland(
            payload.holland_scores
        )
        mbti_type, mbti_certainty, mbti_quality_score, _mbti_quality_band = score_mbti(
            payload.mbti_scores
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    age_band = age_to_band(payload.age)

    recommendations = await build_recommendations_v2(
        session, holland_code=holland_code, mbti_type=mbti_type, age=payload.age
    )

    holland_certainty_avg = _holland_certainty(holland_code, normalized_scores)

    summary_card = build_summary_card(holland_code, mbti_type, age_band, recommendations)
    detailed_interpretation = build_interpretation(
        holland_code, normalized_scores, mbti_type, mbti_certainty, age_band, recommendations
    )
    action_plan = build_action_plan(recommendations, age_band)
    risk_flags = build_risk_flags(
        holland_certainty_avg,
        mbti_certainty,
        age_band,
        recommendations,
        normalized_scores=normalized_scores,
        holland_quality_score=holland_quality_score,
        mbti_quality_score=mbti_quality_score,
    )
    confidence_score = build_confidence_score(
        holland_certainty_avg,
        mbti_certainty,
        recommendations.confidence_score,
        holland_quality_score=holland_quality_score,
        mbti_quality_score=mbti_quality_score,
    )

    recommendation_row = Recommendation(
        session_id=payload.session_id,
        holland_code=holland_code,
        mbti_type=mbti_type,
        age_band=age_band,
        careers=[c.model_dump() for c in recommendations.careers],
        majors=[m.model_dump() for m in recommendations.majors],
        confidence_score=recommendations.confidence_score,
    )
    session.add(recommendation_row)
    await session.flush()

    report_row = Report(
        recommendation_id=recommendation_row.id,
        session_id=payload.session_id,
        holland_code=holland_code,
        mbti_type=mbti_type,
        age_band=age_band,
        summary_card=summary_card.model_dump(),
        detailed_interpretation=detailed_interpretation.model_dump(),
        action_plan=action_plan.model_dump(),
        risk_flags=risk_flags,
        confidence_score=confidence_score,
    )
    session.add(report_row)
    await session.flush()
    report_id = report_row.id

    return ReportResponse(
        id=report_id,
        holland_code=holland_code,
        mbti_type=mbti_type,
        age_band=age_band,
        summary_card=summary_card,
        detailed_interpretation=detailed_interpretation,
        action_plan=action_plan,
        risk_flags=risk_flags,
        confidence_score=confidence_score,
        recommendations=recommendations,
    )


@router.get("/by-session/{session_id}", response_model=ReportResponse)
async def get_report_by_session(session_id: str, session: DbSession) -> ReportResponse:
    report_result = await session.execute(
        select(Report).where(Report.session_id == session_id).order_by(Report.created_at.desc())
    )
    report_row = report_result.scalars().first()
    if report_row is None:
        raise HTTPException(status_code=404, detail="Report not found for session")

    recommendation_row = None
    if report_row.recommendation_id:
        recommendation_row = await session.get(Recommendation, report_row.recommendation_id)

    return _to_report_response(report_row, recommendation_row)


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(report_id: str, session: DbSession) -> ReportResponse:
    report_row = await session.get(Report, report_id)
    if report_row is None:
        raise HTTPException(status_code=404, detail="Report not found")

    recommendation_row = None
    if report_row.recommendation_id:
        recommendation_row = await session.get(Recommendation, report_row.recommendation_id)

    return _to_report_response(report_row, recommendation_row)


@router.get("/{report_id}/pdf")
async def get_report_pdf(report_id: str, session: DbSession) -> dict:
    _ = session
    _ = report_id
    raise HTTPException(
        status_code=501,
        detail="PDF generation is not implemented yet in this service.",
    )
