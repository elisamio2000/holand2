// ============================================
// CreateDraftForm — form to create a new question/formula draft
// ============================================

'use client';

import React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContentDraftCreateInput, ContentKind } from '@/types/expert-lab.types';

interface CreateDraftFormProps {
  onCreate: (input: ContentDraftCreateInput) => Promise<unknown>;
}

export function CreateDraftForm({ onCreate }: CreateDraftFormProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ContentKind>('question');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && author.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({ kind, title: title.trim(), body: body.trim(), author: author.trim() });
      setTitle('');
      setBody('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-muted bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">{t('expertLab.form.kind')}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ContentKind)}
            className="rounded-lg border border-muted px-3 py-2 text-sm"
          >
            <option value="question">{t('expertLab.kind.question')}</option>
            <option value="formula">{t('expertLab.kind.formula')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">{t('expertLab.form.author')}</span>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="rounded-lg border border-muted px-3 py-2 text-sm"
            placeholder="analyst@holand.dev"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-gray-700">{t('expertLab.form.title')}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border border-muted px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-gray-700">{t('expertLab.form.body')}</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="rounded-lg border border-muted px-3 py-2 text-sm"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('expertLab.form.create')}
      </button>
    </form>
  );
}
