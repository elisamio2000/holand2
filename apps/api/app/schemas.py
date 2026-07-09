from datetime import datetime

from pydantic import BaseModel, Field

RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"]
MBTI_DIMENSIONS = ["E", "I", "S", "N", "T", "F", "J", "P"]


class HealthResponse(BaseModel):
    status: str


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
    quality_score: float
    quality_band: str


class RecommendationRequest(BaseModel):
    holland_code: str = Field(..., min_length=3, max_length=3)
    mbti_type: str = Field(..., min_length=4, max_length=4)


class RecommendationItem(BaseModel):
    title: str
    fit_score: float
    why: str


class RecommendationResponse(BaseModel):
    careers: list[RecommendationItem]
    majors: list[RecommendationItem]


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
    threshold_percent: float
    min_samples: int
    total_feedback: int
    low_quality_feedback: int
    low_quality_ratio: float


class MonitoringMetricsResponse(BaseModel):
    started_at: str
    uptime_seconds: int
    requests_total: int
    error_responses_total: int
    by_path: dict[str, int]
