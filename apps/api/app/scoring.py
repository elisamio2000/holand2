from typing import Dict, Tuple

from .schemas import MBTI_DIMENSIONS, RIASEC_DIMENSIONS


def score_holland(raw_scores: Dict[str, float]) -> Tuple[Dict[str, float], str]:
    missing = [k for k in RIASEC_DIMENSIONS if k not in raw_scores]
    if missing:
        raise ValueError(f"Missing RIASEC dimensions: {', '.join(missing)}")

    total = sum(max(v, 0.0) for v in raw_scores.values())
    if total == 0:
        normalized = {k: 0.0 for k in RIASEC_DIMENSIONS}
    else:
        normalized = {
            k: round((max(raw_scores[k], 0.0) / total) * 100.0, 2)
            for k in RIASEC_DIMENSIONS
        }

    top3 = sorted(normalized.items(), key=lambda x: x[1], reverse=True)[:3]
    top3_code = "".join([k for k, _ in top3])
    return normalized, top3_code


def score_mbti(raw_scores: Dict[str, float]) -> Tuple[str, Dict[str, float]]:
    missing = [k for k in MBTI_DIMENSIONS if k not in raw_scores]
    if missing:
        raise ValueError(f"Missing MBTI dimensions: {', '.join(missing)}")

    pairs = [("E", "I"), ("S", "N"), ("T", "F"), ("J", "P")]
    type_letters = []
    certainty = {}

    for left, right in pairs:
        left_value = max(raw_scores[left], 0.0)
        right_value = max(raw_scores[right], 0.0)
        pair_total = left_value + right_value

        if pair_total == 0:
            certainty[left + right] = 50.0
            type_letters.append(left)
            continue

        left_ratio = (left_value / pair_total) * 100.0
        right_ratio = (right_value / pair_total) * 100.0

        if left_ratio >= right_ratio:
            type_letters.append(left)
            certainty[left + right] = round(left_ratio, 2)
        else:
            type_letters.append(right)
            certainty[left + right] = round(right_ratio, 2)

    return "".join(type_letters), certainty
