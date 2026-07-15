"""
Tests for Narrative Generation Service (E3)
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from apps.api.app.services.narrative_service import NarrativeService
from apps.api.app.services.ai_provider import AIProviderRegistry, GenerationResponse
from apps.api.app.schemas.ai_config import AgeBand
from apps.api.app.services.token_tracker import TokenTracker


@pytest.fixture
def ai_registry():
    """Mock AI provider registry."""
    registry = AsyncMock(spec=AIProviderRegistry)
    return registry


@pytest.fixture
def token_tracker():
    """Token tracker instance."""
    return TokenTracker()


@pytest.fixture
def narrative_service(ai_registry, token_tracker):
    """Narrative service instance."""
    return NarrativeService(ai_registry, token_tracker)


@pytest.mark.asyncio
async def test_build_user_prompt(narrative_service):
    """Test user prompt construction."""
    hardcards = {
        "scores_table": {"R": 80, "I": 75, "A": 85},
        "interpretation": "Strong artistic interests",
    }
    scores = {"R": 80, "I": 75, "A": 85}
    
    prompt = narrative_service._build_user_prompt(
        assessment_type="holland",
        age_band=AgeBand.TEEN,
        hardcards=hardcards,
        scores=scores,
    )
    
    assert "holland" in prompt.lower()
    assert "teen" in prompt.lower()
    assert "interpretation" in prompt
    assert "strengths" in prompt
    assert "development_areas" in prompt


def test_parse_narrative_response_json(narrative_service):
    """Test parsing JSON response."""
    response_json = json.dumps({
        "interpretation": "You have strong analytical skills.",
        "strengths": "Problem-solving, critical thinking.",
        "development_areas": "Public speaking.",
        "recommended_paths": "Tech, research, engineering.",
        "faq": "Q: What's next? A: Explore internships.",
    })
    
    narrative = narrative_service._parse_narrative_response(response_json)
    
    assert narrative["interpretation"] == "You have strong analytical skills."
    assert "strengths" in narrative
    assert "faq" in narrative


def test_parse_narrative_response_fallback(narrative_service):
    """Test parsing non-JSON response with section extraction."""
    response_text = """
Interpretation: This assessment shows strong analytical tendencies.

Strengths: You excel at problem-solving.

Development Areas: Consider improving your communication skills.

Recommended Paths: Consider careers in engineering.

FAQ: Q: Am I limited? A: No, these are just indicators.
"""
    
    narrative = narrative_service._parse_narrative_response(response_text)
    
    assert "interpretation" in narrative
    assert "strengths" in narrative
    assert all(key in narrative for key in ["interpretation", "strengths", "development_areas", "recommended_paths", "faq"])


@pytest.mark.asyncio
async def test_generate_narrative_success(narrative_service, ai_registry):
    """Test successful narrative generation."""
    # Mock provider response
    mock_provider = AsyncMock()
    mock_provider.name = "ollama"
    mock_provider.model = "mistral:7b"
    
    gen_response = GenerationResponse(
        text=json.dumps({
            "interpretation": "Strong interests in creative fields.",
            "strengths": "Artistic ability, visual thinking.",
            "development_areas": "Technical skills.",
            "recommended_paths": "Design, UX/UI, illustration.",
            "faq": "Q: Can I combine? A: Yes, many roles blend interests.",
        }),
        tokens_in=150,
        tokens_out=200,
        model="mistral:7b",
        provider="ollama",
    )
    
    mock_provider.generate = AsyncMock(return_value=gen_response)
    ai_registry.default.return_value = mock_provider
    
    # Call generate_narrative
    result = await narrative_service.generate_narrative(
        assessment_type="holland",
        age_band=AgeBand.TEEN,
        hardcards={"scores_table": {"A": 85}},
        scores={"A": 85},
        session_id="session123",
        analysis_id="analysis456",
    )
    
    assert result["status"] == "generated"
    assert result["version"] == "1.0"
    assert result["provider"]["name"] == "ollama"
    assert result["tokens"]["in"] == 150
    assert result["tokens"]["out"] == 200
    assert "narrative" in result
    assert "interpretation" in result["narrative"]


@pytest.mark.asyncio
async def test_generate_narrative_fallback_on_error(narrative_service, ai_registry):
    """Test fallback when provider fails."""
    mock_provider = AsyncMock()
    mock_provider.generate = AsyncMock(side_effect=Exception("Provider unavailable"))
    ai_registry.default.return_value = mock_provider
    
    result = await narrative_service.generate_narrative(
        assessment_type="holland",
        age_band=AgeBand.ADULT,
        hardcards={"next_steps": "Explore tech careers"},
        scores={},
    )
    
    assert result["status"] == "fallback"
    assert result["provider"]["name"] == "fallback"
    assert "narrative" in result
    assert result["narrative"]["interpretation"]


def test_fallback_narrative_structure(narrative_service):
    """Test fallback narrative has all required keys."""
    fallback = narrative_service._fallback_narrative(
        assessment_type="mbti",
        age_band=AgeBand.CHILD,
        hardcards={},
        error="Test error",
    )
    
    required_keys = ["interpretation", "strengths", "development_areas", "recommended_paths", "faq"]
    assert all(key in fallback["narrative"] for key in required_keys)
    assert fallback["status"] == "fallback"


def test_extract_section_text(narrative_service):
    """Test section extraction from unstructured text."""
    text = """
Interpretation: You show strong artistic interests.

Strengths: Creative thinking, visual design.

Development Areas: Technical implementation.
"""
    
    interpretation = narrative_service._extract_section(text, "interpretation")
    assert "artistic" in interpretation.lower()
    
    strengths = narrative_service._extract_section(text, "strengths")
    assert "creative" in strengths.lower()
