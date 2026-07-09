// ============================================
// StatusBadge — small colored badge for a DraftStatus
// ============================================

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DraftStatus } from '@/types/expert-lab.types';

const STATUS_COLORS: Record<DraftStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-700',
  published: 'bg-emerald-100 text-emerald-800',
};

export function StatusBadge({ status }: { status: DraftStatus }) {
  const { t } = useTranslation();
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {t(`expertLab.status.${status}`)}
    </span>
  );
}
