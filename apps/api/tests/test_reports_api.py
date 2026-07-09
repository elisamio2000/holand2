"""Tests for the Phase 4/5 recommendations and reports HTTP APIs."""

import pytest


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


@pytest.mark.asyncio
class TestReportsApi:
    async def test_generate_report_full_flow(self, client):
        payload = {
            "holland_scores": {"R": 10, "I": 30, "A": 5, "S": 10, "E": 5, "C": 20},
            "mbti_scores": {
                "E": 30, "I": 70, "S": 40, "N": 60, "T": 65, "F": 35, "J": 55, "P": 45
            },
            "age": 20,
        }
        response = await client.post("/reports/generate", json=payload)
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
        payload = {
            "holland_scores": {"R": 5, "I": 10, "A": 30, "S": 20, "E": 10, "C": 5},
            "mbti_scores": {
                "E": 60, "I": 40, "S": 30, "N": 70, "T": 30, "F": 70, "J": 30, "P": 70
            },
            "age": 16,
        }
        create_response = await client.post("/reports/generate", json=payload)
        assert create_response.status_code == 200
        report_id = create_response.json()["id"]

        get_response = await client.get(f"/reports/{report_id}")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == report_id
        assert get_response.json()["age_band"] == "13-17"

    async def test_get_missing_report_returns_404(self, client):
        response = await client.get("/reports/does-not-exist")
        assert response.status_code == 404

    async def test_generate_report_invalid_scores(self, client):
        payload = {
            "holland_scores": {"R": 10, "I": 20},
            "mbti_scores": {
                "E": 30, "I": 70, "S": 40, "N": 60, "T": 65, "F": 35, "J": 55, "P": 45
            },
            "age": 20,
        }
        response = await client.post("/reports/generate", json=payload)
        assert response.status_code == 400
