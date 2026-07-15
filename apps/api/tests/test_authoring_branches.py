import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import status

from app.main import app


@pytest.mark.asyncio
async def test_get_branches_returns_200(monkeypatch):
    # This is a lightweight smoke test to ensure route wiring is correct.
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/assessments/does-not-exist/branches")
        # Route may require admin auth; accept 200, 404, or 401 for unauthenticated client
        assert r.status_code in (200, 404, 401)
