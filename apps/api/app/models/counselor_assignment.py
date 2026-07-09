"""Counselor-to-student assignment model for dashboard case scoping."""

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, new_uuid


class CounselorAssignment(Base, TimestampMixin):
    __tablename__ = "counselor_assignments"
    __table_args__ = (
        UniqueConstraint(
            "counselor_user_id",
            "student_user_id",
            name="uq_counselor_student_assignment",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    counselor_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    student_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

