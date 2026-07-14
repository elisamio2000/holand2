"""Tests for counselor dashboard endpoint and RBAC boundaries."""

import pytest

from app.models.counselor_assignment import CounselorAssignment
from app.models.user import User, UserRole


async def _register(client, username: str):
    response = await client.post(
        "/auth/register",
        json={
            "username": username,
            "password": "correct-horse",
            "email": f"{username}@example.com",
            "first_name": "Test",
            "last_name": username.title(),
            "national_id": f"nid-{username}",
            "mobile_number": f"mobile-{username}",
            "center_name": "Counselor Test Center",
        },
    )
    assert response.status_code == 201
    body = response.json()
    return body["user"]["id"], {"Authorization": f"Bearer {body['access_token']}"}


@pytest.mark.asyncio
class TestCounselorDashboardApi:
    async def test_dashboard_requires_counselor_or_admin(self, client):
        _, user_headers = await _register(client, "cg-user")
        response = await client.get("/counselor/dashboard", headers=user_headers)
        assert response.status_code == 403

    async def test_dashboard_returns_assigned_students_with_trends(self, client, db_session):
        counselor_id, counselor_headers = await _register(client, "cg-counselor")
        student_id, student_headers = await _register(client, "cg-student")

        counselor = await db_session.get(User, counselor_id)
        assert counselor is not None
        counselor.role = UserRole.COUNSELOR
        db_session.add(
            CounselorAssignment(counselor_user_id=counselor_id, student_user_id=student_id)
        )
        await db_session.commit()

        first_payload = {
            "holland_scores": {"R": 20, "I": 18, "A": 9, "S": 11, "E": 22, "C": 20},
            "mbti_scores": {"E": 45, "I": 55, "S": 52, "N": 48, "T": 62, "F": 38, "J": 57, "P": 43},
            "age": 19,
            "session_id": "student-session-1",
        }
        second_payload = {
            "holland_scores": {"R": 12, "I": 26, "A": 8, "S": 15, "E": 14, "C": 25},
            "mbti_scores": {"E": 38, "I": 62, "S": 49, "N": 51, "T": 58, "F": 42, "J": 60, "P": 40},
            "age": 19,
            "session_id": "student-session-2",
        }
        assert (
            await client.post("/reports/generate", json=first_payload, headers=student_headers)
        ).status_code == 200
        assert (
            await client.post("/reports/generate", json=second_payload, headers=student_headers)
        ).status_code == 200

        response = await client.get("/counselor/dashboard", headers=counselor_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["stats"]["total_students"] == 1
        assert body["stats"]["completed_assessments"] == 1
        assert len(body["students"]) == 1
        student = body["students"][0]
        assert student["student_id"] == student_id
        assert student["latest_report_id"]
        assert student["compare_report_id"]
        assert student["confidence_delta"] is not None
