"""Tests for the scoring algorithms."""

import pytest


class TestHollandScoring:
    def test_valid_scores(self):
        from app.scoring import score_holland

        scores = {"R": 10, "I": 20, "A": 15, "S": 25, "E": 5, "C": 10}
        normalized, top3, quality_score, quality_band = score_holland(scores)

        assert set(normalized.keys()) == {"R", "I", "A", "S", "E", "C"}
        assert abs(sum(normalized.values()) - 100.0) < 0.1
        assert len(top3) == 3
        assert top3[0] == "S"  # highest raw score
        assert 0.0 <= quality_score <= 100.0
        assert quality_band in {"low", "medium", "high"}

    def test_missing_dimension(self):
        from app.scoring import score_holland

        with pytest.raises(ValueError, match="Missing RIASEC"):
            score_holland({"R": 10, "I": 20})

    def test_all_zeros(self):
        from app.scoring import score_holland

        scores = {"R": 0, "I": 0, "A": 0, "S": 0, "E": 0, "C": 0}
        normalized, top3, quality_score, quality_band = score_holland(scores)
        assert all(v == 0.0 for v in normalized.values())
        assert quality_score == 0.0
        assert quality_band == "low"


class TestMbtiScoring:
    def test_valid_scores(self):
        from app.scoring import score_mbti

        scores = {"E": 80, "I": 20, "S": 60, "N": 40, "T": 30, "F": 70, "J": 55, "P": 45}
        type_code, certainty, quality_score, quality_band = score_mbti(scores)

        assert type_code == "ESFJ"
        assert set(certainty.keys()) == {"EI", "SN", "TF", "JP"}
        assert all(50.0 <= v <= 100.0 for v in certainty.values())
        assert 0.0 <= quality_score <= 100.0
        assert quality_band in {"low", "medium", "high"}

    def test_missing_dimension(self):
        from app.scoring import score_mbti

        with pytest.raises(ValueError, match="Missing MBTI"):
            score_mbti({"E": 10, "I": 20})

    def test_equal_scores_default_to_left(self):
        from app.scoring import score_mbti

        scores = {"E": 50, "I": 50, "S": 50, "N": 50, "T": 50, "F": 50, "J": 50, "P": 50}
        type_code, certainty, quality_score, quality_band = score_mbti(scores)
        assert type_code == "ESTJ"
        assert all(v == 50.0 for v in certainty.values())
        assert quality_score == 60.0
        assert quality_band == "medium"


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestAssessmentEndpoints:
    @pytest.mark.asyncio
    async def test_holland_endpoint_returns_quality_scoring(self, client):
        response = await client.post(
            "/assessments/holland/score",
            json={"scores": {"R": 10, "I": 20, "A": 15, "S": 25, "E": 5, "C": 10}},
        )
        assert response.status_code == 200
        body = response.json()
        assert "quality_score" in body
        assert "quality_band" in body
        assert body["quality_band"] in {"low", "medium", "high"}

    @pytest.mark.asyncio
    async def test_mbti_endpoint_returns_quality_scoring(self, client):
        response = await client.post(
            "/assessments/mbti/score",
            json={"scores": {"E": 80, "I": 20, "S": 60, "N": 40, "T": 30, "F": 70, "J": 55, "P": 45}},
        )
        assert response.status_code == 200
        body = response.json()
        assert "quality_score" in body
        assert "quality_band" in body
        assert body["quality_band"] in {"low", "medium", "high"}
