"""Expert Lab service: draft -> in_review -> approved/rejected -> published workflow.

Analyst creates/edits a draft version; a reviewer approves or rejects it;
an approved version can then be published. Every edit creates a new version so
the full history is preserved (matches "تاریخچه تغییرات" in the MVP plan).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.expert_lab import ContentDraft, ContentKind, ContentVersion, DraftStatus
from ..schemas import ContentDraftCreate, ContentVersionCreate, ReviewDecision


class InvalidTransitionError(ValueError):
    """Raised when a workflow transition is attempted from an invalid status."""


async def create_draft(db: AsyncSession, payload: ContentDraftCreate) -> ContentDraft:
    draft = ContentDraft(kind=ContentKind(payload.kind), title=payload.title)
    first_version = ContentVersion(
        version_number=1,
        status=DraftStatus.DRAFT,
        body=payload.body,
        author=payload.author,
    )
    draft.versions.append(first_version)
    db.add(draft)
    await db.flush()
    await db.refresh(draft, attribute_names=["versions"])
    return draft


async def get_draft(db: AsyncSession, draft_id: str) -> ContentDraft | None:
    result = await db.execute(
        select(ContentDraft)
        .options(selectinload(ContentDraft.versions))
        .where(ContentDraft.id == draft_id)
    )
    return result.scalar_one_or_none()


async def list_drafts(
    db: AsyncSession, status: DraftStatus | None = None
) -> list[ContentDraft]:
    query = select(ContentDraft).options(selectinload(ContentDraft.versions))
    result = await db.execute(query)
    drafts = list(result.scalars().all())
    if status is not None:
        drafts = [d for d in drafts if d.versions and d.versions[-1].status == status]
    return drafts


def _latest_version(draft: ContentDraft) -> ContentVersion:
    return max(draft.versions, key=lambda v: v.version_number)


async def add_revision(
    db: AsyncSession, draft: ContentDraft, payload: ContentVersionCreate
) -> ContentVersion:
    """Create a new draft version (revision) from the latest one."""
    latest = _latest_version(draft)
    if latest.status == DraftStatus.PUBLISHED:
        raise InvalidTransitionError("Cannot revise a published version directly; a new draft revision is required.")

    new_version = ContentVersion(
        draft_id=draft.id,
        version_number=latest.version_number + 1,
        status=DraftStatus.DRAFT,
        body=payload.body,
        author=payload.author,
    )
    db.add(new_version)
    await db.flush()
    await db.refresh(new_version)
    return new_version


async def submit_for_review(db: AsyncSession, draft: ContentDraft) -> ContentVersion:
    latest = _latest_version(draft)
    if latest.status != DraftStatus.DRAFT:
        raise InvalidTransitionError(f"Cannot submit version in status '{latest.status}' for review.")
    latest.status = DraftStatus.IN_REVIEW
    await db.flush()
    await db.refresh(latest)
    return latest


async def approve(db: AsyncSession, draft: ContentDraft, decision: ReviewDecision) -> ContentVersion:
    latest = _latest_version(draft)
    if latest.status != DraftStatus.IN_REVIEW:
        raise InvalidTransitionError(f"Cannot approve version in status '{latest.status}'.")
    latest.status = DraftStatus.APPROVED
    latest.reviewer = decision.reviewer
    latest.review_notes = decision.notes
    await db.flush()
    await db.refresh(latest)
    return latest


async def reject(db: AsyncSession, draft: ContentDraft, decision: ReviewDecision) -> ContentVersion:
    latest = _latest_version(draft)
    if latest.status != DraftStatus.IN_REVIEW:
        raise InvalidTransitionError(f"Cannot reject version in status '{latest.status}'.")
    latest.status = DraftStatus.REJECTED
    latest.reviewer = decision.reviewer
    latest.review_notes = decision.notes
    await db.flush()
    await db.refresh(latest)
    return latest


async def publish(db: AsyncSession, draft: ContentDraft) -> ContentVersion:
    latest = _latest_version(draft)
    if latest.status != DraftStatus.APPROVED:
        raise InvalidTransitionError(f"Cannot publish version in status '{latest.status}'.")
    latest.status = DraftStatus.PUBLISHED
    await db.flush()
    await db.refresh(latest)
    return latest
