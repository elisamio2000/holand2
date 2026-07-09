"""Tests for monitoring endpoints and observability baseline."""

import pytest


class TestMonitoring:
    @pytest.mark.asyncio
    async def test_metrics_endpoint_returns_baseline(self, client):
        response = await client.get("/monitoring/metrics")
        assert response.status_code == 200
        body = response.json()
        assert "requests_total" in body
        assert "error_responses_total" in body
        assert "by_path" in body

    @pytest.mark.asyncio
    async def test_request_id_header_is_added(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        assert "x-request-id" in response.headers
