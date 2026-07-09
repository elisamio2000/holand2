"""Seed the jobs and majors tables from the static datasets.

Usage (from apps/api):
    python -m app.scripts.seed_jobs

Safe to re-run: upserts by canonical_title so it can be used both for the
initial load and for periodic dataset refreshes (docs section 8: quarterly
review cycle, monthly for AI/tech roles).
"""

import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from app.data.jobs_dataset import JOBS_DATASET
from app.data.majors_dataset import MAJORS_DATASET
from app.database import AsyncSessionLocal, engine
from app.models.base import Base
from app.models.job import Job, Major


async def seed_jobs(session) -> int:
    result = await session.execute(select(Job.canonical_title))
    existing = set(result.scalars().all())

    inserted = 0
    now = datetime.now(timezone.utc)
    for entry in JOBS_DATASET:
        if entry["canonical_title"] in existing:
            continue
        session.add(Job(last_verified_at=now, **entry))
        inserted += 1
    return inserted


async def seed_majors(session) -> int:
    result = await session.execute(select(Major.canonical_title))
    existing = set(result.scalars().all())

    inserted = 0
    now = datetime.now(timezone.utc)
    for entry in MAJORS_DATASET:
        if entry["canonical_title"] in existing:
            continue
        session.add(Major(last_verified_at=now, **entry))
        inserted += 1
    return inserted


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        jobs_inserted = await seed_jobs(session)
        majors_inserted = await seed_majors(session)
        await session.commit()

    print(f"Seeded {jobs_inserted} new jobs and {majors_inserted} new majors.")


if __name__ == "__main__":
    asyncio.run(main())
