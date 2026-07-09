// ============================================
// ExpertLabDashboard — top-level composition for the Expert Lab feature
// ============================================

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useExpertLab } from './use-expert-lab';
import { CreateDraftForm } from './create-draft-form';
import { DraftCard } from './draft-card';

export function ExpertLabDashboard() {
  const { t } = useTranslation();
  const { drafts, isLoading, error, createDraft, submitForReview, approve, reject, publish } = useExpertLab();

  return (
    <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t('expertLab.title')}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">{t('expertLab.subtitle')}</p>

      <section className="mt-6">
        <CreateDraftForm onCreate={createDraft} />
      </section>

      <section className="mt-6 space-y-4">
        {isLoading && <p className="text-sm text-gray-500">…</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {!isLoading && !error && drafts.length === 0 && (
          <p className="text-sm text-gray-500">{t('expertLab.empty')}</p>
        )}
        {drafts.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            onSubmitForReview={submitForReview}
            onApprove={approve}
            onReject={reject}
            onPublish={publish}
          />
        ))}
      </section>
    </main>
  );
}
