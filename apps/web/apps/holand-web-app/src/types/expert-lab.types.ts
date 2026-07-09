// ============================================
// Expert Lab types — mirrors apps/api/app/schemas.py (Expert Lab section)
// ============================================

export type ContentKind = 'question' | 'formula';

export type DraftStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'published';

export interface ContentVersion {
  id: string;
  draft_id: string;
  version_number: number;
  status: DraftStatus;
  body: string;
  author: string;
  reviewer: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentDraft {
  id: string;
  kind: ContentKind;
  title: string;
  versions: ContentVersion[];
}

export interface ContentDraftCreateInput {
  kind: ContentKind;
  title: string;
  body: string;
  author: string;
}

export interface ContentVersionCreateInput {
  body: string;
  author: string;
}

export interface ReviewDecisionInput {
  reviewer: string;
  notes?: string;
}
