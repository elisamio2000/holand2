"""Age-aware recommendation engine (Phase 4).

Maps a Holland (RIASEC) code + MBTI type + age to ranked job/major
recommendations sourced from the standardized taxonomy backbone (Job/Major
models), honoring the deprecation/deprioritization rules from
docs/job-taxonomy-modernization-and-ethics-fa.md and the age-segmentation
requirement from docs/esanj-benchmark-and-interpretation-requirements-fa.md
(quality of suggestions must differ across 13-17, 18-24, 25-30, 30+).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.job import AgeBand, Job, Major
from ..models.recommendation_quality import RecommendationFeedback
from ..monitoring import track_recommendation_heuristic_applied
from ..schemas import (
    JobRecommendation,
    MajorRecommendation,
    RecommendationQualitySignal,
    RecommendationResponseV2,
    age_to_band,
)

# MBTI letter -> RIASEC letters it tends to reinforce.
_MBTI_RIASEC_AFFINITY = {
    "E": "ES",
    "I": "IR",
    "S": "RC",
    "N": "AI",
    "T": "IC",
    "F": "SA",
    "J": "CE",
    "P": "AI",
}

# Per age-band tuning: how many career vs. major slots to prioritize, and a
# short rationale surfaced in warnings when relevant.
_AGE_BAND_WEIGHTS = {
    AgeBand.TEEN.value: {"job_share": 0.35, "major_share": 0.65},
    AgeBand.YOUNG_ADULT.value: {"job_share": 0.5, "major_share": 0.5},
    AgeBand.EARLY_CAREER.value: {"job_share": 0.7, "major_share": 0.3},
    AgeBand.ADULT.value: {"job_share": 0.75, "major_share": 0.25},
}

DEPRIORITIZED_WARNING_FA = "فرصت شغلی این مسیر محدود یا رو به کاهش است؛ فقط به عنوان گزینه فرعی در نظر بگیرید."
LOW_QUALITY_HEURISTIC_NOTE_FA = (
    "بازخوردهای اخیر این پروفایل نشان می‌دهد برخی پیشنهادها کم‌فایده بوده‌اند؛ "
    "برای این خروجی از چینش محافظه‌کارانه‌تر و تاکید بیشتر بر شواهد بازار استفاده شده است."
)
settings = get_settings()


def _riasec_fit_score(profile: str, holland_code: str) -> float:
    """Weighted positional overlap between a job/major RIASEC profile and the
    user's 3-letter Holland code. Earlier letters in the code carry more
    weight since they represent stronger interest priorities."""
    profile_letters = list(profile.upper())
    code_letters = list(holland_code.upper())
    if profile_letters[: len(code_letters)] == code_letters:
        return 100.0

    max_score = 0.0
    score = 0.0
    for idx, letter in enumerate(code_letters):
        code_weight = 3 - idx  # 3, 2, 1
        max_score += code_weight
        if letter in profile_letters:
            pos = profile_letters.index(letter)
            pos_weight = max(3 - pos, 0.5) / 3.0
            score += code_weight * pos_weight

    if max_score == 0:
        return 0.0
    return round((score / max_score) * 100.0, 1)


def _mbti_alignment_score(profile: str, mbti_type: str) -> float:
    profile_letters = set(profile.upper())
    hits = 0
    total = 0
    for letter in mbti_type.upper():
        affinity = _MBTI_RIASEC_AFFINITY.get(letter, "")
        if not affinity:
            continue
        total += 1
        if profile_letters & set(affinity):
            hits += 1
    if total == 0:
        return 50.0
    return round((hits / total) * 100.0, 1)


def _combined_fit(
    profile: str,
    holland_code: str,
    mbti_type: str,
    market_demand: float,
    local_relevance: float,
    weights: dict[str, float],
) -> float:
    riasec_fit = _riasec_fit_score(profile, holland_code)
    mbti_fit = _mbti_alignment_score(profile, mbti_type)
    demand_component = min(market_demand, 100.0)
    relevance_component = min(local_relevance, 100.0)

    fit = (
        riasec_fit * weights["riasec"]
        + mbti_fit * weights["mbti"]
        + demand_component * weights["demand"]
        + relevance_component * weights["relevance"]
    )
    return round(min(fit, 99.0), 1)


def _confidence(fit_score: float, deprioritized: bool, has_rich_metadata: bool) -> float:
    base = 40.0 + fit_score * 0.5
    if has_rich_metadata:
        base += 8.0
    if deprioritized:
        base -= 15.0
    return round(max(min(base, 99.0), 20.0), 1)


@dataclass
class _RankedJob:
    job: Job
    fit_score: float
    confidence: float


@dataclass
class _RankedMajor:
    major: Major
    fit_score: float
    confidence: float


async def _fetch_eligible_jobs(session: AsyncSession, age_band: str) -> list[Job]:
    result = await session.execute(select(Job).where(Job.deprecation_flag.is_(False)))
    jobs = result.scalars().all()
    return [j for j in jobs if not j.suitable_age_bands or age_band in j.suitable_age_bands]


async def _fetch_eligible_majors(session: AsyncSession, age_band: str) -> list[Major]:
    result = await session.execute(select(Major).where(Major.deprecation_flag.is_(False)))
    majors = result.scalars().all()
    return [m for m in majors if not m.suitable_age_bands or age_band in m.suitable_age_bands]


def _fit_weights(low_quality_detected: bool) -> dict[str, float]:
    if low_quality_detected:
        return {"riasec": 0.50, "mbti": 0.20, "demand": 0.20, "relevance": 0.10}
    return {"riasec": 0.60, "mbti": 0.25, "demand": 0.10, "relevance": 0.05}


async def _load_quality_signal(
    session: AsyncSession, holland_code: str, mbti_type: str, age_band: str
) -> RecommendationQualitySignal:
    lookback_days = 30
    since = datetime.now(timezone.utc) - timedelta(days=lookback_days)  # noqa: UP017
    result = await session.execute(
        select(
            func.count(RecommendationFeedback.id),
            func.coalesce(
                func.sum(case((RecommendationFeedback.helpful.is_(False), 1), else_=0)),
                0,
            ),
        ).where(
            RecommendationFeedback.created_at >= since,
            RecommendationFeedback.holland_code == holland_code,
            RecommendationFeedback.mbti_type == mbti_type,
            RecommendationFeedback.age_band == age_band,
        )
    )
    sample_size, unhelpful_feedback = result.one()
    sample_size = int(sample_size or 0)
    unhelpful_feedback = int(unhelpful_feedback or 0)
    unhelpful_ratio = round((unhelpful_feedback / sample_size) * 100.0, 2) if sample_size else 0.0
    min_samples = int(settings.recommendation_quality_alert_min_samples)
    threshold = float(settings.recommendation_quality_alert_threshold_percent)
    low_quality_detected = sample_size >= min_samples and unhelpful_ratio >= threshold
    return RecommendationQualitySignal(
        low_quality_detected=low_quality_detected,
        lookback_days=lookback_days,
        sample_size=sample_size,
        unhelpful_ratio=unhelpful_ratio,
        heuristic_applied=low_quality_detected,
        heuristic_note_fa=LOW_QUALITY_HEURISTIC_NOTE_FA if low_quality_detected else None,
    )


def _rank_jobs(
    jobs: list[Job],
    holland_code: str,
    mbti_type: str,
    fit_weights: dict[str, float] | None = None,
) -> list[_RankedJob]:
    effective_weights = fit_weights or _fit_weights(low_quality_detected=False)
    ranked = []
    for job in jobs:
        fit = _combined_fit(
            job.riasec_profile,
            holland_code,
            mbti_type,
            job.market_demand_score,
            job.local_relevance_score,
            effective_weights,
        )
        conf = _confidence(fit, job.deprioritized, bool(job.required_skills))
        ranked.append(_RankedJob(job=job, fit_score=fit, confidence=conf))
    # Non-deprioritized items first (best fit first), deprioritized pushed to the tail.
    ranked.sort(key=lambda r: (r.job.deprioritized, -r.fit_score))
    return ranked


def _rank_majors(
    majors: list[Major],
    holland_code: str,
    mbti_type: str,
    fit_weights: dict[str, float] | None = None,
) -> list[_RankedMajor]:
    effective_weights = fit_weights or _fit_weights(low_quality_detected=False)
    ranked = []
    for major in majors:
        fit = _combined_fit(
            major.riasec_profile,
            holland_code,
            mbti_type,
            major.market_demand_score,
            major.local_relevance_score,
            effective_weights,
        )
        conf = _confidence(fit, major.deprioritized, bool(major.core_skills))
        ranked.append(_RankedMajor(major=major, fit_score=fit, confidence=conf))
    ranked.sort(key=lambda r: (r.major.deprioritized, -r.fit_score))
    return ranked


def _job_to_schema(ranked: _RankedJob, quality_note_fa: str | None = None) -> JobRecommendation:
    job = ranked.job
    why_fa = (
        job.why_fa
        or "این گزینه به دلیل همخوانی مناسب با الگوی رغبت/شخصیت شما و وضعیت تقاضای بازار در فهرست پیشنهادها قرار گرفته است."
    )
    return JobRecommendation(
        title=job.canonical_title,
        title_fa=job.canonical_title_fa,
        fit_score=ranked.fit_score,
        confidence=ranked.confidence,
        why_fa=why_fa,
        taxonomy_source=job.taxonomy_source,
        taxonomy_code=job.taxonomy_code,
        education_level=job.education_level,
        market_demand_score=job.market_demand_score,
        future_outlook=job.future_outlook,
        salary_band=job.salary_band,
        deprioritized=job.deprioritized,
        warning_fa=DEPRIORITIZED_WARNING_FA if job.deprioritized else None,
        quality_note_fa=quality_note_fa,
    )


def _major_to_schema(ranked: _RankedMajor, quality_note_fa: str | None = None) -> MajorRecommendation:
    major = ranked.major
    why_fa = (
        major.why_fa
        or "این رشته بر اساس همخوانی با علایق و تیپ شخصیتی شما و چشم‌انداز بازار کار پیشنهاد شده است."
    )
    return MajorRecommendation(
        title=major.canonical_title,
        title_fa=major.canonical_title_fa,
        fit_score=ranked.fit_score,
        confidence=ranked.confidence,
        why_fa=why_fa,
        degree_level=major.degree_level,
        market_demand_score=major.market_demand_score,
        future_outlook=major.future_outlook,
        related_job_titles=major.related_job_titles or [],
        deprioritized=major.deprioritized,
        warning_fa=DEPRIORITIZED_WARNING_FA if major.deprioritized else None,
        quality_note_fa=quality_note_fa,
    )


async def build_recommendations_v2(
    session: AsyncSession,
    holland_code: str,
    mbti_type: str,
    age: int,
    limit: int = 8,
) -> RecommendationResponseV2:
    age_band = age_to_band(age)
    weights = _AGE_BAND_WEIGHTS[age_band]
    quality_signal = await _load_quality_signal(session, holland_code, mbti_type, age_band)
    fit_weights = _fit_weights(quality_signal.low_quality_detected)

    job_slots = max(1, round(limit * weights["job_share"]))
    major_slots = max(1, round(limit * weights["major_share"]))

    eligible_jobs = await _fetch_eligible_jobs(session, age_band)
    eligible_majors = await _fetch_eligible_majors(session, age_band)

    ranked_jobs = _rank_jobs(eligible_jobs, holland_code, mbti_type, fit_weights)[:job_slots]
    ranked_majors = _rank_majors(eligible_majors, holland_code, mbti_type, fit_weights)[:major_slots]

    quality_note_fa = quality_signal.heuristic_note_fa if quality_signal.heuristic_applied else None
    careers = [_job_to_schema(r, quality_note_fa=quality_note_fa) for r in ranked_jobs]
    majors = [_major_to_schema(r, quality_note_fa=quality_note_fa) for r in ranked_majors]

    all_confidences = [r.confidence for r in ranked_jobs] + [r.confidence for r in ranked_majors]
    confidence_score = round(sum(all_confidences) / len(all_confidences), 1) if all_confidences else 40.0
    if quality_signal.heuristic_applied:
        confidence_score = max(round(confidence_score - 4.0, 1), 20.0)
        track_recommendation_heuristic_applied(
            holland_code=holland_code,
            mbti_type=mbti_type,
            age_band=age_band,
            unhelpful_ratio=quality_signal.unhelpful_ratio,
            sample_size=quality_signal.sample_size,
        )

    return RecommendationResponseV2(
        age_band=age_band,
        careers=careers,
        majors=majors,
        confidence_score=confidence_score,
        quality_signal=quality_signal if quality_signal.sample_size > 0 else None,
    )
