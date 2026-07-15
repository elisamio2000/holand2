"""
Analysis Template Entity Module.

Stores configuration templates for analysis engines. Each template defines
rules, thresholds, narrative tone, and output structure for a specific
test type and age branch.

This is a core DB-first configuration: all hardcoded analysis logic is
replaced with configurable templates loaded from database.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import JSON, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AnalysisTemplate(Base):
    """
    Stores configurable analysis templates per test type and age branch.

    Templates define how raw scores are interpreted, categorized, and
    presented as narrative findings. All thresholds, rules, and tone
    are stored as JSON config, enabling dynamic updates without code changes.

    Attributes:
        id: Unique identifier (UUID)
        test_type: Test identifier (holland, mbti, etc.)
        age_branch: Age category (child/teen/adult/senior)
        template_config_json: JSON dict with:
            - rules: list of {field, operator (gt/lt/eq), threshold, label}
            - output_structure: mapping of result fields to types
            - character_limits: max lengths for narrative/discovery
            - tone: narrative style per age_branch (academic/conversational/guidance)
            - discovery_patterns: optional AI discovery section patterns
        version: Version number for reproducibility and rollback
        created_at: Timestamp when template was created
    """

    __tablename__ = "analysis_templates"

    __table_args__ = (
        UniqueConstraint("test_type", "age_branch", name="uq_test_type_age_branch"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    test_type: Mapped[str] = mapped_column(String(50), nullable=False)  # holland, mbti, etc
    age_branch: Mapped[str] = mapped_column(String(20), nullable=False)  # child/teen/adult/senior
    template_config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<AnalysisTemplate(id={self.id}, test_type={self.test_type}, "
            f"age_branch={self.age_branch}, version={self.version})>"
        )

    def get_rules(self) -> list[dict]:
        """Extract rules list from config JSON."""
        return self.template_config_json.get("rules", [])

    def get_character_limits(self) -> dict:
        """Extract character limits (narrative, discovery) from config."""
        return self.template_config_json.get("character_limits", {})

    def get_tone(self) -> str:
        """Get narrative tone for this age branch."""
        return self.template_config_json.get("tone", "conversational")
