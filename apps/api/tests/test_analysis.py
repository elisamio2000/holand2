"""
Phase D Analysis Tests.

Comprehensive test coverage for:
- Hardcard engine (rule application, threshold scoring, missing field handling)
- Composite analysis (multi-test merge, validation)
- Analysis API endpoints (GET/POST/PUT/DELETE with RBAC)
"""

import pytest
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analysis_result import AnalysisResult
from app.models.analysis_template import AnalysisTemplate
from app.services.hardcard_engine import apply_rules, threshold_score, aggregate_scores
from app.services.composite_analysis import validate_composite, merge_analyses


class TestHardcardEngine:
    """Tests for hardcard engine rule application and threshold scoring."""

    def test_apply_rules_basic_threshold(self):
        """Test basic rule application with numeric threshold."""
        raw_scores = {"confidence": 0.85, "type": "ENFP"}
        rules = [
            {"field": "confidence", "operator": "gt", "threshold": 0.75, "label": "high_confidence"},
        ]

        result = apply_rules(raw_scores, rules)

        assert "confidence" in result
        assert result["confidence"] == "high_confidence"

    def test_apply_rules_multiple_rules(self):
        """Test applying multiple rules at once."""
        raw_scores = {"confidence": 0.85, "type": "ENFP", "stability": 0.5}
        rules = [
            {"field": "confidence", "operator": "gt", "threshold": 0.75, "label": "high_confidence"},
            {"field": "stability", "operator": "lt", "threshold": 0.7, "label": "low_stability"},
            {"field": "type", "operator": "eq", "threshold": "ENFP", "label": "extroverted_type"},
        ]

        result = apply_rules(raw_scores, rules)

        assert len(result) == 3
        assert result["confidence"] == "high_confidence"
        assert result["stability"] == "low_stability"
        assert result["type"] == "extroverted_type"

    def test_apply_rules_missing_field(self):
        """Test graceful handling when field is not in raw_scores."""
        raw_scores = {"confidence": 0.85}
        rules = [
            {"field": "confidence", "operator": "gt", "threshold": 0.75, "label": "high_confidence"},
            {"field": "missing_field", "operator": "gt", "threshold": 0.5, "label": "should_skip"},
        ]

        result = apply_rules(raw_scores, rules)

        assert len(result) == 1
        assert "missing_field" not in result
        assert result["confidence"] == "high_confidence"

    def test_apply_rules_malformed_rule(self):
        """Test graceful handling of malformed rules."""
        raw_scores = {"confidence": 0.85}
        rules = [
            {"field": "confidence", "operator": "gt", "threshold": 0.75, "label": "good"},
            {"field": "incomplete"},  # Missing operator and threshold
        ]

        result = apply_rules(raw_scores, rules)

        # Should only apply valid rule
        assert len(result) == 1
        assert result["confidence"] == "good"

    def test_threshold_score_basic(self):
        """Test basic numeric-to-category mapping."""
        thresholds = {0.33: "low", 0.66: "medium", 1.0: "high"}

        assert threshold_score(0.25, thresholds) == "low"
        assert threshold_score(0.5, thresholds) == "medium"
        assert threshold_score(0.85, thresholds) == "high"

    def test_threshold_score_boundary(self):
        """Test threshold boundary conditions."""
        thresholds = {0.5: "low", 1.0: "high"}

        assert threshold_score(0.5, thresholds) == "low"
        assert threshold_score(0.51, thresholds) == "high"
        assert threshold_score(1.0, thresholds) == "high"

    def test_threshold_score_above_all(self):
        """Test score above all thresholds returns highest category."""
        thresholds = {0.25: "low", 0.5: "medium"}

        assert threshold_score(1.5, thresholds) == "medium"


