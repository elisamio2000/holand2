"""Counselor dashboard APIs: assigned cases + latest trend snapshots."""

from collections import Counter
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user
from ..models.counselor_assignment import CounselorAssignment
from ..models.report import Report
from ..models.user import User, has_admin_access, has_counselor_access
from ..schemas import CounselorDashboardResponse, CounselorDashboardStats, CounselorStudentSummary

router = APIRouter(prefix="/counselor", tags=["Counselor"])
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def _dimension_averages(codes: list[str]) -> list[dict[str, float | str]]:
    letters = ["R", "I", "A", "S", "E", "C"]
    counts = Counter(letter for code in codes for letter in code if letter in letters)
    total = sum(counts.values())
    if total == 0:
        return [
            {
                "dimension": letter,
                "label": letter,
                "raw_score": 0.0,
                "normalized_score": 0.0,
            }
            for letter in letters
        ]
    return [
        {
            "dimension": letter,
            "label": letter,
            "raw_score": float(counts.get(letter, 0)),
            "normalized_score": round((counts.get(letter, 0) / total) * 100, 1),
        }
        for letter in letters
    ]


@router.get("/dashboard", response_model=CounselorDashboardResponse)
async def get_dashboard(
    session: DbSession,
    current_user: CurrentUser,
    counselor_id: str | None = Query(default=None),
) -> CounselorDashboardResponse:
    if not has_counselor_access(current_user.role):
        raise HTTPException(status_code=403, detail="Insufficient permissions for this action")

    target_counselor_id = counselor_id or current_user.id
    if not has_admin_access(current_user.role) and target_counselor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Counselors can only view their own dashboard")

    assignment_result = await session.execute(
        select(CounselorAssignment).where(CounselorAssignment.counselor_user_id == target_counselor_id)
    )
    assignments = assignment_result.scalars().all()
    student_ids = [a.student_user_id for a in assignments]
    if not student_ids:
        return CounselorDashboardResponse(
            stats=CounselorDashboardStats(
                total_students=0,
                completed_assessments=0,
                in_progress_assessments=0,
                average_completion_percent=0,
                dimension_averages=_dimension_averages([]),
            ),
            students=[],
        )

    user_result = await session.execute(select(User).where(User.id.in_(student_ids)))
    users = {u.id: u for u in user_result.scalars().all()}

    report_result = await session.execute(
        select(Report)
        .where(Report.user_id.in_(student_ids))
        .order_by(Report.user_id.asc(), Report.created_at.desc())
    )
    reports = report_result.scalars().all()

    reports_by_student: dict[str, list[Report]] = {}
    for report in reports:
        if not report.user_id:
            continue
        reports_by_student.setdefault(report.user_id, []).append(report)

    students: list[CounselorStudentSummary] = []
    for student_id in student_ids:
        student = users.get(student_id)
        latest = reports_by_student.get(student_id, [None])[0]
        previous = reports_by_student.get(student_id, [None, None])[1]
        has_report = latest is not None
        students.append(
            CounselorStudentSummary(
                session_id=(latest.session_id if latest and latest.session_id else f"assigned-{student_id}"),
                student_id=student_id,
                student_name=(student.display_name or student.username) if student else f"User {student_id}",
                age_band=(latest.age_band if latest else "13-17"),
                test_type="combined",
                status=("completed" if has_report else "in_progress"),
                progress_percent=(100 if has_report else 40),
                top_code=(latest.holland_code if latest else None),
                updated_at=(latest.updated_at if latest else (student.updated_at if student else current_user.updated_at)),
                latest_report_id=(latest.id if latest else None),
                latest_confidence_score=(latest.confidence_score if latest else None),
                confidence_delta=(
                    round(latest.confidence_score - previous.confidence_score, 1)
                    if latest and previous
                    else None
                ),
                compare_report_id=(previous.id if previous else None),
            )
        )

    students.sort(key=lambda s: s.updated_at, reverse=True)
    completed = sum(1 for s in students if s.status == "completed")
    latest_codes = [s.top_code for s in students if s.top_code]
    avg_completion = round(sum(s.progress_percent for s in students) / len(students))

    return CounselorDashboardResponse(
        stats=CounselorDashboardStats(
            total_students=len(students),
            completed_assessments=completed,
            in_progress_assessments=len(students) - completed,
            average_completion_percent=avg_completion,
            dimension_averages=_dimension_averages(latest_codes),
        ),
        students=students,
    )
