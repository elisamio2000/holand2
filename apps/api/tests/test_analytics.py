"""Tests for the analytics (funnel event) API."""

import pytest


class TestFunnelEvents:
    @pytest.mark.asyncio
    async def test_create_event(self, client):
        response = await client.post(
            "/analytics/events",
            json={"session_id": "s1", "event_name": "assessment_started", "step": "start"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["session_id"] == "s1"
        assert body["step"] == "start"

    @pytest.mark.asyncio
    async def test_create_event_validation_error(self, client):
        response = await client.post(
            "/analytics/events", json={"session_id": "", "event_name": "x", "step": "start"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_funnel_summary_empty(self, client):
        response = await client.get("/analytics/funnel")
        assert response.status_code == 200
        body = response.json()
        assert body["total_sessions"] == 0
        assert len(body["steps"]) == 4

    @pytest.mark.asyncio
    async def test_funnel_summary_computes_drop_off(self, client):
        # Two sessions start; only one reaches "complete".
        for session_id in ("s1", "s2"):
            await client.post(
                "/analytics/events",
                json={"session_id": session_id, "event_name": "e", "step": "start"},
            )
        await client.post(
            "/analytics/events",
            json={"session_id": "s1", "event_name": "e", "step": "complete"},
        )

        response = await client.get("/analytics/funnel")
        assert response.status_code == 200
        body = response.json()
        assert body["total_sessions"] == 2

        steps_by_name = {s["step"]: s for s in body["steps"]}
        assert steps_by_name["start"]["unique_sessions"] == 2
        assert steps_by_name["complete"]["unique_sessions"] == 1
        assert body["drop_off_rate"]["start->in_progress"] == 100.0