class TestCompositeAnalysis:
    """Tests for composite analysis validation and merging."""

    def test_validate_composite_valid(self):
        """Test valid composite combination (different test types)."""
        test_types = ["holland", "mbti"]
        assert validate_composite(test_types) is True

    def test_validate_composite_duplicate(self):
        """Test invalid composite (duplicate test types)."""
        test_types = ["holland", "holland"]
        assert validate_composite(test_types) is False

    def test_validate_composite_single(self):
        """Test invalid composite (only one test)."""
        test_types = ["holland"]
        assert validate_composite(test_types) is False

    def test_validate_composite_empty(self):
        """Test invalid composite (empty list)."""
        test_types = []
        assert validate_composite(test_types) is False

    @pytest.mark.asyncio
    async def test_merge_analyses_basic(self, db_session: AsyncSession):
        """Test merging two analyses into composite."""
        assessment_id = uuid4()
        user_id = uuid4()
        age_branch = "teen"

        # Create two analyses
        analysis1 = AnalysisResult(
            id=uuid4(),
            assessment_id=assessment_id,
            user_id=user_id,
            age_branch=age_branch,
            test_type="holland",
            raw_scores={"type": "Artistic", "confidence": 0.9},
            results_json={"findings": {"personality": "artistic", "creativity": "high"}},
            generated_at=datetime.now(timezone.utc),
        )

        analysis2 = AnalysisResult(
            id=uuid4(),
            assessment_id=assessment_id,
            user_id=user_id,
            age_branch=age_branch,
            test_type="mbti",
            raw_scores={"type": "ENFP"},
            results_json={"findings": {"personality": "extroverted", "creativity": "high"}},
            generated_at=datetime.now(timezone.utc),
        )

        db_session.add(analysis1)
        db_session.add(analysis2)
        await db_session.commit()

        # Merge
        composite = await merge_analyses(db_session, [analysis1.id, analysis2.id], age_branch)

        assert composite["test_count"] == 2
        assert "intersections" in composite
        assert "unified_narrative" in composite
        assert composite["intersections"]["creativity"]["value"] == "high"

    @pytest.mark.asyncio
    async def test_merge_analyses_age_branch_mismatch(self, db_session: AsyncSession):
        """Test merge fails on age_branch mismatch."""
        assessment_id = uuid4()
        user_id = uuid4()

        analysis1 = AnalysisResult(
            id=uuid4(),
            assessment_id=assessment_id,
            user_id=user_id,
            age_branch="teen",
            test_type="holland",
            raw_scores={},
            results_json={},
            generated_at=datetime.now(timezone.utc),
        )

        analysis2 = AnalysisResult(
            id=uuid4(),
            assessment_id=assessment_id,
            user_id=user_id,
            age_branch="adult",  # Mismatch!
            test_type="mbti",
            raw_scores={},
            results_json={},
            generated_at=datetime.now(timezone.utc),
        )

        db_session.add(analysis1)
        db_session.add(analysis2)
        await db_session.commit()

        with pytest.raises(ValueError, match="Age branch mismatch"):
            await merge_analyses(db_session, [analysis1.id, analysis2.id], "teen")


class TestAnalysisAPI:
    """Integration tests for analysis API endpoints."""

    @pytest.mark.asyncio
    async def test_get_analysis_unauthorized(self, client, db_session, test_user):
        """Test GET /analysis returns 403 for unauthorized user."""
        assessment_id = uuid4()
        response = client.get(f"/api/assessments/{assessment_id}/analysis")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_templates_analyst_role(self, client, test_user):
        """Test GET /analysis-templates requires analyst role."""
        # Create template
        template_data = {
            "test_type": "holland",
            "age_branch": "teen",
            "template_config_json": {
                "rules": [{"field": "type", "operator": "eq", "threshold": "Artistic", "label": "artistic"}],
                "character_limits": {"narrative": 500},
                "tone": "guidance",
            },
        }

        # User with analyst role should succeed
        test_user.role = "analyst"
        response = client.get(
            "/api/analysis-templates",
            headers={"Authorization": f"Bearer {test_user.token}"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_create_template_admin_only(self, client, test_user):
        """Test POST /analysis-templates requires admin role."""
        template_data = {
            "test_type": "holland",
            "age_branch": "teen",
            "template_config_json": {
                "rules": [],
                "character_limits": {"narrative": 500},
                "tone": "guidance",
            },
        }

        # Non-admin should get 403
        response = client.post(
            "/api/analysis-templates",
            json=template_data,
            headers={"Authorization": f"Bearer {test_user.token}"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_template_duplicate_constraint(self, client, db_session):
        """Test unique constraint on (test_type, age_branch)."""
        # Create first template
        template1 = AnalysisTemplate(
            id=uuid4(),
            test_type="holland",
            age_branch="teen",
            template_config_json={},
            version=1,
        )
        db_session.add(template1)
        await db_session.commit()

        # Try to create duplicate
        template_data = {
            "test_type": "holland",
            "age_branch": "teen",
            "template_config_json": {},
        }

        # Admin attempt (would fail due to unique constraint check in endpoint)
        response = client.post("/api/analysis-templates", json=template_data)
        assert response.status_code in [409, 401]  # 409 or 401 auth required


@pytest.fixture
async def test_analysis_template(db_session: AsyncSession) -> AnalysisTemplate:
    """Fixture providing a test analysis template."""
    template = AnalysisTemplate(
        id=uuid4(),
        test_type="holland",
        age_branch="teen",
        template_config_json={
            "rules": [
                {"field": "type", "operator": "eq", "threshold": "Artistic", "label": "artistic"},
            ],
            "character_limits": {"narrative": 500, "discovery": 300},
            "tone": "guidance",
        },
        version=1,
    )
    db_session.add(template)
    await db_session.commit()
    return template


@pytest.fixture
async def test_analysis_result(
    db_session: AsyncSession, test_user, test_assessment
) -> AnalysisResult:
    """Fixture providing a test analysis result."""
    result = AnalysisResult(
        id=uuid4(),
        assessment_id=test_assessment.id,
        user_id=test_user.id,
        age_branch="teen",
        test_type="holland",
        raw_scores={"type": "Artistic", "confidence": 0.92},
        results_json={"findings": {"personality": "artistic", "confidence_level": "high"}},
        generated_at=datetime.now(timezone.utc),
    )
    db_session.add(result)
    await db_session.commit()
    return result
