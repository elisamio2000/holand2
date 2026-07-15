"""
Tests for Phase E: Config Schema & Age-band Profiles (E2)
"""

import pytest
from apps.api.app.schemas.ai_config import (
    AgeBand,
    AIProfileConfig,
    NarrativeTemplate,
    DEFAULT_PROFILES,
    get_profile_by_age_band,
    DEFAULT_CHILD_PROFILE,
    DEFAULT_TEEN_PROFILE,
    DEFAULT_ADULT_PROFILE,
    DEFAULT_SENIOR_PROFILE,
)


def test_age_band_enum():
    """Test AgeBand enum values."""
    assert AgeBand.CHILD.value == "child"
    assert AgeBand.TEEN.value == "teen"
    assert AgeBand.ADULT.value == "adult"
    assert AgeBand.SENIOR.value == "senior"


def test_ai_profile_config_defaults():
    """Test AIProfileConfig with defaults."""
    config = AIProfileConfig(
        age_band=AgeBand.ADULT,
        ai_provider="ollama",
        model_name="mistral:7b",
    )
    
    assert config.age_band == AgeBand.ADULT
    assert config.temperature == 0.7
    assert config.max_tokens == 500
    assert config.top_p == 0.95
    assert config.ai_config_version == "1.0"


def test_ai_profile_config_validation():
    """Test AIProfileConfig validation."""
    # Valid config
    config = AIProfileConfig(
        age_band=AgeBand.TEEN,
        temperature=0.6,
        max_tokens=400,
    )
    assert config.temperature == 0.6
    assert config.max_tokens == 400
    
    # Invalid temperature (out of range)
    with pytest.raises(ValueError):
        AIProfileConfig(
            age_band=AgeBand.TEEN,
            temperature=1.5,  # Invalid
        )
    
    # Invalid max_tokens (below minimum)
    with pytest.raises(ValueError):
        AIProfileConfig(
            age_band=AgeBand.TEEN,
            max_tokens=50,  # Below minimum 100
        )


def test_narrative_template_structure():
    """Test NarrativeTemplate structure."""
    template = NarrativeTemplate(
        template_id="holland_child_v1",
        assessment_type="holland",
        age_band=AgeBand.CHILD,
        system_prompt="You are helpful to children.",
        user_prompt_template="Tell me about {assessment_type}",
    )
    
    assert template.template_id == "holland_child_v1"
    assert template.assessment_type == "holland"
    assert template.age_band == AgeBand.CHILD
    assert "interpretation" in template.output_keys
    assert "strengths" in template.output_keys
    assert template.template_version == "1.0"


def test_default_child_profile():
    """Test default child profile."""
    profile = DEFAULT_CHILD_PROFILE
    
    assert profile.age_band == AgeBand.CHILD
    assert profile.ai_provider == "ollama"
    assert profile.model_name == "mistral:7b"
    assert profile.temperature == 0.6
    assert profile.max_tokens == 400
    assert "playful" in profile.system_prompt_template.lower()
    assert "tone" in profile.style_guidelines
    assert profile.style_guidelines["audience"] == "child + parent (dual-read format)"


def test_default_teen_profile():
    """Test default teen profile."""
    profile = DEFAULT_TEEN_PROFILE
    
    assert profile.age_band == AgeBand.TEEN
    assert profile.temperature == 0.7
    assert profile.max_tokens == 500
    assert "teenager" in profile.system_prompt_template.lower()
    assert profile.style_guidelines["focus"] == "career exploration, peer connections, action steps, identity formation"


def test_default_adult_profile():
    """Test default adult profile."""
    profile = DEFAULT_ADULT_PROFILE
    
    assert profile.age_band == AgeBand.ADULT
    assert profile.temperature == 0.7
    assert profile.max_tokens == 600
    assert "coach" in profile.system_prompt_template.lower()
    assert profile.style_guidelines["tone"] == "professional, data-driven, action-oriented, sophisticated"


def test_default_senior_profile():
    """Test default senior profile."""
    profile = DEFAULT_SENIOR_PROFILE
    
    assert profile.age_band == AgeBand.SENIOR
    assert profile.temperature == 0.65
    assert profile.max_tokens == 500
    assert "life coach" in profile.system_prompt_template.lower()
    assert "encore" in profile.style_guidelines["focus"].lower()


def test_default_profiles_mapping():
    """Test DEFAULT_PROFILES mapping."""
    assert len(DEFAULT_PROFILES) == 4
    assert DEFAULT_PROFILES[AgeBand.CHILD] == DEFAULT_CHILD_PROFILE
    assert DEFAULT_PROFILES[AgeBand.TEEN] == DEFAULT_TEEN_PROFILE
    assert DEFAULT_PROFILES[AgeBand.ADULT] == DEFAULT_ADULT_PROFILE
    assert DEFAULT_PROFILES[AgeBand.SENIOR] == DEFAULT_SENIOR_PROFILE


def test_get_profile_by_age_band():
    """Test get_profile_by_age_band function."""
    child_profile = get_profile_by_age_band(AgeBand.CHILD)
    assert child_profile.age_band == AgeBand.CHILD
    
    teen_profile = get_profile_by_age_band(AgeBand.TEEN)
    assert teen_profile.age_band == AgeBand.TEEN
    
    adult_profile = get_profile_by_age_band(AgeBand.ADULT)
    assert adult_profile.age_band == AgeBand.ADULT
    
    senior_profile = get_profile_by_age_band(AgeBand.SENIOR)
    assert senior_profile.age_band == AgeBand.SENIOR


def test_profile_versioning():
    """Test versioning in profiles."""
    for profile in DEFAULT_PROFILES.values():
        assert profile.ai_config_version == "1.0"
        assert isinstance(profile.ai_config_version, str)


def test_style_guidelines_completeness():
    """Test that all profiles have complete style guidelines."""
    required_keys = ["tone", "length", "focus", "audience"]
    
    for age_band, profile in DEFAULT_PROFILES.items():
        assert profile.style_guidelines, f"Missing guidelines for {age_band}"
        for key in required_keys:
            assert key in profile.style_guidelines, f"Missing {key} for {age_band}"
