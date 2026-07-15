"""
AI Configuration Schema for Age-band Profiles
Phase E: Per-age-band AI governance and narrative styling
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from enum import Enum


class AgeBand(str, Enum):
    """Age band categories for profile selection."""
    CHILD = "child"  # 6-12
    TEEN = "teen"  # 13-17
    ADULT = "adult"  # 18-50
    SENIOR = "senior"  # 50+


class AIProfileConfig(BaseModel):
    """Configuration for per-age-band AI narrative generation."""
    
    age_band: AgeBand
    ai_provider: str = "ollama"  # Provider name (e.g., "ollama", "claude")
    model_name: str = "mistral:7b"  # Model identifier
    temperature: float = Field(0.7, ge=0.0, le=1.0)
    max_tokens: int = Field(500, ge=100, le=2000)
    top_p: float = Field(0.95, ge=0.0, le=1.0)
    
    # System prompt template (can include placeholders like {age_band}, {assessment_type})
    system_prompt_template: str = ""
    
    # Per-age-band style guidelines (used for validation & UI hints)
    style_guidelines: Dict[str, str] = Field(
        default_factory=dict,
        description="Style rules per age band (e.g., tone, length, examples)"
    )
    
    # Version tracking for audit trail
    ai_config_version: str = "1.0"
    
    class Config:
        use_enum_values = False


class NarrativeTemplate(BaseModel):
    """
    Template for narrative generation.
    Maps assessment type + age band to prompts and output structure.
    """
    
    template_id: str
    assessment_type: str  # e.g., "holland", "mbti"
    age_band: AgeBand
    
    # System and user prompt templates (can use placeholders)
    system_prompt: str
    user_prompt_template: str  # Placeholders: {hardcards}, {scores}, {assessment_type}
    
    # Expected output structure
    output_keys: list[str] = Field(
        default_factory=lambda: [
            "interpretation",
            "strengths",
            "development_areas",
            "recommended_paths",
            "faq",
        ]
    )
    
    # Reconciliation rules for composite narratives (if multi-assessment)
    reconciliation_rules: Dict[str, Any] = Field(default_factory=dict)
    
    # Version for audit trail
    template_version: str = "1.0"


# Default age-band profiles
DEFAULT_CHILD_PROFILE = AIProfileConfig(
    age_band=AgeBand.CHILD,
    ai_provider="ollama",
    model_name="mistral:7b",
    temperature=0.6,  # Slightly lower for consistency
    max_tokens=400,
    top_p=0.9,
    system_prompt_template="""You are a friendly, encouraging guidance counselor for children ages 6-12.
Your role is to help them understand themselves better and explore their interests.
Use simple, playful language. Focus on strengths and fun learning opportunities.
Include tips parents/teachers can use. Avoid complex jargon or scary scenarios.
Never recommend limiting their interests — emphasize growth and exploration.""",
    style_guidelines={
        "tone": "playful, encouraging, simple vocabulary (6-8th grade reading level)",
        "length": "brief (200-300 words per section)",
        "focus": "play-based framing, parent tips, exploration mindset",
        "audience": "child + parent (dual-read format)",
    },
    ai_config_version="1.0",
)

DEFAULT_TEEN_PROFILE = AIProfileConfig(
    age_band=AgeBand.TEEN,
    ai_provider="ollama",
    model_name="mistral:7b",
    temperature=0.7,
    max_tokens=500,
    top_p=0.95,
    system_prompt_template="""You are a supportive guidance counselor for teenagers ages 13-17.
Help them understand their interests, personality, and potential career paths.
Use relatable language and real-world examples. Acknowledge peer pressure and identity exploration.
Provide actionable next steps: clubs, online courses, volunteer opportunities, career shadowing.
Be encouraging but realistic — teenagers value authenticity.""",
    style_guidelines={
        "tone": "relatable, authentic, non-preachy, moderately technical",
        "length": "medium (300-400 words per section)",
        "focus": "career exploration, peer connections, action steps, identity formation",
        "audience": "teenager with optional parent visibility",
    },
    ai_config_version="1.0",
)

DEFAULT_ADULT_PROFILE = AIProfileConfig(
    age_band=AgeBand.ADULT,
    ai_provider="ollama",
    model_name="mistral:7b",
    temperature=0.7,
    max_tokens=600,
    top_p=0.95,
    system_prompt_template="""You are a professional career coach for adults ages 18-50.
Provide sophisticated, data-driven insights on interests, personality, and career fit.
Include actionable strategies: skill development, networking, job search optimization.
Reference industry trends, salary data, and advancement pathways where relevant.
Be concise and professional. Respect their existing experience and autonomy.""",
    style_guidelines={
        "tone": "professional, data-driven, action-oriented, sophisticated",
        "length": "comprehensive (400-500 words per section)",
        "focus": "career matching, skill gaps, advancement, industry context, resource links",
        "audience": "professional adult",
    },
    ai_config_version="1.0",
)

DEFAULT_SENIOR_PROFILE = AIProfileConfig(
    age_band=AgeBand.SENIOR,
    ai_provider="ollama",
    model_name="mistral:7b",
    temperature=0.65,
    max_tokens=500,
    top_p=0.9,
    system_prompt_template="""You are a compassionate life coach for adults 50+.
Help them understand strengths, explore encore careers, and plan meaningful transitions.
Focus on life-stage wisdom, community involvement, wellness, and purposeful engagement.
Include resources for lifelong learning, mentoring, volunteer work, and phased retirement.
Celebrate their experience and potential for continued growth and contribution.""",
    style_guidelines={
        "tone": "respectful, wisdom-acknowledging, opportunity-focused, inclusive",
        "length": "thoughtful (350-450 words per section)",
        "focus": "life transitions, encore careers, community, wellness, mentorship, legacy",
        "audience": "mature adult",
    },
    ai_config_version="1.0",
)

DEFAULT_PROFILES = {
    AgeBand.CHILD: DEFAULT_CHILD_PROFILE,
    AgeBand.TEEN: DEFAULT_TEEN_PROFILE,
    AgeBand.ADULT: DEFAULT_ADULT_PROFILE,
    AgeBand.SENIOR: DEFAULT_SENIOR_PROFILE,
}


def get_profile_by_age_band(age_band: AgeBand) -> AIProfileConfig:
    """Get default AI profile for age band."""
    return DEFAULT_PROFILES.get(age_band, DEFAULT_ADULT_PROFILE)
