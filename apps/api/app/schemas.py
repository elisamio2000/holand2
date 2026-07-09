from typing import Dict, List

from pydantic import BaseModel, Field


RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"]
MBTI_DIMENSIONS = ["E", "I", "S", "N", "T", "F", "J", "P"]


class HealthResponse(BaseModel):
    status: str


class HollandRequest(BaseModel):
    scores: Dict[str, float] = Field(
        ..., description="RIASEC scores keyed by R, I, A, S, E, C"
    )


class HollandResult(BaseModel):
    normalized_scores: Dict[str, float]
    top3_code: str


class MbtiRequest(BaseModel):
    scores: Dict[str, float] = Field(
        ..., description="MBTI dimension scores keyed by E, I, S, N, T, F, J, P"
    )


class MbtiResult(BaseModel):
    type_code: str
    certainty: Dict[str, float]


# ── Phase 4: age-aware recommendation engine ─────────────────────────────────

AGE_BANDS = ["13-17", "18-24", "25-30", "30+"]


def age_to_band(age: int) -> str:
    if age <= 17:
        return "13-17"
    if age <= 24:
        return "18-24"
    if age <= 30:
        return "25-30"
    return "30+"


class RecommendationRequestV2(BaseModel):
    holland_code: str = Field(..., min_length=3, max_length=3)
    mbti_type: str = Field(..., min_length=4, max_length=4)
    age: int = Field(..., ge=10, le=100, description="Age used to derive the age band")
    limit: int = Field(8, ge=1, le=20)


class JobRecommendation(BaseModel):
    title: str
    title_fa: str
    fit_score: float
    confidence: float
    why_fa: str
    taxonomy_source: str
    taxonomy_code: str
    education_level: str
    market_demand_score: float
    future_outlook: str
    salary_band: str | None = None
    deprioritized: bool = False
    warning_fa: str | None = None


class MajorRecommendation(BaseModel):
    title: str
    title_fa: str
    fit_score: float
    confidence: float
    why_fa: str
    degree_level: str
    market_demand_score: float
    future_outlook: str
    related_job_titles: List[str] = []
    deprioritized: bool = False
    warning_fa: str | None = None


class RecommendationResponseV2(BaseModel):
    age_band: str
    careers: List[JobRecommendation]
    majors: List[MajorRecommendation]
    confidence_score: float


# ── Phase 5: interpretation + report generation ──────────────────────────────


class SummaryCard(BaseModel):
    holland_code: str
    mbti_type: str
    age_band: str
    headline_fa: str
    top_careers_fa: List[str]
    top_majors_fa: List[str]


class LayeredInterpretation(BaseModel):
    psychometric_fa: str
    behavioral_fit_fa: str
    career_major_fa: str
    skill_growth_fa: str


class ActionPlan(BaseModel):
    short_term_3_months_fa: List[str]
    mid_term_6_months_fa: List[str]
    long_term_12_months_fa: List[str]


class ReportRequest(BaseModel):
    holland_scores: Dict[str, float]
    mbti_scores: Dict[str, float]
    age: int = Field(..., ge=10, le=100)
    session_id: str | None = None


class ReportResponse(BaseModel):
    id: str | None = None
    holland_code: str
    mbti_type: str
    age_band: str
    summary_card: SummaryCard
    detailed_interpretation: LayeredInterpretation
    action_plan: ActionPlan
    risk_flags: List[str]
    confidence_score: float
    recommendations: RecommendationResponseV2
