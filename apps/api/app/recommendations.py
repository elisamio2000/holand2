from typing import Dict, List

from .schemas import RecommendationItem


CAREER_BY_HOLLAND_PREFIX: Dict[str, List[Dict[str, str]]] = {
    "RIA": [
        {"title": "Data Scientist", "why": "تحلیل، حل مسئله و تفکر سیستمی"},
        {"title": "R&D Engineer", "why": "ترکیب کار فنی و نوآوری"},
        {"title": "Product Analyst", "why": "تحلیل رفتار کاربر و بهبود محصول"},
    ],
    "SIA": [
        {"title": "School Counselor", "why": "تعامل انسانی و تحلیل فردی"},
        {"title": "Learning Designer", "why": "طراحی تجربه یادگیری خلاق"},
        {"title": "Career Coach", "why": "کمک به رشد و تصمیم گیری مسیر"},
    ],
    "ECS": [
        {"title": "Business Development", "why": "رهبری، مذاکره و ساختار"},
        {"title": "Sales Manager", "why": "اثرگذاری و هدایت تیم"},
        {"title": "Operations Manager", "why": "اجرای دقیق و مدیریت فرایند"},
    ],
}

MAJOR_BY_HOLLAND_PREFIX: Dict[str, List[Dict[str, str]]] = {
    "RIA": [
        {"title": "Computer Science", "why": "تحلیل داده و الگوریتم"},
        {"title": "Industrial Engineering", "why": "بهینه سازی سیستم ها"},
        {"title": "Applied Mathematics", "why": "مدل سازی و استدلال کمی"},
    ],
    "SIA": [
        {"title": "Psychology", "why": "شناخت رفتار انسان"},
        {"title": "Educational Sciences", "why": "طراحی فرایند یادگیری"},
        {"title": "Social Work", "why": "کمک حرفه ای و توسعه اجتماعی"},
    ],
    "ECS": [
        {"title": "Business Management", "why": "رهبری و تصمیم گیری"},
        {"title": "Economics", "why": "تحلیل بازار و سیاست گذاری"},
        {"title": "Accounting", "why": "دقت، نظم و کار با داده"},
    ],
}


def _fit_boost(mbti_type: str, base: float, title: str) -> float:
    score = base
    if mbti_type.startswith("E") and "Manager" in title:
        score += 4.0
    if mbti_type.startswith("I") and ("Scientist" in title or "Analyst" in title):
        score += 4.0
    return min(score, 99.0)


def build_recommendations(holland_code: str, mbti_type: str):
    prefix = holland_code.upper()[:3]

    careers_source = CAREER_BY_HOLLAND_PREFIX.get(prefix, [
        {"title": "General Career Exploration", "why": "نیاز به داده بیشتر برای دقت بالاتر"}
    ])
    majors_source = MAJOR_BY_HOLLAND_PREFIX.get(prefix, [
        {"title": "General Major Exploration", "why": "نیاز به داده بیشتر برای دقت بالاتر"}
    ])

    careers = []
    majors = []

    for idx, item in enumerate(careers_source):
        fit = _fit_boost(mbti_type, 84.0 - (idx * 4.0), item["title"])
        careers.append(
            RecommendationItem(
                title=item["title"],
                fit_score=round(fit, 1),
                why=item["why"],
            )
        )

    for idx, item in enumerate(majors_source):
        fit = 82.0 - (idx * 3.5)
        majors.append(
            RecommendationItem(
                title=item["title"],
                fit_score=round(max(min(fit, 99.0), 40.0), 1),
                why=item["why"],
            )
        )

    return careers, majors
