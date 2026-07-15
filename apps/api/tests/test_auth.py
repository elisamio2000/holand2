"""Tests for auth and RBAC behavior."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.auth_service import hash_password


def _registration_payload(username: str, password: str) -> dict[str, str]:
    return {
        "username": username,
        "password": password,
        "email": f"{username}@example.com",
        "first_name": "Test",
        "last_name": username.title(),
        "national_id": f"nid-{username}",
        "mobile_number": f"mobile-{username}",
        "center_name": "Test Center",
    }


async def _register(client: AsyncClient, username: str = "alice", password: str = "correct-horse"):
    return await client.post("/auth/register", json=_registration_payload(username, password))


async def test_register_returns_tokens_and_user(client: AsyncClient):
    resp = await _register(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["username"] == "alice"
    assert body["user"]["roles"] == ["user"]
    assert body["user"]["is_admin"] is False
    assert body["user"]["is_super_admin"] is False


async def test_register_requires_phase_a_identity_fields(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={
            "username": "missing-fields",
            "password": "correct-horse",
            "email": "missing@example.com",
        },
    )
    assert resp.status_code == 422


async def test_register_duplicate_username_conflicts(client: AsyncClient):
    await _register(client)
    resp = await _register(client)
    assert resp.status_code == 409


async def test_login_success_and_wrong_password(client: AsyncClient):
    await _register(client, username="bob", password="correct-horse")
    ok = await client.post("/auth/login", json={"username": "bob", "password": "correct-horse"})
    assert ok.status_code == 200

    bad = await client.post("/auth/login", json={"username": "bob", "password": "nope"})
    assert bad.status_code == 401


async def test_profile_requires_auth(client: AsyncClient):
    resp = await client.get("/users/me")
    assert resp.status_code == 401


async def test_profile_get_and_update(client: AsyncClient):
    reg = await _register(client, username="carol", password="correct-horse")
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = await client.get("/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["username"] == "carol"

    updated = await client.patch("/users/me", headers=headers, json={"display_name": "Carol C."})
    assert updated.status_code == 200
    assert updated.json()["display_name"] == "Carol C."


async def test_refresh_rotates_token_and_old_one_is_invalid(client: AsyncClient):
    reg = await _register(client, username="dave", password="correct-horse")
    refresh_token = reg.json()["refresh_token"]

    refreshed = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 200
    new_refresh_token = refreshed.json()["refresh_token"]
    assert new_refresh_token != refresh_token

    reused = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert reused.status_code == 401


async def test_logout_revokes_refresh_token(client: AsyncClient):
    reg = await _register(client, username="erin", password="correct-horse")
    refresh_token = reg.json()["refresh_token"]

    logout = await client.post("/auth/logout", json={"refresh_token": refresh_token})
    assert logout.status_code == 204

    refreshed = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 401


async def test_rbac_admin_only_endpoint(client: AsyncClient, db_session: AsyncSession):
    reg = await _register(client, username="frank", password="correct-horse")
    token = reg.json()["access_token"]
    user_id = reg.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    other = User(
        username="grace",
        email="grace@example.com",
        first_name="Grace",
        last_name="User",
        national_id="nid-grace",
        mobile_number="+989121111111",
        center_name="Test Center",
        hashed_password=hash_password("grace-password"),
        role=UserRole.USER,
    )
    db_session.add(other)
    await db_session.commit()
    await db_session.refresh(other)

    forbidden = await client.get(f"/admin/users/{other.id}", headers=headers)
    assert forbidden.status_code == 403

    allowed = await client.get(f"/admin/users/{user_id}", headers=headers)
    assert allowed.status_code == 200


async def test_super_admin_can_access_admin_only_endpoint(
    client: AsyncClient, db_session: AsyncSession
):
    reg = await _register(client, username="su-admin", password="correct-horse")
    token = reg.json()["access_token"]
    user_id = reg.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    user = await db_session.get(User, user_id)
    assert user is not None
    user.role = UserRole.SUPER_ADMIN
    await db_session.commit()

    other = User(
        username="phase-a-target",
        email="phase-a-target@example.com",
        first_name="Phase",
        last_name="Target",
        national_id="nid-phase-a-target",
        mobile_number="+989121231212",
        center_name="Phase A Center",
        hashed_password=hash_password("phase-a-password"),
        role=UserRole.USER,
    )
    db_session.add(other)
    await db_session.commit()
    await db_session.refresh(other)

    allowed = await client.get(f"/admin/users/{other.id}", headers=headers)
    assert allowed.status_code == 200


async def test_permissions_me_reflects_role(client: AsyncClient):
    reg = await _register(client, username="heidi", password="correct-horse")
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/auth/permissions/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["realm_roles"] == ["user"]
    assert "admin" not in body["allowed_sections"]


async def test_effective_permissions_endpoint_matches_frontend_contract(client: AsyncClient):
    reg = await _register(client, username="ivan", password="correct-horse")
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/admin/group-rbac/effective", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["base_roles"] == ["user"]
    assert body["is_admin"] is False
    assert body["is_super_admin"] is False
    assert isinstance(body["global_permissions"], list)
    assert isinstance(body["allowed_sections"], list)
    assert isinstance(body["groups"], dict)
