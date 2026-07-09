"""Computes session scores from raw answers (Phase 3).

Uses the versioned DSL formula (``ScoringFormulaVersion``) when one is
attached to the session's assessment version so the exact computation is
auditable and reproducible; falls back to the static reference
implementation in ``app.scoring`` when no formula version is published yet
(keeps the platform usable before an analyst has published a formula).
"""

from __future__ import annotations

from typing import Any

from ..models.assessment import AssessmentType, ScoringFormulaVersion
from ..scoring import score_holland, score_mbti
from .formula_engine import evaluate_formula

RIASEC_DIMENSIONS = ["R", "I", "A", "S", "E", "C"]
MBTI_PAIRS = [("E", "I"), ("S", "N"), ("T", "F"), ("J", "P")]

__all__ = [
    "RIASEC_DIMENSIONS",
    "MBTI_PAIRS",
    "compute_holland_result",
    "compute_mbti_result",
    "compute_session_result",
]


def _expression_of(formula: ScoringFormulaVersion) -> str:
    expr = formula.expression
    if isinstance(expr, dict):
        return expr.get("expr", "")
    return str(expr)


def compute_holland_result(
    raw_totals: dict[str, float], formula: ScoringFormulaVersion | None = None
) -> tuple[dict[str, float], str]:
    for dim in RIASEC_DIMENSIONS:
        raw_totals.setdefault(dim, 0.0)
    if formula is None:
        return score_holland(raw_totals)

    total = sum(max(v, 0.0) for v in raw_totals.values())
    expr = _expression_of(formula)
    normalized = {
        dim: round(
            evaluate_formula(expr, {"value": max(raw_totals.get(dim, 0.0), 0.0), "total": total}),
            2,
        )
        for dim in RIASEC_DIMENSIONS
    }
    top3 = sorted(normalized.items(), key=lambda x: x[1], reverse=True)[:3]
    top3_code = "".join(k for k, _ in top3)
    return normalized, top3_code


def compute_mbti_result(
    raw_totals: dict[str, float], formula: ScoringFormulaVersion | None = None
) -> tuple[str, dict[str, float]]:
    if formula is None:
        return score_mbti(raw_totals)

    expr = _expression_of(formula)
    type_letters: list[str] = []
    certainty: dict[str, float] = {}

    for left, right in MBTI_PAIRS:
        left_value = max(raw_totals.get(left, 0.0), 0.0)
        right_value = max(raw_totals.get(right, 0.0), 0.0)

        left_pct = round(evaluate_formula(expr, {"left": left_value, "right": right_value}), 2)
        right_pct = round(evaluate_formula(expr, {"left": right_value, "right": left_value}), 2)

        if left_pct >= right_pct:
            type_letters.append(left)
            certainty[left + right] = left_pct
        else:
            type_letters.append(right)
            certainty[left + right] = right_pct

    return "".join(type_letters), certainty


def compute_session_result(
    assessment_type: AssessmentType,
    raw_totals: dict[str, float],
    formula: ScoringFormulaVersion | None = None,
) -> dict[str, Any]:
    """Dispatch to the right scoring routine and return a uniform result dict."""
    if assessment_type == AssessmentType.HOLLAND:
        normalized, code = compute_holland_result(raw_totals, formula)
        return {"normalized_scores": normalized, "code": code, "certainty": None}

    if assessment_type == AssessmentType.MBTI:
        code, certainty = compute_mbti_result(raw_totals, formula)
        return {"normalized_scores": raw_totals, "code": code, "certainty": certainty}

    raise ValueError(f"Unsupported assessment type: {assessment_type}")
