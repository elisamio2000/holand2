// ============================================
// DraftCard — single draft with version history and workflow actions
// ============================================

'use client';

import React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from './status-badge';
import type { ContentDraft, ReviewDecisionInput } from '@/types/expert-lab.types';

interface DraftCardProps {
  draft: ContentDraft;
  onSubmitForReview: (draftId: string) => Promise<void>;
  onApprove: (draftId: string, decision: ReviewDecisionInput) => Promise<void>;
  onReject: (draftId: string, decision: ReviewDecisionInput) => Promise<void>;
  onPublish: (draftId: string) => Promise<void>;
}

export function DraftCard({ draft, onSubmitForReview, onApprove, onReject, onPublish }: DraftCardProps) {
  const { t } = useTranslation();
  const [reviewer, setReviewer] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const latest = [...draft.versions].sort((a, b) => b.version_number - a.version_number)[0];
  if (!latest) return null;

  async function withBusy(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article data-testid="draft-card" className="rounded-xl border border-muted bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            {t(`expertLab.kind.${draft.kind}`)}
          </p>
          <h3 className="mt-1 text-base font-semibold text-gray-900">{draft.title}</h3>
          <p className="mt-1 text-xs text-gray-500">{t('expertLab.version', { number: latest.version_number })}</p>
        </div>
        <StatusBadge status={latest.status} />
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{latest.body}</p>

      {latest.reviewer && (
        <p className="mt-2 text-xs text-gray-500">
          {t('expertLab.form.reviewer')}: {latest.reviewer}
          {latest.review_notes ? ` — ${latest.review_notes}` : ''}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {latest.status === 'draft' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => withBusy(() => onSubmitForReview(draft.id))}
            className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {t('expertLab.form.submitForReview')}
          </button>
        )}

        {latest.status === 'in_review' && (
          <>
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder={t('expertLab.form.reviewer') as string}
              className="rounded-lg border border-muted px-2 py-1 text-xs"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('expertLab.form.notes') as string}
              className="rounded-lg border border-muted px-2 py-1 text-xs"
            />
            <button
              type="button"
              disabled={busy || !reviewer.trim()}
              onClick={() => withBusy(() => onApprove(draft.id, { reviewer: reviewer.trim(), notes: notes.trim() || undefined }))}
              className="rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {t('expertLab.form.approve')}
            </button>
            <button
              type="button"
              disabled={busy || !reviewer.trim()}
              onClick={() => withBusy(() => onReject(draft.id, { reviewer: reviewer.trim(), notes: notes.trim() || undefined }))}
              className="rounded-lg border border-red-600 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {t('expertLab.form.reject')}
            </button>
          </>
        )}

        {latest.status === 'approved' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => withBusy(() => onPublish(draft.id))}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {t('expertLab.form.publish')}
          </button>
        )}
      </div>
    </article>
  );
}
