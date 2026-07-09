"""Persian multi-layer interpretation engine (Phase 5).

Implements the "explainable, non-deterministic, layered" report standard
captured in docs/esanj-benchmark-and-interpretation-requirements-fa.md
section 7:
    Layer 1 - Psychometric interpretation (Holland/MBTI)
    Layer 2 - Behavioral / work-environment fit
    Layer 3 - Career & major suggestions with market-aware reasoning
    Layer 4 - Skill growth action plan
Output shape: Summary Card, Detailed Interpretation, Action Plan
(3/6/12 months), Risk Flags, Confidence Score — all in Persian, using
cautious, non-deterministic language (section 7.3 / job-taxonomy doc section 7).
"""

from typing import Dict

from ..schemas import (
    ActionPlan,
    LayeredInterpretation,
    RecommendationResponseV2,
    SummaryCard,
)

_HOLLAND_LETTER_FA = {
    "R": "واقع‌گرا (علاقه به کار عملی، ابزار و ساخت)",
    "I": "جستجوگر/تحلیلی (علاقه به کنجکاوی علمی و حل مسئله)",
    "A": "هنری (علاقه به خلاقیت و بیان ایده به شکل بصری یا نوشتاری)",
    "S": "اجتماعی (علاقه به کمک، آموزش و تعامل انسانی)",
    "E": "متهور/کارآفرین (علاقه به رهبری، متقاعدسازی و ریسک محاسبه‌شده)",
    "C": "قراردادی/سازمان‌یافته (علاقه به نظم، دقت و کار ساختاریافته)",
}

_MBTI_LETTER_FA = {
    "E": "انرژی خود را بیشتر از تعامل با دیگران و محیط بیرونی می‌گیرد",
    "I": "انرژی خود را بیشتر از تمرکز درونی و کار مستقل بازیابی می‌کند",
    "S": "تمایل دارد به واقعیت‌های ملموس و جزئیات عملی توجه کند",
    "N": "تمایل دارد به الگوهای کلی، امکانات آینده و ایده‌های انتزاعی توجه کند",
    "T": "در تصمیم‌گیری بیشتر به تحلیل منطقی و معیارهای عینی تکیه می‌کند",
    "F": "در تصمیم‌گیری بیشتر به ارزش‌ها و تاثیر بر افراد توجه می‌کند",
    "J": "ترجیح می‌دهد کارها برنامه‌ریزی‌شده و با ساختار مشخص پیش برود",
    "P": "ترجیح می‌دهد با انعطاف و گشودگی نسبت به تغییر مسیر پیش برود",
}

_AGE_BAND_NOTE_FA = {
    "13-17": (
        "در این بازه سنی، نتایج بیشتر برای شناخت علایق کلی و انتخاب رشته "
        "تحصیلی مناسب است؛ تصمیم قطعی شغلی زودهنگام توصیه نمی‌شود."
    ),
    "18-24": (
        "در این بازه سنی، نتایج می‌تواند برای انتخاب رشته دانشگاهی یا "
        "مسیرهای شغلی ورودی راهنما باشد."
    ),
    "25-30": (
        "در این بازه سنی، تمرکز بیشتر بر تثبیت مسیر شغلی و توسعه مهارت‌های "
        "تخصصی معنادار است."
    ),
    "30+": (
        "در این بازه سنی، نتایج بیشتر برای ارزیابی تغییر مسیر شغلی یا "
        "ارتقای تخصص در مسیر فعلی کاربرد دارد."
    ),
}


def _certainty_avg(certainty: Dict[str, float]) -> float:
    if not certainty:
        return 50.0
    return sum(certainty.values()) / len(certainty)


def _describe_holland(top3_code: str, normalized_scores: Dict[str, float]) -> str:
    parts = []
    for letter in top3_code:
        pct = normalized_scores.get(letter)
        desc = _HOLLAND_LETTER_FA.get(letter, letter)
        if pct is not None:
            parts.append(f"{desc} ({pct:.0f}٪)")
        else:
            parts.append(desc)
    return (
        f"کد رغبت سه‌حرفی شما {top3_code} است. این بدان معناست که بیش از هر چیز به "
        + "، ".join(parts)
        + " گرایش دارید. این ترکیب یک تصویر اولیه از علایق شماست، نه یک برچسب ثابت."
    )


