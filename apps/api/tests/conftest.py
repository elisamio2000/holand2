"""Pytest configuration and shared fixtures."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.deps import get_current_user
from app.main import app
from app.models.base import Base
from app.models.user import User, UserRole

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
    if hasattr(app.state.limiter, "_storage"):
        app.state.limiter._storage.reset()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    if hasattr(app.state.limiter, "_storage"):
        app.state.limiter._storage.reset()
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def admin_client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    async def override_current_user() -> User:
        return User(
            id="test-admin-id",
            username="admin",
            email="admin@holand.dev",
            hashed_password="not-used-in-tests",
            role=UserRole.ADMIN,
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user
    if hasattr(app.state.limiter, "_storage"):
        app.state.limiter._storage.reset()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    if hasattr(app.state.limiter, "_storage"):
        app.state.limiter._storage.reset()
    app.dependency_overrides.clear()
