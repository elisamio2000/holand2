"""Tests for recommendation quality monitor and admin alert endpoint."""

import pytest


class TestRecommendationQualityMonitor:
    @pytest.mark.asyncio
    async def test_feedback_submission(self, client):
        response = await client.post(
            "/recommendations/feedback",
            json={
                "recommendation_id": "rec-1",
                "user_id": "user-1",
                "rating": 5,
                "accepted": True,
                "comment": "Useful recommendation",
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert body["recommendation_id"] == "rec-1"
        assert body["rating"] == 5
        assert body["accepted"] is True

    @pytest.mark.asyncio
    async def test_quality_alert_triggered_for_low_quality_feedback(self, client):
        # threshold defaults: min_samples=10, threshold=35%
        for i in range(10):
            await client.post(
                "/recommendations/feedback",
                json={
                    "recommendation_id": f"rec-{i}",
                    "user_id": f"user-{i}",
                    "rating": 1 if i < 5 else 5,  # 5 low-quality out of 10 => 50%
                    "accepted": not i < 5,
                },
            )

        response = await client.get("/admin/alerts/recommendation-quality")
        assert response.status_code == 200
        body = response.json()
        assert body["total_feedback"] == 10
        assert body["low_quality_feedback"] == 5
        assert body["low_quality_ratio"] == 50.0
        assert body["alert_triggered"] is True
        assert body["alert_code"] == "RECOMMENDATION_QUALITY_DEGRADED"
        assert body["severity"] == "warning"
        assert body["recommended_action"] == (
            "review-latest-feedback-and-adjust-recommendation-weights"
        )

    @pytest.mark.asyncio
    async def test_quality_alert_not_triggered_when_below_threshold(self, client):
        for i in range(10):
            await client.post(
                "/recommendations/feedback",
                json={
                    "recommendation_id": f"good-rec-{i}",
                    "user_id": f"good-user-{i}",
                    "rating": 5,
                    "accepted": True,
                },
            )

        response = await client.get("/admin/alerts/recommendation-quality")
        assert response.status_code == 200
        body = response.json()
        assert body["alert_triggered"] is False
        assert body["alert_code"] == "RECOMMENDATION_QUALITY_OK"
        assert body["severity"] == "ok"
        assert body["recommended_action"] == "continue-monitoring"
