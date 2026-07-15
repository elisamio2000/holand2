from __future__ import annotations

from typing import Any
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, new_uuid


class ScoringModel(Base, TimestampMixin):
    __tablename__ = "scoring_models"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=new_uuid)
    assessment_version_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("assessment_versions.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    algorithm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    weight: Mapped[float] = mapped_column(Numeric(5,2), nullable=False, default=1.0)
    output_type: Mapped[str] = mapped_column(String(50), nullable=False)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


__all__ = ["ScoringModel"]
