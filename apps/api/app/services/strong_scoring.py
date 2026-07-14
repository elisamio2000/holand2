"""STRONG-style interest-level banding and educational-field guidance.

Implements the precise interpretation bands from the project documentation
(آزمون رغبت استرانگ / تفسیر سطوح — دکتر امیر تجلی‌نیا):

    نمره > ۷۰            → رغبت خیلی بالا   (very_high)
    ۶۰ ≤ نمره ≤ ۷۰       → رغبت بالا        (high)
    ۵۰ ≤ نمره < ۶۰       → رغبت متوسط       (moderate)
    ۴۰ ≤ نمره < ۵۰       → رغبت پایین       (low)
    نمره < ۴۰            → رغبت خیلی پایین  (very_low)

Unlike the percent-of-total normalization (which forces the six themes to sum
to 100 and suppresses genuinely high multi-theme profiles), STRONG scores each
General Occupational Theme (GOT) independently on a standard-score scale with a
mean of 50. This module converts per-dimension raw sums into independent
standard scores so the documented bands apply correctly.
"""

from __future__ import annotations

from typing import Any

# General Occupational Themes (6 tips) — Persian named types from the docs.
GOT_LABELS_FA: dict[str, str] = {
    "R": "واقع‌گرا (Realistic)",
    "I": "جستجوگر (Investigative)",
    "A": "هنری (Artistic)",
    "S": "اجتماعی (Social)",
    "E": "متهور (Enterprising)",
    "C": "قراردادی (Conventional)",
}

# Band metadata: key → (fa_label, min_inclusive, max_exclusive)
_BANDS: list[tuple[str, str, float, float]] = [
    ("very_high", "خیلی بالا", 70.0, float("inf")),
    ("high", "بالا", 60.0, 70.0001),
    ("moderate", "متوسط", 50.0, 60.0),
    ("low", "پایین", 40.0, 50.0),
    ("very_low", "خیلی پایین", float("-inf"), 40.0),
]

FIELD_LABELS_FA: dict[str, str] = {
    "ریاضی_فیزیک": "ریاضی و فیزیک",
    "علوم_تجربی": "علوم تجربی",
    "علوم_انسانی": "علوم انسانی",
    "خدمات": "خدمات",
    "صنعت": "صنعت (فنی و حرفه‌ای)",
    "کشاورزی": "کشاورزی",
}


def band_of(score: float) -> dict[str, str]:
    """Return the STRONG interest band for a standard score.

    The documented cutoffs are: >70 very high, 60–70 high, 50–60 moderate,
    40–50 low, <40 very low.
    """
    if score > 70:
        return {"key": "very_high", "label_fa": "خیلی بالا"}
    if score >= 60:
        return {"key": "high", "label_fa": "بالا"}
    if score >= 50:
        return {"key": "moderate", "label_fa": "متوسط"}
    if score >= 40:
        return {"key": "low", "label_fa": "پایین"}
    return {"key": "very_low", "label_fa": "خیلی پایین"}


def _standard_score(raw: float, max_raw: float) -> float:
    """Map a per-dimension raw sum to a 0–100 standard score.

    With no population norms available we anchor the scale to the instrument's
    own range: the theoretical midpoint of the response scale maps to 50 and the
    maximum maps to 100. This keeps the documented bands meaningful (a genuinely
    strong theme lands in the high/very-high range) while allowing several
    themes to score high simultaneously — the defining property of STRONG GOT
    scoring.
    """
    if max_raw <= 0:
        return 0.0
    ratio = max(0.0, min(raw / max_raw, 1.0))
    return round(ratio * 100.0, 1)


def compute_interest_levels(
    raw_scores: dict[str, float],
    max_raw_per_dimension: float | None = None,
) -> dict[str, Any]:
    """Compute independent STRONG interest-level scores + bands for the 6 GOTs.

    Args:
        raw_scores: raw summed score per RIASEC letter (R,I,A,S,E,C).
        max_raw_per_dimension: theoretical maximum raw score for one dimension
            (e.g. items_per_dimension × max_option_value). When omitted it is
            inferred from the highest observed raw score, which keeps behaviour
            stable for legacy sessions.

    Returns a dict with per-theme standard score + band and a ranked list.
    """
    letters = ["R", "I", "A", "S", "E", "C"]
    observed = [max(float(raw_scores.get(k, 0.0)), 0.0) for k in letters]
    max_raw = max_raw_per_dimension or (max(observed) if observed else 0.0) or 1.0

    themes: dict[str, dict[str, Any]] = {}
    for letter in letters:
        raw = max(float(raw_scores.get(letter, 0.0)), 0.0)
        score = _standard_score(raw, max_raw)
        band = band_of(score)
        themes[letter] = {
            "letter": letter,
            "label_fa": GOT_LABELS_FA[letter],
            "score": score,
            "band": band["key"],
            "band_fa": band["label_fa"],
        }

    ranking = sorted(letters, key=lambda k: themes[k]["score"], reverse=True)
    return {"themes": themes, "ranking": ranking}


def band_educational_fields(field_scores: dict[str, float]) -> dict[str, Any]:
    """Rescale the Tajallinia educational-field scores to a 0–100 presentation
    scale and attach precise band labels + Persian names, sorted descending."""
    if not field_scores:
        return {"fields": [], "top_field": None}

    values = list(field_scores.values())
    lo, hi = min(values), max(values)
    span = (hi - lo) or 1.0

    fields = []
    for key, raw in sorted(field_scores.items(), key=lambda kv: kv[1], reverse=True):
        # Map the compact standardized field score onto a 40–100 band window so
        # the documented interest bands read naturally for the top fields.
        scaled = round(40.0 + ((raw - lo) / span) * 60.0, 1)
        band = band_of(scaled)
        fields.append(
            {
                "key": key,
                "label_fa": FIELD_LABELS_FA.get(key, key),
                "raw_score": round(float(raw), 2),
                "score": scaled,
                "band": band["key"],
                "band_fa": band["label_fa"],
            }
        )
    return {"fields": fields, "top_field": fields[0]["key"] if fields else None}


def build_strong_summary_fa(
    interest_levels: dict[str, Any],
    banded_fields: dict[str, Any],
) -> str:
    """Compose a precise, data-grounded Persian summary of interest levels and
    educational-field fit for use in reports and the AI data block."""
    lines: list[str] = []
    lines.append("### سطح رغبت در شش تیپ شغلی (STRONG)")
    for letter in interest_levels["ranking"]:
        t = interest_levels["themes"][letter]
        lines.append(f"- {t['label_fa']}: نمره {t['score']} — رغبت {t['band_fa']}")
    if banded_fields.get("fields"):
        lines.append("")
        lines.append("### تناسب حوزه‌های تحصیلی")
        for f in banded_fields["fields"]:
            lines.append(f"- {f['label_fa']}: نمره {f['score']} — تناسب {f['band_fa']}")
    return "\n".join(lines)
