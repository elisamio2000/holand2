"""Expert Lab: versioned draft/review/publish workflow for questions & scoring formulas.

Matches week-6 plan item: "پنل پایه تحلیل گر خبره برای ویرایش Draft و انتشار نسخه"
(basic expert-analyst panel for editing drafts and publishing versions).
"""

import enum

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, new_uuid


class DraftStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"


class ContentKind(str, enum.Enum):
    QUESTION = "question"
    FORMULA = "formula"


class ContentDraft(Base, TimestampMixin):
    """A logical piece of content (a question or scoring formula) tracked across versions."""

    __tablename__ = "content_drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    kind: Mapped[ContentKind] = mapped_column(Enum(ContentKind), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    versions: Mapped[list["ContentVersion"]] = relationship(
        back_populates="draft", cascade="all, delete-orphan", order_by="ContentVersion.version_number"
    )


class ContentVersion(Base, TimestampMixin):
    """A single version of a draft, moving through the review -> publish workflow."""

    __tablename__ = "content_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    draft_id: Mapped[str] = mapped_column(ForeignKey("content_drafts.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[DraftStatus] = mapped_column(
        Enum(DraftStatus), nullable=False, default=DraftStatus.DRAFT
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    reviewer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    draft: Mapped["ContentDraft"] = relationship(back_populates="versions")
