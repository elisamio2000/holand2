"""Job and Major models — standardized career/study taxonomy backbone.

Field design follows docs/job-taxonomy-modernization-and-ethics-fa.md:
jobs are anchored to a standard taxonomy (ISCO/ESCO/O*NET) so recommendations
stay current and defensible, with an explicit deprecation mechanism instead
of silently suggesting outdated occupations.
"""

import enum

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, new_uuid


class TaxonomySource(str, enum.Enum):
    ISCO = "ISCO"
    ESCO = "ESCO"
    ONET = "ONET"


class FutureOutlook(str, enum.Enum):
    GROWTH = "growth"
    STABLE = "stable"
    DECLINING = "declining"


class AgeBand(str, enum.Enum):
    """Age segmentation used across recommendation and interpretation engines.

    Matches docs/esanj-benchmark-and-interpretation-requirements-fa.md section 6:
    quality of suggestions must be differentiated by age (13-17, 18-24, 25-30, 30+).
    """

    TEEN = "13-17"
    YOUNG_ADULT = "18-24"
    EARLY_CAREER = "25-30"
    ADULT = "30+"


ALL_AGE_BANDS = [AgeBand.TEEN, AgeBand.YOUNG_ADULT, AgeBand.EARLY_CAREER, AgeBand.ADULT]


class DegreeLevel(str, enum.Enum):
    HIGH_SCHOOL_TRACK = "high_school_track"
    VOCATIONAL = "vocational"
    ASSOCIATE = "associate"
    BACHELOR = "bachelor"
    MASTER = "master"
    DOCTORATE = "doctorate"


class Job(Base, TimestampMixin):
    """A standardized occupation entry, used as the recommendation backbone."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)

    canonical_title: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    canonical_title_fa: Mapped[str] = mapped_column(String(200), nullable=False)
    alt_titles: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    taxonomy_source: Mapped[TaxonomySource] = mapped_column(
        Enum(TaxonomySource, native_enum=False, length=20), nullable=False
    )
    taxonomy_code: Mapped[str] = mapped_column(String(50), nullable=False)

    # 2-3 letter RIASEC code, most-fit letter first (e.g. "IRE").
    riasec_profile: Mapped[str] = mapped_column(String(6), nullable=False)

    required_skills: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    education_level: Mapped[DegreeLevel] = mapped_column(
        Enum(DegreeLevel, native_enum=False, length=30), nullable=False
    )

    market_demand_score: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    salary_band: Mapped[str | None] = mapped_column(String(50), nullable=True)
    future_outlook: Mapped[FutureOutlook] = mapped_column(
        Enum(FutureOutlook, native_enum=False, length=20),
        nullable=False,
        default=FutureOutlook.STABLE,
    )

    last_verified_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=True)
    local_relevance_score: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)

    # Deprecation mechanism (docs section 4): deprecated jobs are hidden entirely;
    # deprioritized jobs are shown last with an opportunity-shortage warning.
    deprecation_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deprioritized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Which age bands this occupation is reasonable to surface for.
    suitable_age_bands: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    why_fa: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Job {self.canonical_title} ({self.riasec_profile})>"


class Major(Base, TimestampMixin):
    """A standardized field-of-study entry (school track or university major)."""

    __tablename__ = "majors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)

    canonical_title: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    canonical_title_fa: Mapped[str] = mapped_column(String(200), nullable=False)
    alt_titles: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    degree_level: Mapped[DegreeLevel] = mapped_column(
        Enum(DegreeLevel, native_enum=False, length=30), nullable=False
    )

    riasec_profile: Mapped[str] = mapped_column(String(6), nullable=False)

    related_job_titles: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    core_skills: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    market_demand_score: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    future_outlook: Mapped[FutureOutlook] = mapped_column(
        Enum(FutureOutlook, native_enum=False, length=20),
        nullable=False,
        default=FutureOutlook.STABLE,
    )

    last_verified_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=True)
    local_relevance_score: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)

    deprecation_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deprioritized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    suitable_age_bands: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    why_fa: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Major {self.canonical_title} ({self.riasec_profile})>"
