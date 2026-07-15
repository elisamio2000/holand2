"""User model and role enum for Phase 1 (auth & RBAC)."""

import enum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, new_uuid


class UserRole(str, enum.Enum):
    """Application roles.

    Canonical v1 roles: user, analyst, admin, super_admin.
    Legacy ``counselor`` remains accepted for backward compatibility.
    """

    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    ANALYST = "analyst"
    USER = "user"
    # Legacy role kept to avoid breaking pre-existing users/tokens.
    COUNSELOR = "counselor"


def is_super_admin_role(role: UserRole) -> bool:
    return role == UserRole.SUPER_ADMIN


def has_admin_access(role: UserRole) -> bool:
    return role in {UserRole.SUPER_ADMIN, UserRole.ADMIN}


def has_counselor_access(role: UserRole) -> bool:
    return role in {
        UserRole.COUNSELOR,
        UserRole.ANALYST,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
    }


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    national_id: Mapped[str | None] = mapped_column(String(32), unique=True, index=True, nullable=True)
    mobile_number: Mapped[str | None] = mapped_column(
        String(32), unique=True, index=True, nullable=True
    )
    center_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", native_enum=False, length=20),
        default=UserRole.USER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
