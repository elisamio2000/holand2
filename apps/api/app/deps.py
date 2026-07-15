"""FastAPI dependencies for authentication and RBAC (Phase 1)."""

from collections.abc import Sequence

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models.user import User, UserRole
from .services.auth_service import JWTError, decode_access_token

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the `Authorization: Bearer <token>` header."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    return user


async def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    return user


def require_roles(*roles: Sequence[UserRole] | UserRole):
    """Dependency factory: restrict an endpoint to one or more roles.

    Usage: `Depends(require_roles(UserRole.ADMIN))`
    """
    allowed = {r for r in roles}

    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this action",
            )
        return user

    return _checker


require_admin = require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
require_counselor_or_admin = require_roles(
    UserRole.COUNSELOR,
    UserRole.ANALYST,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
)
