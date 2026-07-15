"""
Hardcard Engine Service Module.

Implements rules-based analysis aggregation. The hardcard engine interprets
scoring model outputs against configurable templates to produce categorized
findings and structured analysis results.

Core workflow:
1. Load raw_scores from ScoringModel output
2. Fetch AnalysisTemplate rules for test_type + age_branch
3. Apply threshold-based categorization
4. Aggregate findings into results_json
5. Store in AnalysisResult entity
"""

import logging
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analysis_result import AnalysisResult
from app.models.analysis_template import AnalysisTemplate

logger = logging.getLogger(__name__)


def apply_rules(raw_scores: dict[str, Any], rules: list[dict]) -> dict[str, Any]:
    """
    Apply template rules to raw scores, returning categorized findings.

    Each rule evaluates a score field against a threshold using an operator (gt, lt, eq).
    If the condition is met, the associated label is added to findings.

    Args:
        raw_scores: Dictionary of raw score values (e.g., {"type": "ENFP", "confidence": 0.92})
        rules: List of rule dicts with keys: field, operator (gt/lt/eq), threshold, label

    Returns:
        Dictionary with categorized findings: {category: label_text}

    Example:
        raw_scores = {"confidence": 0.85, "type": "ENFP"}
        rules = [
            {"field": "confidence", "operator": "gt", "threshold": 0.75, "label": "high_confidence"},
            {"field": "type", "operator": "eq", "threshold": "ENFP", "label": "extroverted"}
        ]
        apply_rules(raw_scores, rules) -> {"confidence": "high_confidence", "type": "extroverted"}
    """
    findings = {}

    for rule in rules:
        try:
            field = rule.get("field")
            operator = rule.get("operator")
            threshold = rule.get("threshold")
            label = rule.get("label")

            if not all([field, operator, label]):
                logger.warning(f"Skipping malformed rule: {rule}")
                continue

            if field not in raw_scores:
                logger.warning(f"Field '{field}' not found in raw_scores. Skipping rule.")
                continue

            value = raw_scores[field]
            condition_met = False

            if operator == "gt":
                condition_met = value > threshold
            elif operator == "lt":
                condition_met = value < threshold
            elif operator == "eq":
                condition_met = value == threshold
            else:
                logger.warning(f"Unknown operator: {operator}")
                continue

            if condition_met:
                findings[field] = label
                logger.debug(f"Rule applied: {field} {operator} {threshold} -> {label}")

        except Exception as e:
            logger.error(f"Error applying rule {rule}: {e}")
            continue

    return findings


def threshold_score(value: float, thresholds: dict[str, str]) -> str:
    """
    Map a numeric score to a category based on thresholds.

    Thresholds should be ordered from lowest to highest. Returns the
    label corresponding to the first threshold the value exceeds.

    Args:
        value: Numeric score value
        thresholds: Dict with numeric threshold keys and category labels
                   (e.g., {0.33: "low", 0.66: "medium", 1.0: "high"})

    Returns:
        Category label string

    Example:
        threshold_score(0.75, {0.33: "low", 0.66: "medium", 1.0: "high"}) -> "high"
    """
    try:
        sorted_thresholds = sorted(thresholds.items(), key=lambda x: x[0])
        for threshold_val, label in sorted_thresholds:
            if value <= threshold_val:
                return label
        # If above all thresholds, return the highest category
        return sorted_thresholds[-1][1] if sorted_thresholds else "unknown"
    except Exception as e:
        logger.error(f"Error in threshold_score: {e}")
        return "unknown"


async def aggregate_scores(
    session: AsyncSession,
    assessment_id: UUID,
    raw_scores: dict[str, Any],
    age_branch: str,
    test_type: str,
) -> dict[str, Any]:
    """
    Aggregate raw scores using template rules to produce analysis findings.

    This is the main entry point: load template rules, apply them to raw scores,
    and return structured findings.

    Args:
        session: SQLAlchemy async session
        assessment_id: UUID of the assessment being analyzed
        raw_scores: Raw score dict from ScoringModel
        age_branch: Age branch (child/teen/adult/senior) for template lookup
        test_type: Test type (holland, mbti, etc.) for template lookup

    Returns:
        Aggregated findings dict with applied rules

    Raises:
        ValueError: If template not found for test_type + age_branch
    """
    logger.info(
        f"Aggregating scores for assessment {assessment_id}, "
        f"test_type={test_type}, age_branch={age_branch}"
    )

    # Fetch template for this test_type + age_branch
    from sqlalchemy import select

    stmt = select(AnalysisTemplate).where(
        (AnalysisTemplate.test_type == test_type) & (AnalysisTemplate.age_branch == age_branch)
    )
    result = await session.execute(stmt)
    template = result.scalars().first()

    if not template:
        error_msg = f"No template found for test_type={test_type}, age_branch={age_branch}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    # Extract and apply rules
    rules = template.get_rules()
    findings = apply_rules(raw_scores, rules)

    logger.debug(f"Aggregation complete. Findings: {findings}")
    return findings
