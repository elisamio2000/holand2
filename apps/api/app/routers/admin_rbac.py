"""Minimal RBAC endpoint used by NextAuth frontend integration."""

from fastapi import APIRouter, Depends

from ..deps import get_current_user
from ..models.user import User
from ..routers.auth import ROLE_SECTIONS
from ..schemas import EffectivePermissionsResponse

router = APIRouter(prefix="/admin/group-rbac", tags=["Admin RBAC"])


@router.get("/effective", response_model=EffectivePermissionsResponse)
async def effective_permissions(
    user: User = Depends(get_current_user),
) -> EffectivePermissionsResponse:
    role = user.role.value
    return EffectivePermissionsResponse(
        base_roles=[role],
        is_admin=role == "admin",
        is_super_admin=False,
        global_permissions=[],
        allowed_sections=ROLE_SECTIONS.get(user.role, []),
        groups={},
    )
