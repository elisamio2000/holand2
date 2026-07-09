"""Question-bank quality diagnostics for assessment versions.

This service is intentionally non-mutating: it reports quality issues and
metrics for a version so governance endpoints can expose diagnostics before
publish-time gates are enforced.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Any

from ..models.assessment import AssessmentType, QuestionKind

HOLLAND_DIMENSIONS = ("R", "I", "A", "S", "E", "C")
MBTI_DIMENSIONS = ("EI", "SN", "TF", "JP")
LIKERT_VALUES = (1, 2, 3, 4, 5)

MIN_QUESTIONS_PER_HOLLAND_DIMENSION = 3
MIN_QUESTIONS_PER_MBTI_PAIR = 3

_WORD_RE = re.compile(r"\W+", flags=re.UNICODE)


@dataclass(slots=True)
class _Issue:
    code: str
    severity: str  # "error" | "warning"
    message: str
    context: dict[str, Any]


def _normalized_text(text: str) -> str:
    return _WORD_RE.sub(" ", text.strip().casefold()).strip()


def _as_issue(issue: _Issue) -> dict[str, Any]:
    return {
        "code": issue.code,
        "severity": issue.severity,
        "message": issue.message,
        "context": issue.context,
    }


def build_quality_report(assessment_type: AssessmentType, questions: list[Any]) -> dict[str, Any]:
    issues: list[_Issue] = []
    dimension_counts: Counter[str] = Counter()
    normalized_text_to_indexes: dict[str, list[int]] = {}

    for idx, q in enumerate(questions):
        dimension_counts[q.dimension] += 1
        norm = _normalized_text(q.text)
        normalized_text_to_indexes.setdefault(norm, []).append(idx)

        if q.kind == QuestionKind.LIKERT:
            _validate_likert_question(q, idx, issues)
        elif q.kind == QuestionKind.FORCED_CHOICE:
            _validate_forced_choice_question(q, idx, issues)
        else:
            issues.append(
                _Issue(
                    code="unknown_question_kind",
                    severity="error",
                    message="Unsupported question kind.",
                    context={"question_index": idx, "kind": str(q.kind)},
                )
            )

        if q.is_reverse_scored and q.kind != QuestionKind.LIKERT:
            issues.append(
                _Issue(
                    code="reverse_scoring_invalid_kind",
                    severity="error",
                    message="Reverse scoring is only valid for Likert questions.",
                    context={"question_index": idx, "kind": q.kind.value},
                )
            )

    _validate_dimension_coverage(assessment_type, dimension_counts, issues)
    _validate_dimension_balance(assessment_type, dimension_counts, issues)
    _validate_duplicate_texts(normalized_text_to_indexes, issues)

    errors = [issue for issue in issues if issue.severity == "error"]
    warnings = [issue for issue in issues if issue.severity == "warning"]
    return {
        "ok": len(errors) == 0,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "issues": [_as_issue(issue) for issue in issues],
        "metrics": {
            "question_count": len(questions),
            "dimension_counts": dict(dimension_counts),
        },
    }


def _validate_likert_question(q: Any, idx: int, issues: list[_Issue]) -> None:
    options = sorted(q.options, key=lambda opt: opt.order_index)
    if len(options) != 5:
        issues.append(
            _Issue(
                code="likert_option_count_invalid",
                severity="error",
                message="Likert question must have exactly 5 options.",
                context={"question_index": idx, "option_count": len(options)},
            )
        )
        return

    values = [opt.value for opt in options]
    poles = {opt.pole for opt in options}
    if tuple(values) != LIKERT_VALUES:
        issues.append(
            _Issue(
                code="likert_values_invalid",
                severity="error",
                message="Likert option values must be consecutive 1..5 in order.",
                context={"question_index": idx, "values": values},
            )
        )
    if poles != {q.dimension}:
        issues.append(
            _Issue(
                code="likert_pole_dimension_mismatch",
                severity="error",
                message="Likert option poles must match question dimension.",
                context={"question_index": idx, "dimension": q.dimension, "poles": sorted(poles)},
            )
        )


def _validate_forced_choice_question(q: Any, idx: int, issues: list[_Issue]) -> None:
    options = sorted(q.options, key=lambda opt: opt.order_index)
    if len(options) != 2:
        issues.append(
            _Issue(
                code="forced_choice_option_count_invalid",
                severity="error",
                message="Forced-choice question must have exactly 2 options.",
                context={"question_index": idx, "option_count": len(options)},
            )
        )
        return

    if len(q.dimension) != 2:
        issues.append(
            _Issue(
                code="forced_choice_dimension_invalid",
                severity="error",
                message="Forced-choice dimension must be a two-letter pair (for example EI).",
                context={"question_index": idx, "dimension": q.dimension},
            )
        )
        return

    expected_poles = set(q.dimension)
    poles = {opt.pole for opt in options}
    if poles != expected_poles:
        issues.append(
            _Issue(
                code="forced_choice_pole_dimension_mismatch",
                severity="error",
                message="Forced-choice option poles must match the dimension pair letters.",
                context={
                    "question_index": idx,
                    "dimension": q.dimension,
                    "expected_poles": sorted(expected_poles),
                    "poles": sorted(poles),
                },
            )
        )


def _validate_dimension_coverage(
    assessment_type: AssessmentType,
    dimension_counts: Counter[str],
    issues: list[_Issue],
) -> None:
    if assessment_type == AssessmentType.HOLLAND:
        missing = [dim for dim in HOLLAND_DIMENSIONS if dimension_counts.get(dim, 0) == 0]
        if missing:
            issues.append(
                _Issue(
                    code="holland_dimension_missing",
                    severity="warning",
                    message="Holland assessment must include all RIASEC dimensions.",
                    context={"missing_dimensions": missing},
                )
            )
        for dim in HOLLAND_DIMENSIONS:
            count = dimension_counts.get(dim, 0)
            if 0 < count < MIN_QUESTIONS_PER_HOLLAND_DIMENSION:
                issues.append(
                    _Issue(
                        code="holland_dimension_min_count",
                        severity="warning",
                        message="Dimension has fewer than the recommended minimum question count.",
                        context={
                            "dimension": dim,
                            "count": count,
                            "min_recommended": MIN_QUESTIONS_PER_HOLLAND_DIMENSION,
                        },
                    )
                )
        return

    if assessment_type == AssessmentType.MBTI:
        missing = [pair for pair in MBTI_DIMENSIONS if dimension_counts.get(pair, 0) == 0]
        if missing:
            issues.append(
                _Issue(
                    code="mbti_pair_missing",
                    severity="warning",
                    message="MBTI assessment must include all EI/SN/TF/JP pairs.",
                    context={"missing_pairs": missing},
                )
            )
        for pair in MBTI_DIMENSIONS:
            count = dimension_counts.get(pair, 0)
            if 0 < count < MIN_QUESTIONS_PER_MBTI_PAIR:
                issues.append(
                    _Issue(
                        code="mbti_pair_min_count",
                        severity="warning",
                        message="Pair has fewer than the recommended minimum question count.",
                        context={
                            "pair": pair,
                            "count": count,
                            "min_recommended": MIN_QUESTIONS_PER_MBTI_PAIR,
                        },
                    )
                )


def _validate_dimension_balance(
    assessment_type: AssessmentType,
    dimension_counts: Counter[str],
    issues: list[_Issue],
) -> None:
    dimensions = HOLLAND_DIMENSIONS if assessment_type == AssessmentType.HOLLAND else MBTI_DIMENSIONS
    counts = [dimension_counts.get(dim, 0) for dim in dimensions]
    non_zero = [count for count in counts if count > 0]
    if not non_zero:
        issues.append(
            _Issue(
                code="question_bank_empty",
                severity="error",
                message="Assessment version contains no questions.",
                context={},
            )
        )
        return
    if min(non_zero) == 0:
        return
    if max(non_zero) > 2 * min(non_zero):
        issues.append(
            _Issue(
                code="dimension_balance_skewed",
                severity="warning",
                message="Question distribution is skewed across dimensions/pairs.",
                context={
                    "counts": {dim: dimension_counts.get(dim, 0) for dim in dimensions},
                    "max_to_min_ratio": round(max(non_zero) / min(non_zero), 2),
                },
            )
        )


def _validate_duplicate_texts(
    normalized_text_to_indexes: dict[str, list[int]],
    issues: list[_Issue],
) -> None:
    duplicates = [
        {"text": norm, "question_indexes": indexes}
        for norm, indexes in normalized_text_to_indexes.items()
        if norm and len(indexes) > 1
    ]
    if duplicates:
        issues.append(
            _Issue(
                code="duplicate_question_text",
                severity="error",
                message="Duplicate question text detected after normalization.",
                context={"duplicates": duplicates},
            )
        )
