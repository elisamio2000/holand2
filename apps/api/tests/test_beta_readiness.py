"""Tests for beta launch readiness gates."""

import pytest

from app.monitoring import metrics_baseline


@pytest.fixture
def reset_metrics_baseline():
    before_requests = metrics_baseline.requests_total
    before_errors = metrics_baseline.error_responses_total
    before_by_path = dict(metrics_baseline.by_path)
    yield
    metrics_baseline.requests_total = before_requests
    metrics_baseline.error_responses_total = before_errors
    metrics_baseline.by_path = before_by_path


class TestBetaReadiness:
    @pytest.mark.asyncio
    async def test_readiness_reports_go_when_all_checks_pass(self, client, reset_metrics_baseline):
        for i in range(10):
            await client.post(
                "/analytics/events",
                json={"session_id": f"s-{i}", "event_name": "assessment", "step": "start"},
            )
        for i in range(8):
            await client.post(
                "/analytics/events",
                json={"session_id": f"s-{i}", "event_name": "assessment", "step": "complete"},
            )

        for i in range(10):
            await client.post(
                "/recommendations/feedback",
                json={
                    "recommendation_id": f"rec-{i}",
                    "user_id": f"user-{i}",
                    "rating": 5,
                    "accepted": True,
                },
            )

        response = await client.get("/monitoring/readiness")
        assert response.status_code == 200
        body = response.json()
        assert body["go_no_go"] == "go"
        assert all(item["passed"] for item in body["checks"])

    @pytest.mark.asyncio
    async def test_readiness_blocks_when_completion_drops_below_threshold(
        self, client, reset_metrics_baseline
    ):
        for i in range(10):
            await client.post(
                "/analytics/events",
                json={"session_id": f"s-low-{i}", "event_name": "assessment", "step": "start"},
            )
        for i in range(5):
            await client.post(
                "/analytics/events",
                json={
                    "session_id": f"s-low-{i}",
                    "event_name": "assessment",
                    "step": "complete",
                },
            )

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

        response = await client.get("/monitoring/readiness")
        assert response.status_code == 200
        body = response.json()
        assert body["go_no_go"] == "no-go"
        completion_check = next(
            item for item in body["checks"] if item["name"] == "assessment_completion_rate"
        )
        assert completion_check["passed"] is False

    @pytest.mark.asyncio
    async def test_readiness_blocks_when_5xx_rate_exceeds_threshold(self, client, reset_metrics_baseline):
        metrics_baseline.requests_total = 200
        metrics_baseline.error_responses_total = 4

        response = await client.get("/monitoring/readiness")
        assert response.status_code == 200
        body = response.json()
        assert body["go_no_go"] == "no-go"
        error_check = next(item for item in body["checks"] if item["name"] == "api_error_5xx_rate")
        assert error_check["passed"] is False
