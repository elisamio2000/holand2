"""Idempotent, chunked backfill for ``run_code``/``participant_code`` on
existing ``assessment_sessions`` rows (Phase B: Assessment Runtime
Integrity).

Safe to run multiple times: only rows where ``run_code IS NULL`` (or
``participant_code IS NULL``) are touched, and each row is committed in
small batches so a restart resumes roughly where it left off rather than
redoing already-backfilled rows. Must run *after* the additive migration
(20260714_01) and *before* the follow-up migration that hardens ``run_code``
to NOT NULL + unique.

Run with:

    python -m app.scripts.backfill_run_codes
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import AsyncSessionLocal
from ..models.session import AssessmentSession
from ..services.run_codes import generate_participant_code, generate_run_code

logger = logging.getLogger(__name__)

BATCH_SIZE = 200
MAX_COLLISION_RETRIES = 5


async def _generate_unique_run_code(db: AsyncSession, taken: set[str]) -> str:
    for _ in range(MAX_COLLISION_RETRIES):
        candidate = generate_run_code()
        if candidate in taken:
            continue
        existing = await db.execute(
            select(AssessmentSession.id).where(AssessmentSession.run_code == candidate)
        )
        if existing.scalar_one_or_none() is None:
            taken.add(candidate)
            return candidate
    raise RuntimeError("Could not generate a unique run_code after retries")


async def backfill_run_codes() -> int:
    """Backfill missing run_code/participant_code values. Returns rows updated."""
    updated = 0
    taken: set[str] = set()

    async with AsyncSessionLocal() as db:
        while True:
            result = await db.execute(
                select(AssessmentSession)
                .where(AssessmentSession.run_code.is_(None))
                .order_by(AssessmentSession.started_at.asc())
                .limit(BATCH_SIZE)
            )
            batch = result.scalars().all()
            if not batch:
                break

            for session in batch:
                session.run_code = await _generate_unique_run_code(db, taken)
                if session.participant_code is None:
                    session.participant_code = generate_participant_code(session.user_id)
                updated += 1

            await db.commit()
            logger.info("[BackfillRunCodes] Committed batch of %d (total %d)", len(batch), updated)

    return updated


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    count = asyncio.run(backfill_run_codes())
    logger.info("[BackfillRunCodes] Done. %d session(s) updated.", count)