def _describe_mbti(mbti_type: str, certainty: Dict[str, float]) -> str:
    letters = list(mbti_type)
    descs = [_MBTI_LETTER_FA.get(letter, letter) for letter in letters]
    avg_certainty = _certainty_avg(certainty)
    certainty_note = (
        "این تیپ با قطعیت نسبتا بالایی محاسبه شده است."
        if avg_certainty >= 65
        else "برخی ابعاد این تیپ نزدیک به مرز بوده‌اند، بنابراین قطعیت آن متوسط است."
    )
    return (
        f"تیپ شخصیتی شما بر اساس پاسخ‌ها {mbti_type} برآورد شده است. شما "
        + "؛ ".join(descs)
        + f". {certainty_note}"
    )


def _behavioral_fit_fa(top3_code: str, mbti_type: str) -> str:
    env_bits = []
    if "S" in top3_code or "F" in mbti_type:
        env_bits.append("محیط‌هایی با تعامل انسانی و کار تیمی معنادار")
    if "I" in top3_code or "T" in mbti_type:
        env_bits.append("محیط‌هایی با فرصت تحلیل، حل مسئله و یادگیری مستمر")
    if "E" in top3_code or "E" in mbti_type:
        env_bits.append("محیط‌هایی با فرصت رهبری، ابتکار و اثرگذاری")
    if "C" in top3_code or "J" in mbti_type:
        env_bits.append("محیط‌هایی با ساختار، نظم و انتظارات شفاف")
    if "A" in top3_code or "P" in mbti_type:
        env_bits.append("محیط‌هایی با انعطاف و فضای بیان خلاقیت")
    if "R" in top3_code:
        env_bits.append("محیط‌هایی با کار عملی و ملموس")

    if not env_bits:
        env_bits.append("محیط‌های کاری متنوع با بازخورد واضح")

    unique_bits = list(dict.fromkeys(env_bits))[:3]
    return (
        "بر اساس ترکیب رغبت و شخصیت، به نظر می‌رسد بیشترین رضایت شغلی شما در "
        + "، ".join(unique_bits)
        + " باشد. این یک گرایش عمومی است و محیط واقعی کار به عوامل دیگری مثل تیم و مدیریت هم بستگی دارد."
    )


def _career_major_fa(recommendations: RecommendationResponseV2) -> str:
    if not recommendations.careers and not recommendations.majors:
        return "داده کافی برای پیشنهاد مشخص شغلی یا رشته در حال حاضر موجود نیست."

    bits = []
    if recommendations.careers:
        top_job = recommendations.careers[0]
        bits.append(
            f"در میان مشاغل، «{top_job.title_fa}» با میزان همخوانی {top_job.fit_score:.0f}٪ "
            f"در اولویت قرار دارد؛ دلیل اصلی: {top_job.why_fa}."
        )
    if recommendations.majors:
        top_major = recommendations.majors[0]
        bits.append(
            f"در میان رشته‌های تحصیلی، «{top_major.title_fa}» با میزان همخوانی "
            f"{top_major.fit_score:.0f}٪ در اولویت قرار دارد؛ دلیل اصلی: {top_major.why_fa}."
        )
    bits.append(
        "این پیشنهادها بر پایه رده‌بندی استاندارد مشاغل و وضعیت تقاضای بازار تنظیم شده‌اند "
        "و باید همراه با گفتگو با مشاور و بررسی علاقه شخصی نهایی شوند."
    )
    return " ".join(bits)


def _skill_growth_fa(recommendations: RecommendationResponseV2) -> str:
    if not recommendations.careers:
        return "برای ارائه برنامه مهارتی دقیق‌تر، تکمیل اطلاعات بیشتر لازم است."
    top_job = recommendations.careers[0]
    if not top_job.title_fa:
        return "برای ارائه برنامه مهارتی دقیق‌تر، تکمیل اطلاعات بیشتر لازم است."
    return (
        f"برای نزدیک شدن به مسیر «{top_job.title_fa}»، تمرکز تدریجی و مستمر بر مهارت‌های "
        "مرتبط توصیه می‌شود. رشد مهارتی یک فرایند پیوسته است، نه یک نتیجه یک‌باره؛ "
        "تلاش منظم و ارزیابی دوره‌ای پیشرفت اهمیت زیادی دارد."
    )


