"""Pytest configuration and shared fixtures."""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db
from app.models.base import Base


# ── In-memory SQLite for tests (no Postgres needed) ─────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def db_session():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(engine, expire_on_commit=False)
    async with TestSession() as session:
        await _seed_taxonomy(session)
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _seed_taxonomy(session: AsyncSession) -> None:
    """Seed the jobs/majors taxonomy so recommendation/report tests have data."""
    from app.data.jobs_dataset import JOBS_DATASET
    from app.data.majors_dataset import MAJORS_DATASET
    from app.models.job import Job, Major

    for entry in JOBS_DATASET:
        session.add(Job(**entry))
    for entry in MAJORS_DATASET:
        session.add(Major(**entry))
    await session.commit()


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
