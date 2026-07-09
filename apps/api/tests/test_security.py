"""Tests for security hardening middleware (headers, body size limit)."""

import pytest


class TestSecurityHeaders:
    @pytest.mark.asyncio
    async def test_security_headers_present(self, client):
        response = await client.get("/health")
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert "strict-transport-security" in response.headers
        assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"

    @pytest.mark.asyncio
    async def test_oversized_body_rejected(self, client):
        huge_payload = {"scores": {k: 1 for k in "RIASEC"}, "padding": "x" * 2_000_000}
        response = await client.post("/assessments/holland/score", json=huge_payload)
        assert response.status_code == 413
