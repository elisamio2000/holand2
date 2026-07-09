from fastapi import FastAPI, HTTPException

from .recommendations import build_recommendations
from .scoring import score_holland, score_mbti
from .schemas import (
    HealthResponse,
    HollandRequest,
    HollandResult,
    MbtiRequest,
    MbtiResult,
    RecommendationRequest,
    RecommendationResponse,
)

app = FastAPI(
    title="Holand Guidance API",
    version="0.1.0",
    description="MVP API for Holland and MBTI scoring with guidance recommendations.",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/assessments/holland/score", response_model=HollandResult)
def holland_score(payload: HollandRequest) -> HollandResult:
    try:
        normalized_scores, top3_code = score_holland(payload.scores)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return HollandResult(normalized_scores=normalized_scores, top3_code=top3_code)


@app.post("/assessments/mbti/score", response_model=MbtiResult)
def mbti_score(payload: MbtiRequest) -> MbtiResult:
    try:
        type_code, certainty = score_mbti(payload.scores)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return MbtiResult(type_code=type_code, certainty=certainty)


@app.post("/recommendations", response_model=RecommendationResponse)
def recommendations(payload: RecommendationRequest) -> RecommendationResponse:
    careers, majors = build_recommendations(payload.holland_code, payload.mbti_type)
    return RecommendationResponse(careers=careers, majors=majors)
