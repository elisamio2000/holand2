"""Tests for the Phase 4/5 recommendations and reports HTTP APIs."""

import pytest

from app.models.counselor_assignment import CounselorAssignment
from app.models.user import User, UserRole


@pytest.mark.asyncio
class TestRecommendationsApi:
    async def test_post_recommendations_v2(self, client):
        response = await client.post(
            "/recommendations",
            json={"holland_code": "IRC", "mbti_type": "INTJ", "age": 22, "limit": 6},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["age_band"] == "18-24"
        assert isinstance(body["careers"], list)
        assert isinstance(body["majors"], list)
        assert 0 <= body["confidence_score"] <= 100

    async def test_post_recommendations_v2_invalid_age(self, client):
        response = await client.post(
            "/recommendations",
            json={"holland_code": "IRC", "mbti_type": "INTJ", "age": 200, "limit": 6},
        )
        assert response.status_code == 422

    async def test_job_catalog_excludes_deprecated(self, client):
        response = await client.get("/recommendations/catalog/jobs")
        assert response.status_code == 200
        titles = response.json()
        assert "کارمند ورود اطلاعات" not in titles  # deprecated Data Entry Clerk (fa)

    async def test_major_catalog_returns_fifty_or_fewer(self, client):
        response = await client.get("/recommendations/catalog/majors")
        assert response.status_code == 200
        assert len(response.json()) <= 50

    async def test_recommendation_quality_signal_applies_safe_heuristic(self, admin_client):
        target_holland_code = None
        target_mbti_type = None
        for i in range(10):
            report_response = await admin_client.post(
                "/reports/generate",
                json={
                    "holland_scores": {"R": 10, "I": 30, "A": 5, "S": 10, "E": 5, "C": 20},
                    "mbti_scores": {
                        "E": 30,
                        "I": 70,
                        "S": 40,
                        "N": 60,
                        "T": 65,
                        "F": 35,
                        "J": 55,
                        "P": 45,
                    },
                    "age": 22,
                    "session_id": f"heuristic-session-{i}",
                },
            )
            assert report_response.status_code == 200
            report_body = report_response.json()
            if target_holland_code is None:
                target_holland_code = report_body["holland_code"]
                target_mbti_type = report_body["mbti_type"]

            feedback_response = await admin_client.post(
                "/recommendations/feedback",
                json={
                    "report_id": report_body["id"],
                    "helpful": i >= 6,
                    "rating": 2 if i < 6 else 5,
                    "accepted": i >= 6,
                    "reason_code": "low_relevance_to_profile" if i < 6 else None,
                },
            )
            assert feedback_response.status_code == 201

        response = await admin_client.post(
            "/recommendations",
            json={
                "holland_code": target_holland_code,
                "mbti_type": target_mbti_type,
                "age": 22,
                "limit": 6,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["quality_signal"]["low_quality_detected"] is True
        assert body["quality_signal"]["heuristic_applied"] is True
        assert body["quality_signal"]["sample_size"] >= 10
        assert any(item["quality_note_fa"] for item in body["careers"])


@pytest.mark.asyncio
class TestReportsApi:
    async def _auth_headers(self, client, username: str):
        reg = await client.post(
            "/auth/register",
            json={
                "username": username,
                "password": "correct-horse",
                "email": f"{username}@example.com",
                "first_name": "Test",
                "last_name": username.title(),
                "national_id": f"nid-{username}",
                "mobile_number": f"mobile-{username}",
                "center_name": "Reports Test Center",
            },
        )
        assert reg.status_code == 201
        body = reg.json()
        return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]["id"]

    async def test_generate_report_full_flow(self, client):
        headers, _ = await self._auth_headers(client, "report-full-flow")
        payload = {
            "holland_scores": {"R": 10, "I": 30, "A": 5, "S": 10, "E": 5, "C": 20},
            "mbti_scores": {
                "E": 30, "I": 70, "S": 40, "N": 60, "T": 65, "F": 35, "J": 55, "P": 45
            },
            "age": 20,
        }
        response = await client.post("/reports/generate", json=payload, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["id"]
        assert body["holland_code"]
        assert body["mbti_type"]
        assert body["age_band"] == "18-24"
        assert body["summary_card"]["headline_fa"]
        assert body["detailed_interpretation"]["psychometric_fa"]
        assert body["action_plan"]["short_term_3_months_fa"]
        assert isinstance(body["risk_flags"], list) and body["risk_flags"]
        assert 0 <= body["confidence_score"] <= 100

    async def test_generate_then_fetch_report(self, client):
        headers, _ = await self._auth_headers(client, "report-fetch")
        session_id = "session-report-fetch-01"
        payload = {
            "holland_scores": {"R": 5, "I": 10, "A": 30, "S": 20, "E": 10, "C": 5},
            "mbti_scores": {
                "E": 60, "I": 40, "S": 30, "N": 70, "T": 30, "F": 70, "J": 30, "P": 70
            },
            "age": 16,
            "session_id": session_id,
        }
        create_response = await client.post("/reports/generate", json=payload, headers=headers)
        assert create_response.status_code == 200
        report_id = create_response.json()["id"]

        get_response = await client.get(f"/reports/{report_id}", headers=headers)
        assert get_response.status_code == 200
        assert get_response.json()["id"] == report_id
        assert get_response.json()["age_band"] == "13-17"

    async def test_generate_then_fetch_report_by_session(self, client):
        headers, _ = await self._auth_headers(client, "report-fetch-session")
        session_id = "session-report-fetch-02"
        payload = {
            "holland_scores": {"R": 15, "I": 20, "A": 10, "S": 25, "E": 20, "C": 10},
            "mbti_scores": {
                "E": 40, "I": 60, "S": 55, "N": 45, "T": 50, "F": 50, "J": 65, "P": 35
            },
            "age": 24,
            "session_id": session_id,
        }
        create_response = await client.post("/reports/generate", json=payload, headers=headers)
        assert create_response.status_code == 200

        get_response = await client.get(f"/reports/by-session/{session_id}", headers=headers)
        assert get_response.status_code == 200
        body = get_response.json()
        assert body["id"] == create_response.json()["id"]
        assert body["age_band"] == "18-24"

    async def test_get_report_by_session_missing_returns_404(self, client):
        headers, _ = await self._auth_headers(client, "report-missing-session")
        response = await client.get("/reports/by-session/no-such-session", headers=headers)
        assert response.status_code == 404

    async def test_get_missing_report_returns_404(self, client):
        headers, _ = await self._auth_headers(client, "report-missing-id")
        response = await client.get("/reports/does-not-exist", headers=headers)
        assert response.status_code == 404

    async def test_get_report_pdf_returns_pdf(self, client):
        headers, _ = await self._auth_headers(client, "report-pdf")
        payload = {
            "holland_scores": {"R": 12, "I": 28, "A": 9, "S": 13, "E": 16, "C": 22},
            "mbti_scores": {
                "E": 35, "I": 65, "S": 55, "N": 45, "T": 62, "F": 38, "J": 58, "P": 42
            },
            "age": 23,
        }
        create_response = await client.post("/reports/generate", json=payload, headers=headers)
        report_id = create_response.json()["id"]
        response = await client.get(f"/reports/{report_id}/pdf", headers=headers)
        assert response.status_code in {200, 503}
        if response.status_code == 200:
            assert response.headers["content-type"].startswith("application/pdf")
            assert response.content.startswith(b"%PDF")
        else:
            assert "format=html" in response.json()["detail"]

    async def test_export_html_returns_html(self, client):
        headers, _ = await self._auth_headers(client, "report-html")
        payload = {
            "holland_scores": {"R": 14, "I": 22, "A": 8, "S": 15, "E": 18, "C": 20},
            "mbti_scores": {
                "E": 42, "I": 58, "S": 48, "N": 52, "T": 57, "F": 43, "J": 61, "P": 39
            },
            "age": 25,
        }
        create_response = await client.post("/reports/generate", json=payload, headers=headers)
        report_id = create_response.json()["id"]
        response = await client.get(f"/reports/{report_id}/export?format=html", headers=headers)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert "گزارش هدایت" in response.text

    async def test_generate_report_invalid_scores(self, client):
        headers, _ = await self._auth_headers(client, "report-invalid")
        payload = {
            "holland_scores": {"R": 10, "I": 20},
            "mbti_scores": {
                "E": 30, "I": 70, "S": 40, "N": 60, "T": 65, "F": 35, "J": 55, "P": 45
            },
            "age": 20,
        }
        response = await client.post("/reports/generate", json=payload, headers=headers)
        assert response.status_code == 400

    async def test_generate_report_confidence_is_capped_for_uncertain_profile(self, client):
        headers, _ = await self._auth_headers(client, "report-confidence")
        payload = {
            "holland_scores": {"R": 20, "I": 20, "A": 20, "S": 20, "E": 20, "C": 20},
            "mbti_scores": {
                "E": 51, "I": 49, "S": 50, "N": 50, "T": 52, "F": 48, "J": 51, "P": 49
            },
            "age": 22,
        }
        response = await client.post("/reports/generate", json=payload, headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert 20 <= body["confidence_score"] <= 95
        assert isinstance(body["risk_flags"], list) and len(body["risk_flags"]) >= 2

    async def test_report_access_is_restricted_between_users(self, client):
        owner_headers, _ = await self._auth_headers(client, "report-owner")
        other_headers, _ = await self._auth_headers(client, "report-other")
        payload = {
            "holland_scores": {"R": 11, "I": 27, "A": 6, "S": 14, "E": 17, "C": 25},
            "mbti_scores": {
                "E": 30, "I": 70, "S": 52, "N": 48, "T": 63, "F": 37, "J": 57, "P": 43
            },
            "age": 21,
        }
        create_response = await client.post("/reports/generate", json=payload, headers=owner_headers)
        report_id = create_response.json()["id"]

        forbidden = await client.get(f"/reports/{report_id}", headers=other_headers)
        assert forbidden.status_code == 403

    async def test_counselor_can_view_assigned_student_report(self, client, db_session):
        student_headers, student_id = await self._auth_headers(client, "assigned-student")
        counselor_headers, counselor_id = await self._auth_headers(client, "assigned-counselor")
        counselor_user = await db_session.get(User, counselor_id)
        assert counselor_user is not None
        counselor_user.role = UserRole.COUNSELOR
        db_session.add(
            CounselorAssignment(
                counselor_user_id=counselor_id,
                student_user_id=student_id,
            )
        )
        await db_session.commit()

        payload = {
            "holland_scores": {"R": 9, "I": 30, "A": 7, "S": 11, "E": 14, "C": 29},
            "mbti_scores": {
                "E": 44, "I": 56, "S": 51, "N": 49, "T": 59, "F": 41, "J": 62, "P": 38
            },
            "age": 19,
        }
        create_response = await client.post("/reports/generate", json=payload, headers=student_headers)
        report_id = create_response.json()["id"]

        allowed = await client.get(f"/reports/{report_id}", headers=counselor_headers)
        assert allowed.status_code == 200
