"""Identity Service — registration, login, refresh, logout, permissions.

Endpoint contract intentionally matches the already-wired Next.js frontend
(see apps/web/apps/holand-web-app/src/app/api/auth/[...nextauth]/auth-options.ts)
so no frontend changes are required to authenticate against this API.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user
from ..models.refresh_token import RefreshToken
from ..models.user import User, UserRole
from ..schemas import (
    LoginRequest,
    LogoutRequest,
    PermissionsResponse,
    RefreshRequest,
    RegisterRequest,
    RegistrationInfoResponse,
    TokenResponse,
    UserSummary,
)
from ..services.auth_service import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])

# Sections a role is allowed to see in the frontend sidebar (Phase 1: coarse-grained).
ROLE_SECTIONS: dict[UserRole, list[str]] = {
    UserRole.USER: ["career-guidance"],
    UserRole.COUNSELOR: ["career-guidance", "counselor"],
    UserRole.ADMIN: ["career-guidance", "counselor", "admin"],
}


def _user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        roles=[user.role.value],
        is_admin=user.role == UserRole.ADMIN,
        is_super_admin=False,
    )


async def _issue_tokens(db: AsyncSession, user: User) -> TokenResponse:
    access_token, expires_in = create_access_token(subject=user.id, role=user.role.value)
    raw_refresh, refresh_hash, expires_at = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=refresh_hash, expires_at=expires_at))
    await db.flush()
    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=expires_in,
        user=_user_summary(user),
    )


@router.get("/registration-info", response_model=RegistrationInfoResponse)
async def registration_info() -> RegistrationInfoResponse:
    return RegistrationInfoResponse()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    if payload.email:
        existing_email = await db.execute(select(User).where(User.email == payload.email))
        if existing_email.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
            )

    user = User(
        username=payload.username,
        email=payload.email,
        display_name=payload.display_name or payload.username,
        hashed_password=hash_password(payload.password),
        role=UserRole.USER,
    )
    db.add(user)
    await db.flush()
    return await _issue_tokens(db, user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    return await _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    token_hash = hash_refresh_token(payload.refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()

    expires_at = stored.expires_at if stored else None
    if expires_at is not None and expires_at.tzinfo is None:
        # SQLite (used in tests) drops tzinfo on round-trip; treat as UTC.
        expires_at = expires_at.replace(tzinfo=UTC)

    if stored is None or stored.revoked or expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        )

    user = await db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")

    # Rotate: revoke the presented token, issue a brand new pair.
    stored.revoked = True
    return await _issue_tokens(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)) -> None:
    token_hash = hash_refresh_token(payload.refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    if stored is not None:
        stored.revoked = True
    return None


@router.get("/permissions/me", response_model=PermissionsResponse)
async def permissions_me(user: User = Depends(get_current_user)) -> PermissionsResponse:
    return PermissionsResponse(
        allowed_sections=ROLE_SECTIONS.get(user.role, []),
        realm_roles=[user.role.value],
    )
