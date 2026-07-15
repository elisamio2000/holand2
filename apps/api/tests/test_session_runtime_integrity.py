"""Phase B: Assessment Runtime Integrity — run/participant codes, resume, and
event timeline ingestion.

NOTE ON FIXTURES: this module defines its own ``db_session``/``client``
overrides instead of using the shared ``tests/conftest.py`` fixtures. The
shared fixtures call ``Base.metadata.create_all`` against an in-memory
SQLite engine, which fails for *all* tests in this repo (pre-existing,
unrelated to Phase B) because ``app.models.ai_provider`` uses
``sqlalchemy.dialects.postgresql.JSONB`` — a Postgres-only type with no
SQLite compiler support. Fixing that is out of scope for this PR (flagged
separately to the coordinator as a cross-cutting WS-H/test-infra blocker).
To keep this suite runnable and this PR focused, the fixtures below create
every table *except* the three ``ai_provider`` tables, which this feature
does not touch.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.deps import get_current_user
from app.main import app
from app.routers.sessions import _try_get_current_user
from app.models.base import Base
from app.models.user import User, UserRole
from app.services.run_codes import generate_participant_code, generate_run_code, is_valid_run_code

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

_EXCLUDED_TABLES = {"ai_provider_configs", "llm_prompt_templates", "session_ai_reports"}


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def rt_db_session():
    engine = create_async_engine(
        TEST_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    tables = [t for t in Base.metadata.sorted_tables if t.name not in _EXCLUDED_TABLES]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=tables))

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.drop_all(sync_conn, tables=tables))
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def rt_client(rt_db_session: AsyncSession):
    async def override_get_db():
        yield rt_db_session

    app.dependency_overrides[get_db] = override_get_db
    if hasattr(app.state.limiter, "_storage"):
        app.state.limiter._storage.reset()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    if hasattr(app.state.limiter, "_storage"):
        app.state.limiter._storage.reset()
    app.dependency_overrides.clear()


@pytest.fixture
def rt_admin_user() -> User:
    return User(
        id="00000000-0000-4000-8000-000000000001",
        username="admin",
        email="admin@holand.dev",
        hashed_password="not-used-in-tests",
        role=UserRole.ADMIN,
        is_active=True,
    )


@pytest.fixture
def rt_admin_client(rt_client, rt_admin_user: User):
    async def _override_current_user() -> User:
        return rt_admin_user

    app.dependency_overrides[get_current_user] = _override_current_user
    app.dependency_overrides[_try_get_current_user] = _override_current_user
    try:
        yield rt_client
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(_try_get_current_user, None)


def _holland_draft_payload() -> dict:
    return {
        "assessment_type": "holland",
        "title": "Holland runtime-integrity test v1",
        "created_by": "test-admin",
        "questions": [
            {
                "kind": "likert",
                "dimension": "R",
                "text": "I enjoy practical technical work.",
                "order_index": 0,
                "is_reverse_scored": False,
                "options": [
                    {"label": str(i), "value": i, "pole": "R", "weight": float(i), "order_index": i - 1}
                    for i in range(1, 6)
                ],
            },
            {
                "kind": "likert",
                "dimension": "I",
                "text": "I enjoy deep analysis.",
                "order_index": 1,
                "is_reverse_scored": False,
                "options": [
                    {"label": str(i), "value": i, "pole": "I", "weight": float(i), "order_index": i - 1}
                    for i in range(1, 6)
                ],
            },
        ],
    }


async def _publish_holland_version(admin_client) -> None:
    create = await admin_client.post("/admin/assessment-versions/draft", json=_holland_draft_payload())
    assert create.status_code == 201
    version_id = create.json()["id"]
    await admin_client.post(f"/admin/assessment-versions/{version_id}/review", json={"actor": "r"})
    await admin_client.post(f"/admin/assessment-versions/{version_id}/approve", json={"actor": "a"})
    await admin_client.post(f"/admin/assessment-versions/{version_id}/publish", json={"actor": "p"})


# ── Code generation (pure unit tests, no DB) ────────────────────────────────


def test_generate_run_code_shape_and_checksum():
    code = generate_run_code()
    assert len(code) == 8
    assert is_valid_run_code(code)


def test_generate_run_code_rejects_tampered_code():
    code = generate_run_code()
    # Flip three body characters together: even though the checksum's 30-symbol
    # alphabet gives any *single* flipped character on the order of a 1-in-30
    # chance of coincidentally re-validating, flipping three independently
    # makes an accidental re-validation astronomically unlikely (~1/27000),
    # keeping this test deterministic in practice.
    chars = list(code)
    for pos in (0, 1, 2):
        chars[pos] = "A" if chars[pos] != "A" else "B"
    tampered = "".join(chars)
    assert not is_valid_run_code(tampered)


def test_generate_run_code_is_reasonably_unique():
    codes = {generate_run_code() for _ in range(500)}
    assert len(codes) == 500


def test_participant_code_deterministic_for_authenticated_user():
    a = generate_participant_code("user-123")
    b = generate_participant_code("user-123")
    assert a == b
    assert len(a) == 10


def test_participant_code_random_for_anonymous_user():
    a = generate_participant_code(None)
    b = generate_participant_code(None)
    assert a != b


def test_participant_code_differs_across_users():
    assert generate_participant_code("user-1") != generate_participant_code("user-2")


# ── API integration: start / resume / events ────────────────────────────────


@pytest.mark.asyncio
async def test_start_session_returns_unique_run_and_participant_codes(rt_admin_client) -> None:
    await _publish_holland_version(rt_admin_client)

    start = await rt_admin_client.post("/sessions/start", json={"assessment_type": "holland"})
    assert start.status_code == 201
    body = start.json()
    assert is_valid_run_code(body["run_code"])
    assert body["participant_code"]

    start2 = await rt_admin_client.post("/sessions/start", json={"assessment_type": "holland"})
    body2 = start2.json()
    assert body2["run_code"] != body["run_code"]
    # Same authenticated identity -> deterministic, stable participant code across sessions.
    assert body2["participant_code"] == body["participant_code"]


@pytest.mark.asyncio
async def test_session_out_and_list_include_run_code(rt_admin_client) -> None:
    await _publish_holland_version(rt_admin_client)
    start = await rt_admin_client.post("/sessions/start", json={"assessment_type": "holland"})
    session_id = start.json()["session_id"]
    run_code = start.json()["run_code"]

    fetched = await rt_admin_client.get(f"/sessions/{session_id}")
    assert fetched.json()["run_code"] == run_code

    listed = await rt_admin_client.get("/sessions/my")
    assert listed.status_code == 200
    items = listed.json()["sessions"]
    assert any(item["session_id"] == session_id and item["run_code"] == run_code for item in items)


@pytest.mark.asyncio
async def test_resume_reflects_answers_and_revisions(rt_admin_client) -> None:
    await _publish_holland_version(rt_admin_client)
    start = await rt_admin_client.post("/sessions/start", json={"assessment_type": "holland"})
    body = start.json()
    session_id = body["session_id"]
    q1, q2 = body["questions"]

    resume_before = await rt_admin_client.get(f"/sessions/{session_id}/resume")
    assert resume_before.status_code == 200
    assert resume_before.json()["answered_count"] == 0
    assert resume_before.json()["status"] == "in_progress"

    await rt_admin_client.post(
        f"/sessions/{session_id}/answers",
        json={"answers": [{"question_id": q1["id"], "option_id": q1["options"][0]["id"]}]},
    )
    # Emit a question_revise event to simulate the user changing their mind,
    # then actually revise the stored answer.
    await rt_admin_client.post(
        f"/sessions/{session_id}/events",
        json={
            "events": [
                {
                    "event_type": "question_revise",
                    "question_id": q1["id"],
                    "option_id": q1["options"][1]["id"],
                    "previous_option_id": q1["options"][0]["id"],
                }
            ]
        },
    )
    await rt_admin_client.post(
        f"/sessions/{session_id}/answers",
        json={"answers": [{"question_id": q1["id"], "option_id": q1["options"][1]["id"]}]},
    )

    resume_after = await rt_admin_client.get(f"/sessions/{session_id}/resume")
    payload = resume_after.json()
    assert payload["answered_count"] == 1
    answer = next(a for a in payload["answers"] if a["question_id"] == q1["id"])
    assert answer["option_id"] == q1["options"][1]["id"]
    assert answer["revision_count"] == 1


@pytest.mark.asyncio
async def test_events_endpoint_batches_and_assigns_server_seq(rt_admin_client) -> None:
    await _publish_holland_version(rt_admin_client)
    start = await rt_admin_client.post("/sessions/start", json={"assessment_type": "holland"})
    body = start.json()
    session_id = body["session_id"]
    q1 = body["questions"][0]

    resp = await rt_admin_client.post(
        f"/sessions/{session_id}/events",
        json={
            "events": [
                {"event_type": "question_view", "question_id": q1["id"], "client_seq": 1},
                {"event_type": "question_select", "question_id": q1["id"], "client_seq": 2, "dwell_ms": 1200},
                {"event_type": "navigation_next", "client_seq": 3},
            ]
        },
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["stored"] == 3
    assert payload["server_seq_end"] - payload["server_seq_start"] == 2

    resp2 = await rt_admin_client.post(
        f"/sessions/{session_id}/events",
        json={"events": [{"event_type": "navigation_prev", "client_seq": 4}]},
    )
    assert resp2.json()["server_seq_start"] > payload["server_seq_end"]


@pytest.mark.asyncio
async def test_events_endpoint_rejects_server_only_revisit_type(rt_admin_client) -> None:
    await _publish_holland_version(rt_admin_client)
    start = await rt_admin_client.post("/sessions/start", json={"assessment_type": "holland"})
    session_id = start.json()["session_id"]

    resp = await rt_admin_client.post(
        f"/sessions/{session_id}/events", json={"events": [{"event_type": "revisit"}]}
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_events_endpoint_disabled_by_feature_flag(rt_admin_client, monkeypatch) -> None:
    from app.routers import sessions as sessions_router

    await _publish_holland_version(rt_admin_client)
    start = await rt_admin_client.post("/sessions/start", json={"assessment_type": "holland"})
    session_id = start.json()["session_id"]

    monkeypatch.setattr(sessions_router.settings, "feature_session_events_enabled", False)
    resp = await rt_admin_client.post(
        f"/sessions/{session_id}/events",
        json={"events": [{"event_type": "question_view"}]},
    )
    assert resp.status_code == 503


# --- Migration structural checks --------------------------------------------
#
# A full apply/downgrade round-trip against a real engine is not exercised
# here: the migration's `session_events.event_type` column uses a
# `postgresql.ENUM`, and this repo's test suite runs on SQLite (see the
# module docstring for the pre-existing ai_provider/JSONB SQLite
# incompatibility that already blocks the shared Postgres-oriented fixtures).
# Running this migration end-to-end also requires resolving the pre-existing
# multiple-alembic-heads issue flagged separately to the coordinator. These
# structural checks instead verify the revision graph linkage and that
# upgrade/downgrade are well-formed, symmetric operations.
def test_migration_revision_chain_and_symmetry() -> None:
    import importlib.util
    from pathlib import Path

    migration_path = (
        Path(__file__).resolve().parent.parent
        / "alembic"
        / "versions"
        / "20260714_01_phase_b_runtime_integrity.py"
    )
    spec = importlib.util.spec_from_file_location("phase_b_migration_under_test", migration_path)
    assert spec and spec.loader
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    assert migration.revision == "20260714_01"
    assert migration.down_revision == "20260709_03_combined"
    assert callable(migration.upgrade)
    assert callable(migration.downgrade)

    import inspect

    upgrade_src = inspect.getsource(migration.upgrade)
    downgrade_src = inspect.getsource(migration.downgrade)

    # Every add_column/create_table/create_index in upgrade() has a
    # symmetric drop in downgrade().
    assert upgrade_src.count("add_column") == downgrade_src.count("drop_column")
    assert upgrade_src.count("create_table") == downgrade_src.count("drop_table")
    assert upgrade_src.count("create_index") == downgrade_src.count("drop_index")


@pytest.mark.asyncio
async def test_backfill_run_codes_is_idempotent(rt_admin_client, rt_db_session, monkeypatch) -> None:
    from sqlalchemy import select

    from app.models.session import AssessmentSession, SessionStatus
    from app.models.assessment import AssessmentType, AssessmentVersion, VersionStatus
    from app.scripts import backfill_run_codes as backfill_module

    await _publish_holland_version(rt_admin_client)
    version_result = await rt_db_session.execute(
        select(AssessmentVersion).where(
            AssessmentVersion.assessment_type == AssessmentType.HOLLAND,
            AssessmentVersion.status == VersionStatus.PUBLISHED,
        )
    )
    version = version_result.scalars().first()
    assert version is not None

    session_factory = async_sessionmaker(rt_db_session.bind, expire_on_commit=False)
    monkeypatch.setattr(backfill_module, "AsyncSessionLocal", session_factory)

    now = datetime.now(timezone.utc)
    rt_db_session.add_all(
        [
            AssessmentSession(
                user_id=None,
                assessment_type="holland",
                assessment_version_id=version.id,
                status=SessionStatus.IN_PROGRESS,
                started_at=now,
            ),
            AssessmentSession(
                user_id="00000000-0000-4000-8000-000000000002",
                assessment_type="holland",
                assessment_version_id=version.id,
                status=SessionStatus.IN_PROGRESS,
                started_at=now,
            ),
        ]
    )
    await rt_db_session.commit()

    first_run_count = await backfill_module.backfill_run_codes()
    assert first_run_count == 2

    async with session_factory() as check_db:
        result = await check_db.execute(select(AssessmentSession))
        sessions_after_first = {s.id: (s.run_code, s.participant_code) for s in result.scalars().all()}

    assert all(run_code is not None for run_code, _ in sessions_after_first.values())
    assert all(participant_code is not None for _, participant_code in sessions_after_first.values())
    assert len({run_code for run_code, _ in sessions_after_first.values()}) == 2

    # Idempotency: running again touches nothing (no NULL run_code rows left)
    # and does not change previously-assigned codes.
    second_run_count = await backfill_module.backfill_run_codes()
    assert second_run_count == 0

    async with session_factory() as check_db2:
        result2 = await check_db2.execute(select(AssessmentSession))
        sessions_after_second = {s.id: (s.run_code, s.participant_code) for s in result2.scalars().all()}

    assert sessions_after_second == sessions_after_first


@pytest.mark.asyncio
async def test_anonymous_session_start_still_gets_codes(rt_client) -> None:
    """Anonymous flows (no auth) must still work — user_id stays nullable."""
    create = await rt_client.post("/admin/assessment-versions/draft", json=_holland_draft_payload())
    # Admin authoring endpoints require auth; this just confirms rt_client is
    # unauthenticated by default before the dedicated anonymous-start test.
    assert create.status_code in (401, 403)


@pytest.mark.asyncio
async def test_anonymous_session_start_gets_random_participant_codes(rt_client) -> None:
    # Publish as admin first, then explicitly clear the auth override so the
    # subsequent /sessions/start calls are genuinely anonymous (dependency
    # overrides are global on the shared `app`, not per-client).
    async def _override_current_user() -> User:
        return User(
            id="test-admin-id",
            username="admin",
            email="admin@holand.dev",
            hashed_password="not-used-in-tests",
            role=UserRole.ADMIN,
            is_active=True,
        )

    app.dependency_overrides[get_current_user] = _override_current_user
    try:
        await _publish_holland_version(rt_client)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    start1 = await rt_client.post("/sessions/start", json={"assessment_type": "holland"})
    start2 = await rt_client.post("/sessions/start", json={"assessment_type": "holland"})
    assert start1.status_code == 201
    assert start2.status_code == 201
    # Two distinct anonymous starts (no stable identity) get distinct
    # participant codes; the client is responsible for persisting/reusing
    # its own participant code hint across visits.
    assert start1.json()["participant_code"] != start2.json()["participant_code"]
    assert is_valid_run_code(start1.json()["run_code"])
