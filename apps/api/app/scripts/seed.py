"""Seed the database with the initial published question banks and default
scoring formulas (Phase 2). Run with:

    python -m app.scripts.seed

Matches the ``make db-seed`` target.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import AsyncSessionLocal
from ..models.assessment import (
    AssessmentType,
    AssessmentVersion,
    Question,
    QuestionOption,
    ScoringFormulaVersion,
    VersionStatus,
)
from .seed_questions_data import HOLLAND_QUESTIONS, MBTI_QUESTIONS

HOLLAND_NORMALIZE_FORMULA = {
    "formula_key": "holland_normalized_score",
    "assessment_type": AssessmentType.HOLLAND,
    "expression": {"expr": "(value / total) * 100 if total > 0 else 0"},
    "input_variables": ["value", "total"],
    "output_metric": "normalized_percentage",
    "validation_rules": {"min": 0, "max": 100},
    "unit_tests": [
        {"variables": {"value": 25, "total": 100}, "expected": 25.0},
        {"variables": {"value": 0, "total": 0}, "expected": 0.0},
    ],
}

MBTI_PREFERENCE_FORMULA = {
    "formula_key": "mbti_preference_percentage",
    "assessment_type": AssessmentType.MBTI,
    "expression": {"expr": "(left / (left + right)) * 100 if (left + right) > 0 else 50"},
    "input_variables": ["left", "right"],
    "output_metric": "preference_percentage",
    "validation_rules": {"min": 0, "max": 100},
    "unit_tests": [
        {"variables": {"left": 8, "right": 2}, "expected": 80.0},
        {"variables": {"left": 0, "right": 0}, "expected": 50.0},
    ],
}


async def _seed_assessment_version(
    db: AsyncSession, assessment_type: AssessmentType, title: str, questions_data: list[dict]
) -> AssessmentVersion:
    existing = await db.execute(
        select(AssessmentVersion).where(
            AssessmentVersion.assessment_type == assessment_type,
            AssessmentVersion.status == VersionStatus.PUBLISHED,
        )
    )
    if existing.scalars().first() is not None:
        print(f"[seed] {assessment_type.value}: published version already exists, skipping.")
        return existing.scalars().first()

    version = AssessmentVersion(
        assessment_type=assessment_type,
        version=1,
        status=VersionStatus.PUBLISHED,
        title=title,
        notes="Initial seeded question bank (Phase 2).",
        created_by="seed-script",
        approved_by="seed-script",
        effective_from=datetime.now(timezone.utc),
    )
    db.add(version)
    await db.flush()

    for q_data in questions_data:
        question = Question(
            assessment_version_id=version.id,
            kind=q_data["kind"],
            dimension=q_data["dimension"],
            text=q_data["text"],
            order_index=q_data["order_index"],
            is_reverse_scored=q_data["is_reverse_scored"],
        )
        db.add(question)
        await db.flush()
        for opt in q_data["options"]:
            db.add(
                QuestionOption(
                    question_id=question.id,
                    label=opt["label"],
                    value=opt["value"],
                    pole=opt["pole"],
                    weight=opt["weight"],
                    order_index=opt["order_index"],
                )
            )

    await db.flush()
    print(f"[seed] {assessment_type.value}: published v1 with {len(questions_data)} questions.")
    return version


async def _seed_formula(db: AsyncSession, formula_def: dict) -> None:
    existing = await db.execute(
        select(ScoringFormulaVersion).where(
            ScoringFormulaVersion.formula_key == formula_def["formula_key"],
            ScoringFormulaVersion.status == VersionStatus.PUBLISHED,
        )
    )
    if existing.scalars().first() is not None:
        print(f"[seed] formula {formula_def['formula_key']}: published version already exists, skipping.")
        return

    formula = ScoringFormulaVersion(
        formula_key=formula_def["formula_key"],
        assessment_type=formula_def["assessment_type"],
        version=1,
        status=VersionStatus.PUBLISHED,
        expression=formula_def["expression"],
        input_variables=formula_def["input_variables"],
        output_metric=formula_def["output_metric"],
        validation_rules=formula_def["validation_rules"],
        unit_tests=formula_def["unit_tests"],
        created_by="seed-script",
        approved_by="seed-script",
        effective_from=datetime.now(timezone.utc),
    )
    db.add(formula)
    await db.flush()
    print(f"[seed] formula {formula_def['formula_key']}: published v1.")


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        await _seed_assessment_version(
            db, AssessmentType.HOLLAND, "Holland RIASEC — نسخه اولیه", HOLLAND_QUESTIONS
        )
        await _seed_assessment_version(
            db, AssessmentType.MBTI, "MBTI — نسخه اولیه", MBTI_QUESTIONS
        )
        await _seed_formula(db, HOLLAND_NORMALIZE_FORMULA)
        await _seed_formula(db, MBTI_PREFERENCE_FORMULA)
        await db.commit()
    print("[seed] done.")


if __name__ == "__main__":
    asyncio.run(seed())
