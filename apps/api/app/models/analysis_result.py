"""
Analysis Result Entity Module.

Stores the results of psychological assessments after scoring and analysis.
Captures assessment ID, participant age branch, test type, raw scores from
scoring models, and generated analysis results with findings.

This entity is central to Phase D (Composite Analysis) and Phase E (AI Narratives).
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AnalysisResult(Base):
    """
    Stores psychological assessment analysis results.

    Attributes:
        id: Unique identifier (UUID)
        assessment_session_id: Foreign key to AssessmentSession
        user_id: Foreign key to User (for authorization)
        age_branch: Age category (child/teen/adult/senior) for analysis routing
        test_type: Test identifier (holland, mbti, composite)
        raw_scores: JSON dict of scoring model outputs (e.g., {"type": "ENFP", "confidence": 0.92})
        results_json: JSON dict with structured analysis findings
        generated_at: Timestamp when analysis was generated
        created_at: Timestamp when record was created in DB
        assessment: Relationship to AssessmentSession
        user: Relationship to User
    """

    __tablename__ = "analysis_results"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    assessment_session_id: Mapped[UUID] = mapped_column(ForeignKey("assessment_sessions.id"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    age_branch: Mapped[str] = mapped_column(String(20), nullable=False)  # child/teen/adult/senior
    test_type: Mapped[str] = mapped_column(String(50), nullable=False)  # holland, mbti, composite
    raw_scores: Mapped[dict] = mapped_column(JSON, nullable=False)  # Scores from scoring model
    results_json: Mapped[dict] = mapped_column(JSON, nullable=False)  # Narrative + findings
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )

    # Relationships
    assessment: Mapped["AssessmentSession"] = relationship("AssessmentSession", back_populates="analysis_results")
    user: Mapped["User"] = relationship("User", back_populates="analysis_results")

    def __repr__(self) -> str:
        return (
            f"<AnalysisResult(id={self.id}, assessment_session_id={self.assessment_session_id}, "
            f"test_type={self.test_type}, age_branch={self.age_branch})>"
        )
