import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_init_branch_route_smoke():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post("/assessments/does-not-exist/branches/child/init")
        # Endpoint may require admin auth; accept 401 for unauthenticated client
        assert r.status_code in (404, 201, 200, 401)
