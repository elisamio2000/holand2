"""Tests for recommendation quality monitor and admin alert endpoint."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.models.recommendation_quality import RecommendationFeedback


class TestRecommendationQualityMonitor:
    @pytest.mark.asyncio
    async def test_feedback_submission_with_reason_taxonomy(self, client):
        report_response = await client.post(
            "/reports/generate",
            json={
                "holland_scores": {"R": 12, "I": 30, "A": 8, "S": 10, "E": 5, "C": 20},
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
                "session_id": "quality-loop-session-1",
            },
        )
        assert report_response.status_code == 200
        report_id = report_response.json()["id"]

        response = await client.post(
            "/recommendations/feedback",
            json={
                "report_id": report_id,
                "user_id": "user-1",
                "helpful": False,
                "rating": 2,
                "accepted": False,
                "reason_code": "explanation_unclear",
                "comment": "Needs clearer reasoning",
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert body["report_id"] == report_id
        assert body["session_id"] == "quality-loop-session-1"
        assert body["recommendation_id"]
        assert body["helpful"] is False
        assert body["reason_code"] == "explanation_unclear"
        assert body["accepted"] is False

    @pytest.mark.asyncio
    async def test_quality_alert_triggered_for_low_quality_feedback(self, client):
        # threshold defaults: min_samples=10, threshold=35%
        for i in range(10):
            report_response = await client.post(
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
                    "session_id": f"quality-alert-session-{i}",
                },
            )
            assert report_response.status_code == 200
            report_id = report_response.json()["id"]

            response = await client.post(
                "/recommendations/feedback",
                json={
                    "report_id": report_id,
                    "user_id": f"user-{i}",
                    "helpful": not i < 5,
                    "rating": 1 if i < 5 else 5,  # 5 low-quality out of 10 => 50%
                    "accepted": not i < 5,
                    "reason_code": "low_relevance_to_profile" if i < 5 else None,
                },
            )
            assert response.status_code == 201

        response = await client.get("/admin/alerts/recommendation-quality")
        assert response.status_code == 200
        body = response.json()
        assert body["total_feedback"] == 10
        assert body["helpful_feedback"] == 5
        assert body["unhelpful_feedback"] == 5
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
            report_response = await client.post(
                "/reports/generate",
                json={
                    "holland_scores": {"R": 15, "I": 25, "A": 5, "S": 10, "E": 10, "C": 20},
                    "mbti_scores": {
                        "E": 35,
                        "I": 65,
                        "S": 45,
                        "N": 55,
                        "T": 60,
                        "F": 40,
                        "J": 60,
                        "P": 40,
                    },
                    "age": 24,
                    "session_id": f"quality-good-session-{i}",
                },
            )
            assert report_response.status_code == 200

            response = await client.post(
                "/recommendations/feedback",
                json={
                    "report_id": report_response.json()["id"],
                    "user_id": f"good-user-{i}",
                    "helpful": True,
                    "rating": 5,
                    "accepted": True,
                },
            )
            assert response.status_code == 201

        response = await client.get("/admin/alerts/recommendation-quality")
        assert response.status_code == 200
        body = response.json()
        assert body["alert_triggered"] is False
        assert body["alert_code"] == "RECOMMENDATION_QUALITY_OK"
        assert body["severity"] == "ok"
        assert body["recommended_action"] == "continue-monitoring"

    @pytest.mark.asyncio
    async def test_feedback_trends_and_reason_aggregation(self, client):
        for i in range(6):
            report_response = await client.post(
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
                    "session_id": f"trend-session-{i}",
                },
            )
            assert report_response.status_code == 200

            feedback_response = await client.post(
                "/recommendations/feedback",
                json={
                    "report_id": report_response.json()["id"],
                    "helpful": i >= 3,
                    "rating": 2 if i < 3 else 5,
                    "accepted": i >= 3,
                    "reason_code": "explanation_unclear" if i < 2 else "age_band_mismatch" if i == 2 else None,
                },
            )
            assert feedback_response.status_code == 201

        response = await client.get("/admin/recommendation-quality/trends?window_days=30")
        assert response.status_code == 200
        body = response.json()
        assert body["window_days"] == 30
        assert body["total_feedback"] == 6
        assert body["unhelpful_feedback"] == 3
        assert body["unhelpful_ratio"] == 50.0
        assert len(body["trend_points"]) >= 1
        reason_counts = {r["reason_code"]: r["count"] for r in body["top_unhelpful_reasons"]}
        assert reason_counts["explanation_unclear"] == 2
        assert reason_counts["age_band_mismatch"] == 1

    @pytest.mark.asyncio
    async def test_quality_drift_endpoint_reports_degrading_status(self, client, db_session):
        old_report = await client.post(
            "/reports/generate",
            json={
                "holland_scores": {"R": 15, "I": 25, "A": 8, "S": 10, "E": 7, "C": 20},
                "mbti_scores": {
                    "E": 32,
                    "I": 68,
                    "S": 46,
                    "N": 54,
                    "T": 62,
                    "F": 38,
                    "J": 58,
                    "P": 42,
                },
                "age": 24,
                "session_id": "drift-prev",
            },
        )
        assert old_report.status_code == 200
        old_feedback = await client.post(
            "/recommendations/feedback",
            json={
                "report_id": old_report.json()["id"],
                "helpful": True,
                "rating": 5,
                "accepted": True,
            },
        )
        assert old_feedback.status_code == 201
        old_feedback_id = old_feedback.json()["id"]

        old_timestamp = datetime.now(UTC) - timedelta(days=8)
        await db_session.execute(
            update(RecommendationFeedback)
            .where(RecommendationFeedback.id == old_feedback_id)
            .values(created_at=old_timestamp)
        )
        await db_session.commit()

        for i in range(2):
            report_response = await client.post(
                "/reports/generate",
                json={
                    "holland_scores": {"R": 12, "I": 28, "A": 10, "S": 8, "E": 12, "C": 18},
                    "mbti_scores": {
                        "E": 40,
                        "I": 60,
                        "S": 50,
                        "N": 50,
                        "T": 55,
                        "F": 45,
                        "J": 55,
                        "P": 45,
                    },
                    "age": 24,
                    "session_id": f"drift-current-{i}",
                },
            )
            assert report_response.status_code == 200
            feedback_response = await client.post(
                "/recommendations/feedback",
                json={
                    "report_id": report_response.json()["id"],
                    "helpful": False,
                    "rating": 1,
                    "accepted": False,
                    "reason_code": "low_relevance_to_profile",
                },
            )
            assert feedback_response.status_code == 201

        response = await client.get("/admin/recommendation-quality/drift?window_days=7")
        assert response.status_code == 200
        body = response.json()
        assert body["window_days"] == 7
        assert body["current_total_feedback"] == 2
        assert body["previous_total_feedback"] == 1
        assert body["drift_status"] == "degrading"

    @pytest.mark.asyncio
    async def test_monitoring_metrics_expose_quality_loop_kpis(self, client):
        report_response = await client.post(
            "/reports/generate",
            json={
                "holland_scores": {"R": 10, "I": 20, "A": 10, "S": 20, "E": 10, "C": 20},
                "mbti_scores": {
                    "E": 45,
                    "I": 55,
                    "S": 50,
                    "N": 50,
                    "T": 55,
                    "F": 45,
                    "J": 55,
                    "P": 45,
                },
                "age": 24,
                "session_id": "monitoring-kpi-session",
            },
        )
        assert report_response.status_code == 200
        feedback_response = await client.post(
            "/recommendations/feedback",
            json={
                "report_id": report_response.json()["id"],
                "helpful": False,
                "rating": 2,
                "accepted": False,
                "reason_code": "missing_actionability",
            },
        )
        assert feedback_response.status_code == 201

        metrics_response = await client.get("/monitoring/metrics")
        assert metrics_response.status_code == 200
        quality_loop = metrics_response.json()["quality_loop_kpis"]
        assert quality_loop["feedback_total"] >= 1
        assert quality_loop["feedback_unhelpful_total"] >= 1
        assert quality_loop["feedback_reasons"]["missing_actionability"] >= 1