def build_interpretation(
    holland_code: str,
    normalized_scores: Dict[str, float],
    mbti_type: str,
    mbti_certainty: Dict[str, float],
    age_band: str,
    recommendations: RecommendationResponseV2,
) -> LayeredInterpretation:
    return LayeredInterpretation(
        psychometric_fa=(
            _describe_holland(holland_code, normalized_scores)
            + " "
            + _describe_mbti(mbti_type, mbti_certainty)
        ),
        behavioral_fit_fa=_behavioral_fit_fa(holland_code, mbti_type),
        career_major_fa=_career_major_fa(recommendations) + " " + _AGE_BAND_NOTE_FA.get(age_band, ""),
        skill_growth_fa=_skill_growth_fa(recommendations),
    )


def build_summary_card(
    holland_code: str,
    mbti_type: str,
    age_band: str,
    recommendations: RecommendationResponseV2,
) -> SummaryCard:
    top_careers = [c.title_fa for c in recommendations.careers[:3]]
    top_majors = [m.title_fa for m in recommendations.majors[:3]]
    headline = (
        f"کد رغبت {holland_code} و تیپ شخصیتی {mbti_type}: تصویری اولیه و قابل بازنگری از "
        "علایق و نقاط قوت شما که با رشد و تجربه می‌تواند دقیق‌تر شود."
    )
    return SummaryCard(
        holland_code=holland_code,
        mbti_type=mbti_type,
        age_band=age_band,
        headline_fa=headline,
        top_careers_fa=top_careers,
        top_majors_fa=top_majors,
    )


def build_action_plan(recommendations: RecommendationResponseV2, age_band: str) -> ActionPlan:
    short_term = [
        "نتایج این گزارش را با یک مشاور یا فرد قابل اعتماد در میان بگذارید.",
        "درباره ۲ تا ۳ گزینه شغلی/تحصیلی برتر این گزارش بیشتر جستجو کنید.",
    ]
    mid_term = [
        "یک مهارت پایه مرتبط با گزینه برتر را از طریق دوره کوتاه یا تمرین عملی شروع کنید.",
        "با یک فرد فعال در حوزه پیشنهادی گفتگو کنید تا واقعیت روزمره آن شغل را بشناسید.",
    ]
    long_term = [
        "پیشرفت خود را در مهارت انتخابی هر چند ماه یک‌بار ارزیابی و آزمون را در صورت نیاز تکرار کنید.",
        "بر اساس تجربه به‌دست‌آمده، مسیر تحصیلی/شغلی را در صورت لزوم تنظیم کنید.",
    ]

    if age_band == "13-17":
        short_term.insert(0, "روی شناخت بهتر رشته‌های تحصیلی مرتبط با علایق خود تمرکز کنید.")
    elif age_band == "30+":
        mid_term.insert(0, "امکان تغییر مسیر یا ارتقای مهارت را بدون فشار زمانی غیرواقعی بررسی کنید.")

    return ActionPlan(
        short_term_3_months_fa=short_term,
        mid_term_6_months_fa=mid_term,
        long_term_12_months_fa=long_term,
    )


def build_risk_flags(
    holland_certainty_avg: float,
    mbti_certainty: Dict[str, float],
    age_band: str,
    recommendations: RecommendationResponseV2,
) -> list[str]:
    flags = [
        "این ابزار یک غربالگری روان‌سنجی است، نه یک تشخیص قطعی یا حکم نهایی درباره آینده شما.",
    ]

    avg_mbti_certainty = _certainty_avg(mbti_certainty)
    if avg_mbti_certainty < 60:
        flags.append(
            "قطعیت برخی ابعاد شخصیتی نزدیک به مرز است؛ نتیجه ممکن است در آزمون بعدی کمی تغییر کند."
        )
    if holland_certainty_avg < 60:
        flags.append("پراکندگی نمرات رغبت نسبتا کم است؛ توصیه می‌شود بعدا دوباره آزمون را تکمیل کنید.")

    if age_band == "13-17":
        flags.append(_AGE_BAND_NOTE_FA["13-17"])

    if any(c.deprioritized for c in recommendations.careers) or any(
        m.deprioritized for m in recommendations.majors
    ):
        flags.append(
            "برخی گزینه‌های نمایش داده شده به دلیل کاهش تقاضای بازار در انتهای لیست و با هشدار آمده‌اند."
        )

    return flags


def build_confidence_score(
    holland_certainty_avg: float,
    mbti_certainty: Dict[str, float],
    recommendations_confidence: float,
) -> float:
    avg_mbti_certainty = _certainty_avg(mbti_certainty)
    combined = (holland_certainty_avg + avg_mbti_certainty + recommendations_confidence) / 3
    return round(min(max(combined, 20.0), 99.0), 1)
