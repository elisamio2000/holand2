"""Expert Lab router — draft / review / publish workflow for questions & formulas."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..models.expert_lab import DraftStatus
from ..schemas import (
    ContentDraftCreate,
    ContentDraftOut,
    ContentVersionCreate,
    ContentVersionOut,
    ReviewDecision,
)
from ..security import limiter
from ..services import expert_lab as expert_lab_service
from ..services.expert_lab import InvalidTransitionError

router = APIRouter(prefix="/expert-lab", tags=["Expert Lab"])
settings = get_settings()
_write_limit = f"{settings.rate_limit_expert_lab_writes_per_minute}/minute"


async def _get_draft_or_404(db: AsyncSession, draft_id: str):
    draft = await expert_lab_service.get_draft(db, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.post("/drafts", response_model=ContentDraftOut, status_code=201)
@limiter.limit(_write_limit)
async def create_draft(
    request: Request, payload: ContentDraftCreate, db: AsyncSession = Depends(get_db)
) -> ContentDraftOut:
    draft = await expert_lab_service.create_draft(db, payload)
    return ContentDraftOut.model_validate(draft)


@router.get("/drafts", response_model=list[ContentDraftOut])
async def list_drafts(
    status: DraftStatus | None = None, db: AsyncSession = Depends(get_db)
) -> list[ContentDraftOut]:
    drafts = await expert_lab_service.list_drafts(db, status=status)
    return [ContentDraftOut.model_validate(d) for d in drafts]


@router.get("/drafts/{draft_id}", response_model=ContentDraftOut)
async def get_draft(draft_id: str, db: AsyncSession = Depends(get_db)) -> ContentDraftOut:
    draft = await _get_draft_or_404(db, draft_id)
    return ContentDraftOut.model_validate(draft)


@router.post("/drafts/{draft_id}/revisions", response_model=ContentVersionOut, status_code=201)
@limiter.limit(_write_limit)
async def add_revision(
    request: Request, draft_id: str, payload: ContentVersionCreate, db: AsyncSession = Depends(get_db)
) -> ContentVersionOut:
    draft = await _get_draft_or_404(db, draft_id)
    try:
        version = await expert_lab_service.add_revision(db, draft, payload)
    except InvalidTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ContentVersionOut.model_validate(version)


@router.post("/drafts/{draft_id}/submit", response_model=ContentVersionOut)
@limiter.limit(_write_limit)
async def submit_for_review(
    request: Request, draft_id: str, db: AsyncSession = Depends(get_db)
) -> ContentVersionOut:
    draft = await _get_draft_or_404(db, draft_id)
    try:
        version = await expert_lab_service.submit_for_review(db, draft)
    except InvalidTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ContentVersionOut.model_validate(version)


@router.post("/drafts/{draft_id}/approve", response_model=ContentVersionOut)
@limiter.limit(_write_limit)
async def approve_draft(
    request: Request, draft_id: str, decision: ReviewDecision, db: AsyncSession = Depends(get_db)
) -> ContentVersionOut:
    draft = await _get_draft_or_404(db, draft_id)
    try:
        version = await expert_lab_service.approve(db, draft, decision)
    except InvalidTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ContentVersionOut.model_validate(version)


@router.post("/drafts/{draft_id}/reject", response_model=ContentVersionOut)
@limiter.limit(_write_limit)
async def reject_draft(
    request: Request, draft_id: str, decision: ReviewDecision, db: AsyncSession = Depends(get_db)
) -> ContentVersionOut:
    draft = await _get_draft_or_404(db, draft_id)
    try:
        version = await expert_lab_service.reject(db, draft, decision)
    except InvalidTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ContentVersionOut.model_validate(version)


@router.post("/drafts/{draft_id}/publish", response_model=ContentVersionOut)
@limiter.limit(_write_limit)
async def publish_draft(
    request: Request, draft_id: str, db: AsyncSession = Depends(get_db)
) -> ContentVersionOut:
    draft = await _get_draft_or_404(db, draft_id)
    try:
        version = await expert_lab_service.publish(db, draft)
    except InvalidTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ContentVersionOut.model_validate(version)
