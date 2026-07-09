"""Generic version-governance helpers shared by AssessmentVersion and
ScoringFormulaVersion (Phase 2).

Implements the workflow from docs/questionnaire-scoring-design-fa.md #4/#6/#7:
draft -> reviewed -> approved -> published -> archived, with rollback and a
full audit trail (``VersionAuditLog``).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.assessment import VersionAuditLog, VersionEntityType, VersionStatus

__all__ = [
    "VersioningError",
    "ALLOWED_TRANSITIONS",
    "assert_transition_allowed",
    "log_transition",
]


class VersioningError(ValueError):
    """Raised when a version status transition is not allowed."""


class _Versionable(Protocol):
    id: str
    status: VersionStatus


# Explicit allow-list of status transitions. Rollback is handled separately
# (it creates a brand-new version rather than mutating an existing one).
ALLOWED_TRANSITIONS: dict[VersionStatus, set[VersionStatus]] = {
    VersionStatus.DRAFT: {VersionStatus.REVIEWED},
    VersionStatus.REVIEWED: {VersionStatus.APPROVED, VersionStatus.DRAFT},
    VersionStatus.APPROVED: {VersionStatus.PUBLISHED, VersionStatus.DRAFT},
    VersionStatus.PUBLISHED: {VersionStatus.ARCHIVED},
    VersionStatus.ARCHIVED: set(),
}


def assert_transition_allowed(current: VersionStatus, target: VersionStatus) -> None:
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise VersioningError(
            f"Cannot transition from '{current.value}' to '{target.value}'. "
            f"Allowed next states: {sorted(s.value for s in allowed) or 'none'}"
        )


async def log_transition(
    db: AsyncSession,
    *,
    entity_type: VersionEntityType,
    entity_id: str,
    action: str,
    from_status: VersionStatus | str | None,
    to_status: VersionStatus | str | None,
    actor: str | None,
    note: str | None = None,
) -> VersionAuditLog:
    entry = VersionAuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        from_status=from_status.value if isinstance(from_status, VersionStatus) else from_status,
        to_status=to_status.value if isinstance(to_status, VersionStatus) else to_status,
        actor=actor,
        note=note,
        created_at=datetime.now(timezone.utc),  # noqa: UP017
    )
    db.add(entry)
    await db.flush()
    return entry
