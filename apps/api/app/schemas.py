from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"]
MBTI_DIMENSIONS = ["E", "I", "S", "N", "T", "F", "J", "P"]


class HealthResponse(BaseModel):
    status: str


# ── Phase 1: Auth & Users ────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)
    email: EmailStr | None = None
    display_name: str | None = Field(default=None, max_length=150)


class RegistrationInfoResponse(BaseModel):
    """Public info the frontend checks before showing the register form."""

    allow_registration: bool = True
    default_role: str = "user"


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserSummary(BaseModel):
    id: str
    username: str
    display_name: str | None = None
    email: str | None = None
    roles: list[str]
    is_admin: bool
    is_super_admin: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"
    user: UserSummary


class PermissionsResponse(BaseModel):
    allowed_sections: list[str]
    realm_roles: list[str]


class EffectivePermissionsResponse(BaseModel):
    base_roles: list[str]
    is_admin: bool
    is_super_admin: bool
    global_permissions: list[str]
    allowed_sections: list[str]
    groups: dict[str, object]


class UserResponse(BaseModel):
    id: str
    username: str
    email: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    role: str
    permissions: list[str] = []
    is_active: bool
    bio: str | None = None
    timezone: str | None = None
    language: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    display_name: str | None = Field(default=None, max_length=150)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=500)
    timezone: str | None = None
    language: str | None = None
    is_active: bool | None = None


class HollandRequest(BaseModel):
    scores: dict[str, float] = Field(
        ..., description="RIASEC scores keyed by R, I, A, S, E, C"
    )


class HollandResult(BaseModel):
    normalized_scores: dict[str, float]
    top3_code: str
    quality_score: float
    quality_band: str


class MbtiRequest(BaseModel):
    scores: dict[str, float] = Field(
        ..., description="MBTI dimension scores keyed by E, I, S, N, T, F, J, P"
    )


class MbtiResult(BaseModel):
    type_code: str
    certainty: dict[str, float]
    quality_score: float = 0.0
    quality_band: str = "medium"


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
    related_job_titles: list[str] = []
    deprioritized: bool = False
    warning_fa: str | None = None


class RecommendationResponseV2(BaseModel):
    age_band: str
    careers: list[JobRecommendation]
    majors: list[MajorRecommendation]
    confidence_score: float


# ── Phase 5: interpretation + report generation ──────────────────────────────


class SummaryCard(BaseModel):
    holland_code: str
    mbti_type: str
    age_band: str
    headline_fa: str
    top_careers_fa: list[str]
    top_majors_fa: list[str]


class LayeredInterpretation(BaseModel):
    psychometric_fa: str
    behavioral_fit_fa: str
    career_major_fa: str
    skill_growth_fa: str


class ActionPlan(BaseModel):
    short_term_3_months_fa: list[str]
    mid_term_6_months_fa: list[str]
    long_term_12_months_fa: list[str]


class ReportRequest(BaseModel):
    holland_scores: dict[str, float]
    mbti_scores: dict[str, float]
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
    risk_flags: list[str]
    confidence_score: float
    recommendations: RecommendationResponseV2


# ── Analytics (funnel instrumentation) ──────────────────────────────────────


class FunnelEventCreate(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)
    event_name: str = Field(..., min_length=1, max_length=64)
    step: str = Field(..., min_length=1, max_length=64)
    duration_ms: float | None = Field(default=None, ge=0)
    metadata_json: str | None = Field(default=None, max_length=2000)


class FunnelEventOut(BaseModel):
    id: str
    session_id: str
    event_name: str
    step: str
    duration_ms: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FunnelStepSummary(BaseModel):
    step: str
    event_count: int
    unique_sessions: int
    avg_duration_ms: float | None


class FunnelSummaryResponse(BaseModel):
    total_sessions: int
    steps: list[FunnelStepSummary]
    drop_off_rate: dict[str, float]


class ReportQualityStepSummary(BaseModel):
    step: str
    event_count: int
    unique_sessions: int
    avg_duration_ms: float | None


class ReportQualitySummaryResponse(BaseModel):
    total_sessions: int
    steps: list[ReportQualityStepSummary]


# ── Expert Lab (draft / review / publish workflow) ──────────────────────────


class ContentVersionCreate(BaseModel):
    body: str = Field(..., min_length=1)
    author: str = Field(..., min_length=1, max_length=255)


class ContentDraftCreate(BaseModel):
    kind: str = Field(..., pattern="^(question|formula)$")
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    author: str = Field(..., min_length=1, max_length=255)


class ContentVersionOut(BaseModel):
    id: str
    draft_id: str
    version_number: int
    status: str
    body: str
    author: str
    reviewer: str | None
    review_notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContentDraftOut(BaseModel):
    id: str
    kind: str
    title: str
    versions: list[ContentVersionOut]

    model_config = {"from_attributes": True}


class ReviewDecision(BaseModel):
    reviewer: str = Field(..., min_length=1, max_length=255)
    notes: str | None = Field(default=None, max_length=4000)


class RecommendationFeedbackCreate(BaseModel):
    recommendation_id: str = Field(..., min_length=1, max_length=128)
    user_id: str | None = Field(default=None, max_length=128)
    rating: int = Field(..., ge=1, le=5)
    accepted: bool = False
    comment: str | None = Field(default=None, max_length=4000)


class RecommendationFeedbackOut(BaseModel):
    id: str
    recommendation_id: str
    user_id: str | None
    rating: int
    accepted: bool
    comment: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecommendationQualityAlert(BaseModel):
    alert_triggered: bool
    alert_code: str
    severity: str
    threshold_percent: float
    min_samples: int
    total_feedback: int
    low_quality_feedback: int
    low_quality_ratio: float
    recommended_action: str


class MonitoringMetricsResponse(BaseModel):
    started_at: str
    uptime_seconds: int
    requests_total: int
    error_responses_total: int
    by_path: dict[str, int]


class MonitoringReadinessCheck(BaseModel):
    name: str
    passed: bool
    owner: str
    observed: str
    threshold: str
    message: str


class MonitoringReadinessThresholds(BaseModel):
    completion_rate_threshold_percent: float
    completion_min_sessions: int
    error_5xx_rate_threshold_percent: float
    recommendation_quality_threshold_percent: float


class MonitoringReadinessResponse(BaseModel):
    go_no_go: str
    checked_at: str
    checks: list[MonitoringReadinessCheck]
    thresholds: MonitoringReadinessThresholds
