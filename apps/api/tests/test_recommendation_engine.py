"""Tests for the Phase 4 age-aware recommendation engine."""

import pytest


class TestRecommendationEngineUnit:
    def test_riasec_fit_perfect_match_scores_highest(self):
        from app.services.recommendation_engine import _riasec_fit_score

        perfect = _riasec_fit_score("IRC", "IRC")
        partial = _riasec_fit_score("SEC", "IRC")
        assert perfect >= 90.0
        assert partial < perfect

    def test_riasec_fit_no_overlap_is_zero(self):
        from app.services.recommendation_engine import _riasec_fit_score

        assert _riasec_fit_score("SEC", "IRC") >= 0.0
        assert _riasec_fit_score("XYZ", "IRC") == 0.0

    def test_mbti_alignment_bounds(self):
        from app.services.recommendation_engine import _mbti_alignment_score

        score = _mbti_alignment_score("IRC", "INTJ")
        assert 0.0 <= score <= 100.0

    def test_deprioritized_jobs_ranked_last(self):
        from app.models.job import Job
        from app.services.recommendation_engine import _rank_jobs

        good = Job(
            canonical_title="Good Job",
            canonical_title_fa="شغل خوب",
            riasec_profile="IRC",
            taxonomy_source="ONET",
            taxonomy_code="X",
            required_skills=["a"],
            education_level="bachelor",
            market_demand_score=90,
            local_relevance_score=90,
            deprecation_flag=False,
            deprioritized=False,
            suitable_age_bands=[],
        )
        stale = Job(
            canonical_title="Stale Job",
            canonical_title_fa="شغل کم تقاضا",
            riasec_profile="IRC",
            taxonomy_source="ONET",
            taxonomy_code="Y",
            required_skills=["a"],
            education_level="bachelor",
            market_demand_score=95,
            local_relevance_score=95,
            deprecation_flag=False,
            deprioritized=True,
            suitable_age_bands=[],
        )
        ranked = _rank_jobs([stale, good], "IRC", "INTJ")
        assert ranked[0].job.canonical_title == "Good Job"
        assert ranked[-1].job.canonical_title == "Stale Job"


@pytest.mark.asyncio
class TestRecommendationEngineIntegration:
    async def test_build_recommendations_v2_excludes_deprecated(self, db_session):
        from app.services.recommendation_engine import build_recommendations_v2

        result = await build_recommendations_v2(
            db_session, holland_code="IRC", mbti_type="INTJ", age=22, limit=10
        )
        titles = [c.title for c in result.careers]
        assert "Data Entry Clerk" not in titles  # deprecated in the seed dataset
        assert result.age_band == "18-24"

    async def test_age_bands_shift_job_major_mix(self, db_session):
        from app.services.recommendation_engine import build_recommendations_v2

        teen = await build_recommendations_v2(
            db_session, holland_code="SIA", mbti_type="ISFJ", age=15, limit=10
        )
        adult = await build_recommendations_v2(
            db_session, holland_code="SIA", mbti_type="ISFJ", age=35, limit=10
        )
        assert teen.age_band == "13-17"
        assert adult.age_band == "30+"
        # Teens should get relatively more majors than adults, per age-band weighting.
        teen_ratio = len(teen.majors) / max(len(teen.careers), 1)
        adult_ratio = len(adult.majors) / max(len(adult.careers), 1)
        assert teen_ratio >= adult_ratio

    async def test_deprioritized_items_carry_warning(self, db_session):
        from app.services.recommendation_engine import build_recommendations_v2

        result = await build_recommendations_v2(
            db_session, holland_code="IRE", mbti_type="ISTJ", age=28, limit=20
        )
        deprioritized_items = [c for c in result.careers if c.deprioritized]
        for item in deprioritized_items:
            assert item.warning_fa
