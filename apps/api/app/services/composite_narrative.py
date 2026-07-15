"""
Composite Narrative Synthesis Service
E4: Generate combined narratives for multi-assessment scenarios
"""

import logging
import json
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class CompositeNarrativeService:
    """
    Synthesize narratives from multiple assessments.
    Example: Holland (RIASEC) + MBTI = combined narrative with reconciliation.
    """

    # Default reconciliation rules mapping RIASEC codes to MBTI types
    DEFAULT_RIASEC_MBTI_RULES = {
        "R": {"best_fit": ["ESTJ", "ISTP"], "description": "Realistic + Practical types"},
        "I": {"best_fit": ["INTJ", "INTP"], "description": "Investigative + Analytical types"},
        "A": {"best_fit": ["ENFP", "INFP"], "description": "Artistic + Creative types"},
        "S": {"best_fit": ["ESFJ", "ISFJ"], "description": "Social + People-oriented types"},
        "E": {"best_fit": ["ENTJ", "ENTP"], "description": "Enterprising + Leadership types"},
        "C": {"best_fit": ["ISTJ", "ISFJ"], "description": "Conventional + Detail-oriented types"},
    }

    def __init__(self, reconciliation_rules: Optional[Dict[str, Any]] = None):
        """
        Initialize composite narrative service.
        
        Args:
            reconciliation_rules: Custom RIASEC↔MBTI mapping rules (uses defaults if None)
        """
        self.reconciliation_rules = reconciliation_rules or self.DEFAULT_RIASEC_MBTI_RULES

    async def synthesize_narratives(
        self,
        assessment_results: Dict[str, Dict[str, Any]],
        age_band: str,
    ) -> Dict[str, Any]:
        """
        Synthesize narratives from multiple assessments.
        
        Args:
            assessment_results: Dict mapping assessment_type -> {narrative, scores, hardcards}
            age_band: Age band for context
            
        Returns:
            Combined narrative with individual breakdowns
        """
        if len(assessment_results) < 2:
            logger.warning("Composite synthesis requires 2+ assessments")
            return self._single_assessment_structure(assessment_results)
        
        # Extract assessment data
        assessments = {}
        for assessment_type, result in assessment_results.items():
            assessments[assessment_type] = {
                "narrative": result.get("narrative", {}),
                "scores": result.get("scores", {}),
                "hardcards": result.get("hardcards", {}),
            }
        
        # Generate combined summary
        combined_summary = await self._generate_combined_summary(assessments, age_band)
        
        # Generate reconciliation narrative (e.g., Holland ↔ MBTI mapping)
        reconciliation = await self._generate_reconciliation_narrative(
            assessments, age_band
        )
        
        return {
            "synthesis_type": "composite",
            "assessment_count": len(assessments),
            "combined_view": {
                "summary": combined_summary,
                "reconciliation": reconciliation,
            },
            "individual_views": {
                assessment_type: self._extract_individual_view(result)
                for assessment_type, result in assessments.items()
            },
            "recommendations": await self._generate_composite_recommendations(assessments),
        }

    async def _generate_combined_summary(
        self, assessments: Dict[str, Dict[str, Any]], age_band: str
    ) -> str:
        """Generate a high-level summary synthesizing all assessments."""
        assessment_types = list(assessments.keys())
        
        # Simple text summary (can be enhanced with actual LLM call)
        summary = f"""
You show patterns across multiple dimensions:

"""
        
        for assessment_type in assessment_types:
            hardcards = assessments[assessment_type].get("hardcards", {})
            summary += f"- **{assessment_type.upper()}**: {hardcards.get('interpretation', 'Strong profile')}\n"
        
        summary += f"""

Together, these reveal a multifaceted profile that suggests diverse strengths and interests.
This combination offers flexibility across various paths and roles.
"""
        
        return summary.strip()

    async def _generate_reconciliation_narrative(
        self, assessments: Dict[str, Dict[str, Any]], age_band: str
    ) -> Dict[str, str]:
        """
        Generate reconciliation narrative (e.g., Holland ↔ MBTI alignment).
        """
        if "holland" not in assessments or "mbti" not in assessments:
            return {"note": "Reconciliation requires both Holland and MBTI assessments"}
        
        holland_scores = assessments["holland"].get("scores", {})
        mbti_type = assessments["mbti"].get("scores", {}).get("type", "Unknown")
        
        # Extract highest RIASEC code
        highest_riasec = self._get_highest_riasec(holland_scores)
        
        # Check alignment
        alignment_rules = self.reconciliation_rules.get(highest_riasec, {})
        best_fit_types = alignment_rules.get("best_fit", [])
        is_aligned = mbti_type in best_fit_types
        
        if is_aligned:
            reconciliation_text = f"""
Your Holland ({highest_riasec}) and MBTI ({mbti_type}) profiles align well.
Both suggest a natural fit with {alignment_rules.get('description', 'your profile')}.
This strong alignment indicates consistent interests and personality patterns.
"""
        else:
            reconciliation_text = f"""
Your Holland ({highest_riasec}) and MBTI ({mbti_type}) profiles show interesting contrasts.
This isn't a mismatch—rather, it shows complexity: you may have interests that cross typical personality boundaries.
Consider exploring roles that blend both dimensions.
"""
        
        return {
            "text": reconciliation_text.strip(),
            "holland_primary": highest_riasec,
            "mbti_type": mbti_type,
            "aligned": is_aligned,
        }

    async def _generate_composite_recommendations(
        self, assessments: Dict[str, Dict[str, Any]]
    ) -> List[str]:
        """Generate composite recommendations based on all assessments."""
        recommendations = [
            "Seek roles that combine your identified interests and personality strengths.",
            "Test multiple environments before committing to a specific path.",
            "Use your multi-dimensional profile to stand out in job searches.",
            "Look for mentors who share similar interest and personality patterns.",
            "Consider roles that evolve as you develop new interests.",
        ]
        
        return recommendations

    def _extract_individual_view(self, assessment_result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract individual assessment view."""
        return {
            "narrative": assessment_result.get("narrative", {}),
            "scores": assessment_result.get("scores", {}),
            "hardcards": assessment_result.get("hardcards", {}),
        }

    def _single_assessment_structure(
        self, assessment_results: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Handle case where only 1 assessment is provided (graceful degradation)."""
        if not assessment_results:
            return {"status": "error", "message": "No assessment results provided"}
        
        assessment_type = list(assessment_results.keys())[0]
        result = assessment_results[assessment_type]
        
        return {
            "synthesis_type": "single",
            "assessment_count": 1,
            "primary_assessment": assessment_type,
            "narrative": result.get("narrative", {}),
            "scores": result.get("scores", {}),
            "hardcards": result.get("hardcards", {}),
        }

    def _get_highest_riasec(self, scores: Dict[str, float]) -> str:
        """Extract highest RIASEC code from scores dict."""
        riasec_codes = "RIASEC"
        max_score = -1
        highest = "R"
        
        for code in riasec_codes:
            score = scores.get(code, 0)
            if isinstance(score, (int, float)) and score > max_score:
                max_score = score
                highest = code
        
        return highest
