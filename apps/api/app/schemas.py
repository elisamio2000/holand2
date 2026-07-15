from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"]
MBTI_DIMENSIONS = ["E", "I", "S", "N", "T", "F", "J", "P"]


class HealthResponse(BaseModel):
    status: str


# ── Phase 1: Auth & Users ────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    national_id: str = Field(..., min_length=5, max_length=32)
    mobile_number: str = Field(..., min_length=7, max_length=32)
    center_name: str = Field(..., min_length=1, max_length=150)
    display_name: str | None = Field(default=None, max_length=150)


class IdentityValidationConfig(BaseModel):
    full_name_enabled: bool = False
    national_id_enabled: bool = False
    mobile_number_enabled: bool = False
    provider_base_url: str | None = None
    provider_timeout_seconds: int = 5


class RegistrationInfoResponse(BaseModel):
    """Public info the frontend checks before showing the register form."""

    allow_registration: bool = True
    can_self_register: bool = True
    policy: str = "open"
    terms_version: str = "v1"
    require_terms: bool = False
    default_role: str = "user"
    post_approval_role_hint: str = "analyst"
    can_login_after_register: bool = True
    requires_admin_activation: bool = False
    required_fields: list[str] = [
        "first_name",
        "last_name",
        "national_id",
        "mobile_number",
        "center_name",
    ]
    identity_validation: IdentityValidationConfig = IdentityValidationConfig()


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
    first_name: str | None = None
    last_name: str | None = None
    national_id: str | None = None
    mobile_number: str | None = None
    center_name: str | None = None
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
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    national_id: str | None = Field(default=None, max_length=32)
    mobile_number: str | None = Field(default=None, max_length=32)
    center_name: str | None = Field(default=None, max_length=150)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=500)
    timezone: str | None = None
    language: str | None = None
    is_active: bool | None = None


class AvatarUploadResponse(BaseModel):
    avatar_url: str


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
    quality_note_fa: str | None = None


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
    quality_note_fa: str | None = None


class RecommendationQualitySignal(BaseModel):
    low_quality_detected: bool
    lookback_days: int
    sample_size: int
    unhelpful_ratio: float
    heuristic_applied: bool
    heuristic_note_fa: str | None = None


class RecommendationResponseV2(BaseModel):
    age_band: str
    careers: list[JobRecommendation]
    majors: list[MajorRecommendation]
    confidence_score: float
    quality_signal: RecommendationQualitySignal | None = None


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


class ReportExportResponse(BaseModel):
    report_id: str
    format: str
    content_type: str
    filename: str


class ReportHistoryItem(BaseModel):
    report_id: str
    session_id: str | None = None
    holland_code: str
    mbti_type: str
    age_band: str
    confidence_score: float
    created_at: datetime
    top_careers_fa: list[str]
    top_majors_fa: list[str]
    compare_to_report_id: str | None = None
    student_id: str | None = None
    student_name: str | None = None


class CounselorStudentSummary(BaseModel):
    session_id: str
    student_id: str
    student_name: str
    age_band: str
    test_type: str = "combined"
    status: str
    progress_percent: int
    top_code: str | None = None
    updated_at: datetime
    latest_report_id: str | None = None
    latest_confidence_score: float | None = None
    confidence_delta: float | None = None
    compare_report_id: str | None = None


class CounselorDashboardStats(BaseModel):
    total_students: int
    completed_assessments: int
    in_progress_assessments: int
    average_completion_percent: int
    dimension_averages: list[dict[str, float | str]]


class CounselorDashboardResponse(BaseModel):
    stats: CounselorDashboardStats
    students: list[CounselorStudentSummary]


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


RECOMMENDATION_FEEDBACK_REASON_CODES = [
    "low_relevance_to_profile",
    "explanation_unclear",
    "age_band_mismatch",
    "market_signal_mismatch",
    "duplicate_or_redundant",
    "missing_actionability",
    "other",
]
RecommendationFeedbackReasonCode = Literal[
    "low_relevance_to_profile",
    "explanation_unclear",
    "age_band_mismatch",
    "market_signal_mismatch",
    "duplicate_or_redundant",
    "missing_actionability",
    "other",
]


class RecommendationFeedbackCreate(BaseModel):
    recommendation_id: str | None = Field(default=None, min_length=1, max_length=128)
    report_id: str | None = Field(default=None, min_length=1, max_length=36)
    session_id: str | None = Field(default=None, min_length=1, max_length=64)
    user_id: str | None = Field(default=None, max_length=128)
    helpful: bool | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    accepted: bool | None = None
    reason_code: RecommendationFeedbackReasonCode | None = None
    reason_detail: str | None = Field(default=None, max_length=1000)
    comment: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def _validate_quality_feedback(self):
        if not any([self.recommendation_id, self.report_id, self.session_id]):
            raise ValueError("At least one of recommendation_id/report_id/session_id is required.")
        if self.helpful is None and self.rating is None and self.accepted is None:
            raise ValueError("At least one of helpful/rating/accepted must be provided.")
        if self.helpful is True and self.reason_code is not None:
            raise ValueError("reason_code is only accepted for unhelpful feedback.")
        if self.reason_code == "other" and not self.reason_detail:
            raise ValueError("reason_detail is required when reason_code is 'other'.")
        return self


class RecommendationFeedbackOut(BaseModel):
    id: str
    recommendation_id: str | None
    report_id: str | None
    session_id: str | None
    user_id: str | None
    helpful: bool
    rating: int
    accepted: bool
    reason_code: RecommendationFeedbackReasonCode | None
    reason_detail: str | None
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
    helpful_feedback: int
    unhelpful_feedback: int
    low_quality_feedback: int
    low_quality_ratio: float
    recommended_action: str


class RecommendationQualityTrendPoint(BaseModel):
    day: str
    feedback_count: int
    helpful_feedback: int
    unhelpful_feedback: int
    helpful_ratio: float
    unhelpful_ratio: float
    avg_rating: float | None


class RecommendationFeedbackReasonStat(BaseModel):
    reason_code: RecommendationFeedbackReasonCode
    count: int


class RecommendationQualityTrendsResponse(BaseModel):
    window_days: int
    total_feedback: int
    helpful_feedback: int
    unhelpful_feedback: int
    unhelpful_ratio: float
    trend_points: list[RecommendationQualityTrendPoint]
    top_unhelpful_reasons: list[RecommendationFeedbackReasonStat]


class RecommendationQualityDriftResponse(BaseModel):
    window_days: int
    current_total_feedback: int
    previous_total_feedback: int
    current_unhelpful_ratio: float
    previous_unhelpful_ratio: float
    unhelpful_ratio_delta: float
    current_avg_rating: float | None
    previous_avg_rating: float | None
    avg_rating_delta: float | None
    drift_status: str
    recommended_action: str


class MonitoringMetricsResponse(BaseModel):
    started_at: str
    uptime_seconds: int
    requests_total: int
    error_responses_total: int
    by_path: dict[str, int]
    quality_loop_kpis: dict[str, object]


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
