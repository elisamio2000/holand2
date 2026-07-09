"""Tests for the Phase 5 Persian interpretation engine."""

from app.schemas import JobRecommendation, MajorRecommendation, RecommendationResponseV2
from app.services.interpretation_engine import (
    build_action_plan,
    build_confidence_score,
    build_interpretation,
    build_risk_flags,
    build_summary_card,
)


def _sample_recommendations(deprioritized: bool = False) -> RecommendationResponseV2:
    return RecommendationResponseV2(
        age_band="18-24",
        careers=[
            JobRecommendation(
                title="Data Scientist",
                title_fa="دانشمند داده",
                fit_score=88.0,
                confidence=80.0,
                why_fa="تحلیل داده و حل مسئله",
                taxonomy_source="ONET",
                taxonomy_code="15-2051.01",
                education_level="master",
                market_demand_score=90.0,
                future_outlook="growth",
                salary_band="بالا",
                deprioritized=deprioritized,
                warning_fa="هشدار" if deprioritized else None,
            )
        ],
        majors=[
            MajorRecommendation(
                title="Data Science",
                title_fa="علم داده",
                fit_score=85.0,
                confidence=78.0,
                why_fa="ترکیب آمار و برنامه نویسی",
                degree_level="bachelor",
                market_demand_score=89.0,
                future_outlook="growth",
                related_job_titles=["Data Scientist"],
                deprioritized=False,
                warning_fa=None,
            )
        ],
        confidence_score=80.0,
    )


class TestInterpretationEngine:
    def test_interpretation_is_persian_and_layered(self):
        recos = _sample_recommendations()
        interp = build_interpretation(
            "IRC",
            {"I": 40.0, "R": 30.0, "C": 20.0, "A": 5.0, "S": 3.0, "E": 2.0},
            "INTJ",
            {"EI": 70.0, "SN": 65.0, "TF": 60.0, "JP": 55.0},
            "18-24",
            recos,
        )
        assert "IRC" in interp.psychometric_fa
        assert "INTJ" in interp.psychometric_fa
        assert interp.behavioral_fit_fa
        assert "دانشمند داده" in interp.career_major_fa
        assert interp.skill_growth_fa

    def test_summary_card_lists_top_items(self):
        recos = _sample_recommendations()
        card = build_summary_card("IRC", "INTJ", "18-24", recos)
        assert card.top_careers_fa == ["دانشمند داده"]
        assert card.top_majors_fa == ["علم داده"]

    def test_action_plan_has_three_horizons(self):
        recos = _sample_recommendations()
        plan = build_action_plan(recos, "18-24")
        assert plan.short_term_3_months_fa
        assert plan.mid_term_6_months_fa
        assert plan.long_term_12_months_fa

    def test_action_plan_adapts_for_teens(self):
        recos = _sample_recommendations()
        plan = build_action_plan(recos, "13-17")
        assert any("رشته" in item for item in plan.short_term_3_months_fa)

    def test_risk_flags_always_include_non_deterministic_disclaimer(self):
        recos = _sample_recommendations()
        flags = build_risk_flags(70.0, {"EI": 70.0, "SN": 65.0, "TF": 60.0, "JP": 55.0}, "18-24", recos)
        assert any("تشخیص قطعی" in f for f in flags)

    def test_risk_flags_warn_on_low_certainty(self):
        recos = _sample_recommendations()
        flags = build_risk_flags(40.0, {"EI": 50.0, "SN": 50.0, "TF": 50.0, "JP": 50.0}, "18-24", recos)
        assert len(flags) > 1

    def test_risk_flags_warn_on_deprioritized_items(self):
        recos = _sample_recommendations(deprioritized=True)
        flags = build_risk_flags(70.0, {"EI": 70.0, "SN": 65.0, "TF": 60.0, "JP": 55.0}, "18-24", recos)
        assert any("کاهش تقاضای بازار" in f for f in flags)

    def test_confidence_score_within_bounds(self):
        score = build_confidence_score(80.0, {"EI": 70.0, "SN": 65.0, "TF": 60.0, "JP": 55.0}, 75.0)
        assert 20.0 <= score <= 99.0
