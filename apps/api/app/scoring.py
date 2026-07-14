
from .schemas import MBTI_DIMENSIONS, RIASEC_DIMENSIONS

# Holland hexagon order (RIASEC) — adjacent types are most similar.
# Persian mapping: و=R, ج=I, ه=A, ا/الف=S, م=E, ق=C
# Source: Dr. Amir Tajallinia (دکتر امیر تجلی‌نیا) Holland scoring methodology
_RIASEC_ORDER = ['R', 'I', 'A', 'S', 'E', 'C']


def _hexagon_distance(t1: str, t2: str) -> int:
    """Shortest distance between two RIASEC types on the Holland hexagon (0-3)."""
    i1, i2 = _RIASEC_ORDER.index(t1), _RIASEC_ORDER.index(t2)
    diff = abs(i1 - i2)
    return min(diff, 6 - diff)


def _congruence_score(type_: str, top_type: str) -> int:
    """
    Congruence score from the hexagon adjacency matrix (تجلی‌نیا methodology):
    same type → 4, adjacent (1 step) → 3, two steps → 2, opposite (3 steps) → 1
    """
    return 4 - _hexagon_distance(type_, top_type)


def compute_holland_field_scores(normalized_scores: dict[str, float]) -> dict:
    """
    Compute Holland congruence-adjusted standardized scores and Iranian educational
    field scores using the Tajallinia (دکتر امیر تجلی‌نیا) methodology.

    نمره همخوانی: adjacency-based congruence from the hexagon matrix
    نمره میزان شده: rank + congruence
    Educational field formulas (از کارنامه آزمون هالند):
      ریاضی فیزیک = (R_std + I_std) / 2
      علوم تجربی  = (S_std + I_std) / 2
      علوم انسانی = (A_std + E_std + C_std + S_std×2) / 5
      خدمات       = (C_std + R_std + علوم_انسانی) / 3
      صنعت        = (C_std + R_std + ریاضی_فیزیک) / 3
      کشاورزی     = (C_std + R_std + علوم_تجربی) / 3
    """
    dims = _RIASEC_ORDER
    # Rank from 1 (lowest score) to 6 (highest score)
    sorted_types = sorted(dims, key=lambda t: normalized_scores.get(t, 0.0))
    ranks = {t: i + 1 for i, t in enumerate(sorted_types)}
    top_type = sorted_types[-1]

    congruence = {t: _congruence_score(t, top_type) for t in dims}
    standardized = {t: ranks[t] + congruence[t] for t in dims}

    r, i, a, s, e, c = [standardized[d] for d in dims]

    math_physics = (r + i) / 2
    natural_science = (s + i) / 2
    humanities = (a + e + c + s * 2) / 5
    services = (c + r + humanities) / 3
    industry = (c + r + math_physics) / 3
    agriculture = (c + r + natural_science) / 3

    raw_field_scores = {
        'ریاضی_فیزیک': math_physics,
        'علوم_تجربی': natural_science,
        'علوم_انسانی': humanities,
        'خدمات': services,
        'صنعت': industry,
        'کشاورزی': agriculture,
    }

    field_ranking = sorted(raw_field_scores, key=lambda k: raw_field_scores[k], reverse=True)

    return {
        'top_type': top_type,
        'ranks': ranks,
        'congruence_scores': congruence,
        'standardized_scores': standardized,
        'field_scores': {k: round(v, 2) for k, v in raw_field_scores.items()},
        'field_ranking': field_ranking,
    }


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
