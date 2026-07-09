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
