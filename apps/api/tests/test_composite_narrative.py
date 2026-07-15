"""
Tests for Composite Narrative Service (E4)
"""

import pytest

from apps.api.app.services.composite_narrative import CompositeNarrativeService


@pytest.fixture
def composite_service():
    """Composite narrative service instance."""
    return CompositeNarrativeService()


@pytest.mark.asyncio
async def test_synthesize_single_assessment_fallback(composite_service):
    """Test graceful degradation when only 1 assessment provided."""
    assessment_results = {
        "holland": {
            "narrative": {"interpretation": "Strong artistic interests"},
            "scores": {"A": 85},
            "hardcards": {"interpretation": "Artistic"},
        }
    }
    
    result = await composite_service.synthesize_narratives(
        assessment_results, age_band="teen"
    )
    
    assert result["synthesis_type"] == "single"
    assert result["assessment_count"] == 1
    assert result["primary_assessment"] == "holland"


@pytest.mark.asyncio
async def test_synthesize_multi_assessments(composite_service):
    """Test synthesis with multiple assessments."""
    assessment_results = {
        "holland": {
            "narrative": {"interpretation": "Strong artistic interests"},
            "scores": {"A": 85, "R": 70, "I": 65},
            "hardcards": {"interpretation": "Artistic"},
        },
        "mbti": {
            "narrative": {"interpretation": "Intuitive creative type"},
            "scores": {"type": "ENFP"},
            "hardcards": {"interpretation": "ENFP - Campaigner"},
        },
    }
    
    result = await composite_service.synthesize_narratives(
        assessment_results, age_band="adult"
    )
    
    assert result["synthesis_type"] == "composite"
    assert result["assessment_count"] == 2
    assert "combined_view" in result
    assert "individual_views" in result
    assert "recommendations" in result
    assert "holland" in result["individual_views"]
    assert "mbti" in result["individual_views"]


def test_highest_riasec_extraction(composite_service):
    """Test RIASEC code extraction."""
    scores = {"R": 75, "I": 80, "A": 85, "S": 70, "E": 72, "C": 68}
    
    highest = composite_service._get_highest_riasec(scores)
    
    assert highest == "A"  # Highest score is 85 for Artistic


def test_highest_riasec_with_missing_scores(composite_service):
    """Test RIASEC extraction with incomplete scores."""
    scores = {"R": 75, "A": 85}  # Missing I, S, E, C
    
    highest = composite_service._get_highest_riasec(scores)
    
    assert highest == "A"  # Should still find the highest


def test_reconciliation_rules_default():
    """Test default reconciliation rules exist."""
    service = CompositeNarrativeService()
    
    assert "R" in service.reconciliation_rules
    assert "I" in service.reconciliation_rules
    assert "A" in service.reconciliation_rules
    assert "ESTJ" in service.reconciliation_rules["R"]["best_fit"]
    assert "ENFP" in service.reconciliation_rules["A"]["best_fit"]


@pytest.mark.asyncio
async def test_generate_combined_summary(composite_service):
    """Test combined summary generation."""
    assessments = {
        "holland": {
            "narrative": {},
            "scores": {},
            "hardcards": {"interpretation": "Strong artistic interests"},
        },
        "mbti": {
            "narrative": {},
            "scores": {},
            "hardcards": {"interpretation": "Creative intuitive type"},
        },
    }
    
    summary = await composite_service._generate_combined_summary(assessments, "teen")
    
    assert "multifaceted" in summary.lower() or "multiple" in summary.lower()
    assert "holland" in summary.upper()
    assert "mbti" in summary.upper()


@pytest.mark.asyncio
async def test_generate_reconciliation_aligned(composite_service):
    """Test reconciliation when profiles are aligned."""
    assessments = {
        "holland": {
            "narrative": {},
            "scores": {"A": 85, "R": 70},  # Artistic primary
            "hardcards": {},
        },
        "mbti": {
            "narrative": {},
            "scores": {"type": "ENFP"},  # Creative type
            "hardcards": {},
        },
    }
    
    reconciliation = await composite_service._generate_reconciliation_narrative(
        assessments, "adult"
    )
    
    assert reconciliation["mbti_type"] == "ENFP"
    assert reconciliation["holland_primary"] == "A"
    assert reconciliation["aligned"] is True


@pytest.mark.asyncio
async def test_generate_reconciliation_no_mbti(composite_service):
    """Test reconciliation when MBTI not provided."""
    assessments = {
        "holland": {
            "narrative": {},
            "scores": {"A": 85},
            "hardcards": {},
        },
    }
    
    reconciliation = await composite_service._generate_reconciliation_narrative(
        assessments, "teen"
    )
    
    assert "requires both" in reconciliation.get("note", "").lower() or \
           reconciliation.get("note", "") == "Reconciliation requires both Holland and MBTI assessments"


@pytest.mark.asyncio
async def test_composite_recommendations(composite_service):
    """Test composite recommendations generation."""
    assessments = {"holland": {}, "mbti": {}}
    
    recommendations = await composite_service._generate_composite_recommendations(assessments)
    
    assert len(recommendations) > 0
    assert all(isinstance(rec, str) for rec in recommendations)
    assert any("interests" in rec.lower() for rec in recommendations)


@pytest.mark.asyncio
async def test_empty_assessment_results(composite_service):
    """Test handling of empty assessment results."""
    result = await composite_service.synthesize_narratives({}, age_band="teen")
    
    assert "error" in result.get("status", "") or len(result) > 0
