
from .schemas import MBTI_DIMENSIONS, RIASEC_DIMENSIONS


def _quality_band(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _compute_quality_score(raw_scores: dict[str, float], dimensions: list[str]) -> tuple[float, str]:
    values = [max(raw_scores.get(key, 0.0), 0.0) for key in dimensions]
    if not values:
        return 0.0, "low"

    non_zero_ratio = sum(1 for value in values if value > 0) / len(values)
    max_value = max(values)
    min_value = min(values)
    spread_ratio = 0.0 if max_value <= 0 else (max_value - min_value) / max_value

    # Weighted quality score:
    # - non_zero_ratio captures response completeness
    # - spread_ratio captures signal separation (less flat answers)
    quality_score = round(((0.6 * non_zero_ratio) + (0.4 * spread_ratio)) * 100.0, 2)
    return quality_score, _quality_band(quality_score)


def score_holland(raw_scores: dict[str, float]) -> tuple[dict[str, float], str, float, str]:
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
    quality_score, quality_band = _compute_quality_score(raw_scores, RIASEC_DIMENSIONS)
    return normalized, top3_code, quality_score, quality_band


def score_mbti(raw_scores: dict[str, float]) -> tuple[str, dict[str, float], float, str]:
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

    quality_score, quality_band = _compute_quality_score(raw_scores, MBTI_DIMENSIONS)
    return "".join(type_letters), certainty, quality_score, quality_band
