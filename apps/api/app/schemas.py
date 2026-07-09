from datetime import datetime
from typing import Dict, List, Optional

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


class RecommendationRequest(BaseModel):
    holland_code: str = Field(..., min_length=3, max_length=3)
    mbti_type: str = Field(..., min_length=4, max_length=4)


class RecommendationItem(BaseModel):
    title: str
    fit_score: float
    why: str


class RecommendationResponse(BaseModel):
    careers: List[RecommendationItem]
    majors: List[RecommendationItem]


# ── Analytics (funnel instrumentation) ──────────────────────────────────────


class FunnelEventCreate(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)
    event_name: str = Field(..., min_length=1, max_length=64)
    step: str = Field(..., min_length=1, max_length=64)
    duration_ms: Optional[float] = Field(default=None, ge=0)
    metadata_json: Optional[str] = Field(default=None, max_length=2000)


class FunnelEventOut(BaseModel):
    id: str
    session_id: str
    event_name: str
    step: str
    duration_ms: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


class FunnelStepSummary(BaseModel):
    step: str
    event_count: int
    unique_sessions: int
    avg_duration_ms: Optional[float]


class FunnelSummaryResponse(BaseModel):
    total_sessions: int
    steps: List[FunnelStepSummary]
    drop_off_rate: Dict[str, float]


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
    reviewer: Optional[str]
    review_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContentDraftOut(BaseModel):
    id: str
    kind: str
    title: str
    versions: List[ContentVersionOut]

    model_config = {"from_attributes": True}


class ReviewDecision(BaseModel):
    reviewer: str = Field(..., min_length=1, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=4000)
