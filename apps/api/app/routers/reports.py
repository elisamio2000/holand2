"""Phase 5: report generation + retrieval + export API."""

from html import escape
from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user
from ..models.counselor_assignment import CounselorAssignment
from ..models.recommendation import Recommendation
from ..models.report import Report
from ..models.user import User, UserRole, has_admin_access, has_counselor_access
from ..schemas import (
    RecommendationResponseV2,
    ReportHistoryItem,
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
CurrentUser = Annotated[User, Depends(get_current_user)]


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


async def _is_assigned_counselor(
    session: AsyncSession, counselor_user_id: str, student_user_id: str | None
) -> bool:
    if not student_user_id:
        return False
    result = await session.execute(
        select(CounselorAssignment.id).where(
            CounselorAssignment.counselor_user_id == counselor_user_id,
            CounselorAssignment.student_user_id == student_user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _assert_can_access_report(
    session: AsyncSession, report_row: Report, current_user: User
) -> None:
    if has_admin_access(current_user.role):
        return
    if current_user.role == UserRole.USER:
        if report_row.user_id == current_user.id:
            return
        raise HTTPException(status_code=403, detail="Insufficient permissions for this report")
    if has_counselor_access(current_user.role):
        allowed = await _is_assigned_counselor(session, current_user.id, report_row.user_id)
        if allowed:
            return
    raise HTTPException(status_code=403, detail="Insufficient permissions for this report")


def _build_export_html(report: ReportResponse) -> str:
    def section(title: str, body: str) -> str:
        return f"<h2>{escape(title)}</h2><p>{escape(body)}</p>"

    careers = "".join(f"<li>{escape(item.title_fa)} — {round(item.fit_score)}%</li>" for item in report.recommendations.careers)
    majors = "".join(f"<li>{escape(item.title_fa)} — {round(item.fit_score)}%</li>" for item in report.recommendations.majors)
    short_plan = "".join(f"<li>{escape(item)}</li>" for item in report.action_plan.short_term_3_months_fa)
    mid_plan = "".join(f"<li>{escape(item)}</li>" for item in report.action_plan.mid_term_6_months_fa)
    long_plan = "".join(f"<li>{escape(item)}</li>" for item in report.action_plan.long_term_12_months_fa)
    risks = "".join(f"<li>{escape(item)}</li>" for item in report.risk_flags)

    return f"""<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>Holand Report {escape(report.id or "")}</title>
    <style>
      body {{ font-family: sans-serif; line-height: 1.7; padding: 24px; color: #222; }}
      h1, h2 {{ margin: 0 0 8px; }}
      section {{ margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }}
      ul {{ margin: 8px 0; }}
      .meta {{ color: #4b5563; font-size: 13px; }}
    </style>
  </head>
  <body>
    <h1>گزارش هدایت تحصیلی/شغلی</h1>
    <p class="meta">شناسه گزارش: {escape(report.id or "")} | کد هالند: {escape(report.holland_code)} | MBTI: {escape(report.mbti_type)} | گروه سنی: {escape(report.age_band)}</p>
    <section>{section("خلاصه", report.summary_card.headline_fa)}</section>
    <section>
      {section("تفسیر روان‌سنجی", report.detailed_interpretation.psychometric_fa)}
      {section("تناسب رفتاری", report.detailed_interpretation.behavioral_fit_fa)}
      {section("تحلیل مسیر", report.detailed_interpretation.career_major_fa)}
      {section("رشد مهارتی", report.detailed_interpretation.skill_growth_fa)}
    </section>
    <section><h2>مشاغل پیشنهادی</h2><ul>{careers or "<li>—</li>"}</ul></section>
    <section><h2>رشته‌های پیشنهادی</h2><ul>{majors or "<li>—</li>"}</ul></section>
    <section>
      <h2>برنامه اقدام</h2>
      <h3>۳ ماه</h3><ul>{short_plan or "<li>—</li>"}</ul>
      <h3>۶ ماه</h3><ul>{mid_plan or "<li>—</li>"}</ul>
      <h3>۱۲ ماه</h3><ul>{long_plan or "<li>—</li>"}</ul>
    </section>
    <section><h2>نکات احتیاطی</h2><ul>{risks or "<li>—</li>"}</ul></section>
    <p class="meta">امتیاز اطمینان: {round(report.confidence_score)}%</p>
  </body>
</html>"""


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    payload: ReportRequest,
    session: DbSession,
    current_user: CurrentUser,
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
        user_id=current_user.id,
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
async def get_report_by_session(
    session_id: str, session: DbSession, current_user: CurrentUser
) -> ReportResponse:
    report_result = await session.execute(
        select(Report).where(Report.session_id == session_id).order_by(Report.created_at.desc())
    )
    report_row = report_result.scalars().first()
    if report_row is None:
        raise HTTPException(status_code=404, detail="Report not found for session")
    await _assert_can_access_report(session, report_row, current_user)

    recommendation_row = None
    if report_row.recommendation_id:
        recommendation_row = await session.get(Recommendation, report_row.recommendation_id)

    return _to_report_response(report_row, recommendation_row)


@router.get("/history", response_model=list[ReportHistoryItem])
async def list_report_history(session: DbSession, current_user: CurrentUser) -> list[ReportHistoryItem]:
    if has_admin_access(current_user.role):
        rows_result = await session.execute(select(Report).order_by(Report.created_at.desc()))
    elif has_counselor_access(current_user.role):
        assigned_student_ids = select(CounselorAssignment.student_user_id).where(
            CounselorAssignment.counselor_user_id == current_user.id
        )
        rows_result = await session.execute(
            select(Report)
            .where(Report.user_id.in_(assigned_student_ids))
            .order_by(Report.created_at.desc())
        )
    else:
        rows_result = await session.execute(
            select(Report).where(Report.user_id == current_user.id).order_by(Report.created_at.desc())
        )

    rows = rows_result.scalars().all()
    if not rows:
        return []

    user_ids = [r.user_id for r in rows if r.user_id]
    users_result = await session.execute(select(User).where(User.id.in_(user_ids)))
    users = {u.id: u for u in users_result.scalars().all()}

    reports_by_user: dict[str, list[Report]] = {}
    for report in rows:
        reports_by_user.setdefault(report.user_id or "", []).append(report)
    compare_to_by_report: dict[str, str] = {}
    for user_reports in reports_by_user.values():
        for idx, report in enumerate(user_reports):
            if idx + 1 < len(user_reports):
                compare_to_by_report[report.id] = user_reports[idx + 1].id

    history: list[ReportHistoryItem] = []
    for report in rows:
        summary_card = report.summary_card or {}
        owner = users.get(report.user_id or "")
        history.append(
            ReportHistoryItem(
                report_id=report.id,
                session_id=report.session_id,
                holland_code=report.holland_code,
                mbti_type=report.mbti_type,
                age_band=report.age_band,
                confidence_score=report.confidence_score,
                created_at=report.created_at,
                top_careers_fa=summary_card.get("top_careers_fa", []),
                top_majors_fa=summary_card.get("top_majors_fa", []),
                compare_to_report_id=compare_to_by_report.get(report.id),
                student_id=report.user_id,
                student_name=(owner.display_name or owner.username) if owner else None,
            )
        )
    return history


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(report_id: str, session: DbSession, current_user: CurrentUser) -> ReportResponse:
    report_row = await session.get(Report, report_id)
    if report_row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    await _assert_can_access_report(session, report_row, current_user)

    recommendation_row = None
    if report_row.recommendation_id:
        recommendation_row = await session.get(Recommendation, report_row.recommendation_id)

    return _to_report_response(report_row, recommendation_row)


@router.get("/{report_id}/export")
async def export_report(
    report_id: str,
    session: DbSession,
    current_user: CurrentUser,
    format: str = Query("pdf", pattern="^(pdf|html)$"),
):
    report_row = await session.get(Report, report_id)
    if report_row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    await _assert_can_access_report(session, report_row, current_user)

    recommendation_row = None
    if report_row.recommendation_id:
        recommendation_row = await session.get(Recommendation, report_row.recommendation_id)
    report = _to_report_response(report_row, recommendation_row)

    html = _build_export_html(report)
    filename_stem = f"holand-report-{report.id}"
    if format == "html":
        return HTMLResponse(
            content=html,
            headers={"Content-Disposition": f'attachment; filename="{filename_stem}.html"'},
        )

    try:
        from weasyprint import HTML

        pdf_bytes = HTML(string=html).write_pdf()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="PDF rendering is temporarily unavailable. Retry with format=html.",
        ) from exc
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename_stem}.pdf"'},
    )


@router.get("/{report_id}/pdf")
async def get_report_pdf(
    report_id: str,
    session: DbSession,
    current_user: CurrentUser,
):
    return await export_report(
        report_id=report_id,
        session=session,
        current_user=current_user,
        format="pdf",
    )
