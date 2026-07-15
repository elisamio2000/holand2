"""
Narrative Generation Service
E3: Core service for generating structured narratives from analysis results
"""

import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import time

from apps.api.app.services.ai_provider import AIProvider, GenerationRequest, AIProviderRegistry
from apps.api.app.schemas.ai_config import AgeBand, get_profile_by_age_band

logger = logging.getLogger(__name__)


class NarrativeService:
    """Service for generating AI-driven narratives from analysis results."""

    def __init__(self, ai_registry: AIProviderRegistry, token_tracker=None):
        """
        Initialize narrative service.
        
        Args:
            ai_registry: AIProviderRegistry instance
            token_tracker: Optional token tracker for accounting (E5)
        """
        self.ai_registry = ai_registry
        self.token_tracker = token_tracker

    async def generate_narrative(
        self,
        assessment_type: str,
        age_band: AgeBand,
        hardcards: Dict[str, Any],
        scores: Dict[str, Any],
        analysis_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate structured narrative from analysis results.
        
        Args:
            assessment_type: Type of assessment (e.g., "holland", "mbti")
            age_band: AgeBand for profile selection
            hardcards: Structured hardcards output (demographics, scores_table, risk_flags, next_steps)
            scores: Raw scores dict
            analysis_id: Optional analysis ID for audit trail
            session_id: Optional session ID for user tracking
            
        Returns:
            Dict with narrative structure or fallback content
        """
        start_time = time.time()
        
        try:
            # Select age-band profile
            profile = get_profile_by_age_band(age_band)
            
            # Build prompts
            system_prompt = profile.system_prompt_template or f"You are a guidance counselor for {age_band.value}s."
            user_prompt = self._build_user_prompt(
                assessment_type=assessment_type,
                age_band=age_band,
                hardcards=hardcards,
                scores=scores,
            )
            
            # Create generation request
            gen_request = GenerationRequest(
                prompt=user_prompt,
                system_prompt=system_prompt,
                max_tokens=min(profile.max_tokens, 1000),  # Cap at 1000
                temperature=profile.temperature,
                top_p=profile.top_p,
            )
            
            # Call AI provider
            provider = self.ai_registry.default()
            gen_response = await provider.generate(gen_request)
            
            # Parse response
            narrative = self._parse_narrative_response(gen_response.text)
            
            # Build audit trail
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Track tokens if tracker available
            if self.token_tracker:
                await self.token_tracker.track_generation(
                    session_id=session_id,
                    analysis_id=analysis_id,
                    provider=provider.name,
                    model=provider.model,
                    tokens_in=gen_response.tokens_in,
                    tokens_out=gen_response.tokens_out,
                    latency_ms=latency_ms,
                    ai_config_version=profile.ai_config_version,
                )
            
            # Construct full response
            return {
                "version": "1.0",
                "ai_config_version": profile.ai_config_version,
                "generated_at": datetime.utcnow().isoformat(),
                "provider": {
                    "name": provider.name,
                    "model": provider.model,
                },
                "tokens": {
                    "in": gen_response.tokens_in,
                    "out": gen_response.tokens_out,
                },
                "latency_ms": latency_ms,
                "narrative": narrative,
                "status": "generated",
            }
        
        except Exception as e:
            logger.error(f"Narrative generation failed: {e}")
            
            # Return graceful fallback
            return self._fallback_narrative(
                assessment_type=assessment_type,
                age_band=age_band,
                hardcards=hardcards,
                error=str(e),
            )

    def _build_user_prompt(
        self,
        assessment_type: str,
        age_band: AgeBand,
        hardcards: Dict[str, Any],
        scores: Dict[str, Any],
    ) -> str:
        """Build user prompt from assessment data."""
        hardcards_str = json.dumps(hardcards, indent=2)
        scores_str = json.dumps(scores, indent=2)
        
        prompt = f"""Based on the following assessment results for a {age_band.value}:

Assessment Type: {assessment_type}

Structured Results:
{hardcards_str}

Raw Scores:
{scores_str}

Please provide a narrative analysis with these sections:
1. Interpretation: What these results mean
2. Strengths: Key strengths indicated by the assessment
3. Development Areas: Areas for potential growth
4. Recommended Paths: Actionable next steps or career/life paths
5. FAQ: Common questions and answers for this profile

Format your response as a JSON object with keys: interpretation, strengths, development_areas, recommended_paths, faq
Each key should contain a clear, well-structured string (multi-paragraph OK).
"""
        return prompt

    def _parse_narrative_response(self, response_text: str) -> Dict[str, str]:
        """
        Parse LLM response into structured narrative dict.
        
        Attempts JSON parsing first; falls back to extracting sections.
        """
        required_keys = ["interpretation", "strengths", "development_areas", "recommended_paths", "faq"]
        
        try:
            # Try parsing as JSON
            parsed = json.loads(response_text)
            
            # Validate required keys
            for key in required_keys:
                if key not in parsed:
                    parsed[key] = "(Not provided)"
            
            return parsed
        
        except json.JSONDecodeError:
            # Fallback: attempt to extract sections
            narrative = {}
            for key in required_keys:
                # Look for patterns like "Interpretation: ..." or "### Interpretation"
                section_text = self._extract_section(response_text, key)
                narrative[key] = section_text
            
            return narrative

    def _extract_section(self, text: str, section_name: str) -> str:
        """Extract a section from unstructured text."""
        import re
        
        # Look for patterns: "Section: content" or "### Section content"
        patterns = [
            rf"{section_name}:\s*(.+?)(?=\n[A-Z]|\n#{section_name}|$)",
            rf"#{{{1,4}}}\s*{section_name}\s*(.+?)(?=\n#{1,4}|$)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()
        
        return "(Content not found in response)"

    def _fallback_narrative(
        self,
        assessment_type: str,
        age_band: AgeBand,
        hardcards: Dict[str, Any],
        error: str,
    ) -> Dict[str, Any]:
        """Generate fallback narrative when AI provider is unavailable."""
        
        # Build basic fallback from hardcards
        fallback_narrative = {
            "interpretation": f"Based on your {assessment_type} assessment results, here's what your scores indicate about your interests and strengths.",
            "strengths": hardcards.get("next_steps", "Your results show potential in multiple areas."),
            "development_areas": "Continue exploring different activities and interests to discover new strengths.",
            "recommended_paths": "Consider the opportunities listed in your assessment results for next steps.",
            "faq": "Q: What do these results mean? A: They indicate your interests and personality patterns. Q: Should I follow these exactly? A: Use them as a guide, not a limit.",
        }
        
        logger.warning(f"Using fallback narrative due to error: {error}")
        
        return {
            "version": "1.0",
            "generated_at": datetime.utcnow().isoformat(),
            "provider": {
                "name": "fallback",
                "model": "template",
            },
            "tokens": {
                "in": 0,
                "out": 0,
            },
            "narrative": fallback_narrative,
            "status": "fallback",
            "error": error,
        }
