"""
Composite Analysis Service Module.

Handles reconciliation of multiple test results into a unified analysis.
If a user completes multiple assessments (e.g., Holland + MBTI simultaneously),
the composite service merges findings and highlights intersections.

Workflow:
1. Validate test combination (e.g., allow Holland+MBTI, reject Holland+Holland)
2. Load individual analyses
3. Extract key findings from each
4. Merge findings, highlight agreements
5. Store as composite AnalysisResult (test_type="composite")
"""

import logging
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.analysis_result import AnalysisResult

logger = logging.getLogger(__name__)


def validate_composite(test_types: list[str]) -> bool:
    """
    Validate whether a combination of test types can be composited.

    Rules:
    - Cannot composite identical tests (e.g., holland + holland invalid)
    - Allowed: different tests (holland + mbti, etc.)
    - Minimum 2 tests required

    Args:
        test_types: List of test type strings

    Returns:
        True if combination is valid, False otherwise
    """
    if len(test_types) < 2:
        logger.warning(f"Composite requires 2+ tests, got {len(test_types)}")
        return False

    if len(test_types) != len(set(test_types)):
        logger.warning(f"Duplicate test types in composite: {test_types}")
        return False

    logger.debug(f"Composite validation passed for test_types: {test_types}")
    return True


async def merge_analyses(
    session: AsyncSession, analysis_ids: list[UUID], age_branch: str
) -> dict[str, Any]:
    """
    Merge multiple analysis results into a composite summary.

    Extracts key findings from each analysis and highlights agreements/intersections.
    This produces a unified narrative that acknowledges all tests while calling out
    where they agree.

    Args:
        session: SQLAlchemy async session
        analysis_ids: List of AnalysisResult IDs to merge
        age_branch: Age branch for consistency check

    Returns:
        Composite findings dict with:
        - individual: List of findings from each test
        - intersections: Fields where tests agree
        - unified_narrative: High-level summary

    Raises:
        ValueError: If analyses not found or age_branch mismatch
    """
    logger.info(f"Merging {len(analysis_ids)} analyses for age_branch={age_branch}")

    # Fetch all analyses
    stmt = select(AnalysisResult).where(AnalysisResult.id.in_(analysis_ids))
    result = await session.execute(stmt)
    analyses = result.scalars().all()

    if len(analyses) != len(analysis_ids):
        error_msg = f"Expected {len(analysis_ids)} analyses, found {len(analyses)}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    # Validate age_branch consistency
    for analysis in analyses:
        if analysis.age_branch != age_branch:
            error_msg = (
                f"Age branch mismatch in composite: expected {age_branch}, "
                f"got {analysis.age_branch}"
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

    # Extract findings from each
    individual_findings = []
    for analysis in analyses:
        findings = analysis.results_json.get("findings", {})
        individual_findings.append({"test_type": analysis.test_type, "findings": findings})
        logger.debug(f"Extracted findings from {analysis.test_type}: {findings}")

    # Find intersections (fields that match across tests)
    intersections = _find_intersections(individual_findings)

    # Build composite summary
    composite = {
        "individual": individual_findings,
        "intersections": intersections,
        "unified_narrative": _build_unified_narrative(individual_findings, intersections),
        "composite_metadata": {
            "test_count": len(analyses),
            "test_types": [a.test_type for a in analyses],
            "age_branch": age_branch,
        },
    }

    logger.debug(f"Composite analysis complete: {len(intersections)} intersections found")
    return composite


def _find_intersections(individual_findings: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Identify findings that appear across multiple tests.

    Intersections indicate high confidence in a particular finding.

    Args:
        individual_findings: List of {test_type, findings} dicts

    Returns:
        Dict mapping field names to list of agreeing test types
    """
    if not individual_findings or len(individual_findings) < 2:
        return {}

    intersections = {}

    # Get first test's findings as reference
    ref_findings = individual_findings[0]["findings"]

    for field, value in ref_findings.items():
        # Check if other tests have same field+value
        agreements = [individual_findings[0]["test_type"]]

        for other in individual_findings[1:]:
            if other["findings"].get(field) == value:
                agreements.append(other["test_type"])

        # If multiple tests agree, it's an intersection
        if len(agreements) > 1:
            intersections[field] = {"value": value, "test_types": agreements}
            logger.debug(f"Intersection found: {field}={value} across {agreements}")

    return intersections


def _build_unified_narrative(
    individual_findings: list[dict[str, Any]], intersections: dict[str, Any]
) -> str:
    """
    Build a high-level summary acknowledging all tests.

    Args:
        individual_findings: List of individual test findings
        intersections: Cross-test agreement fields

    Returns:
        Summary narrative string
    """
    parts = []

    # Start with test count
    test_count = len(individual_findings)
    test_types = ", ".join([f["test_type"] for f in individual_findings])
    parts.append(f"This composite analysis combines {test_count} assessment(s): {test_types}.")

    # Highlight intersections if any
    if intersections:
        intersection_count = len(intersections)
        parts.append(
            f"Key agreement: {intersection_count} finding(s) align across multiple assessments, "
            "indicating high confidence in these insights."
        )

    parts.append("Review individual test results for detailed interpretation.")

    return " ".join(parts)
