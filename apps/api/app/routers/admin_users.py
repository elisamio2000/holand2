"""Admin user management — bridges the existing frontend `admin.service.ts`
(`GET/PATCH /admin/users/{id}`) to this API's RBAC model.

Phase 1 scope: only self-service and admin-only access are supported.
Broader admin listing/group management is out of scope for this phase.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user
from ..models.user import User, has_admin_access
from ..schemas import UserResponse, UserUpdate

router = APIRouter(prefix="/admin/users", tags=["Admin"])


def _ensure_self_or_admin(target_id: str, user: User) -> None:
    if user.id != target_id and not has_admin_access(user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view or edit other users",
        )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    _ensure_self_or_admin(user_id, current_user)
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return target


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    _ensure_self_or_admin(user_id, current_user)
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    if "is_active" in data and not has_admin_access(current_user.role):
        # Non-admins can't change their own active status.
        data.pop("is_active")

    for field, value in data.items():
        setattr(target, field, value)
    await db.flush()
    await db.refresh(target)
    return target
