// ============================================
// Assessment History Store (Zustand)
// Tracks a lightweight local record of assessment sessions the current
// browser/user has started or completed, persisted to localStorage. Used by
// the "My Assessments" history page (and as a fallback source when the
// backend history endpoint isn't available yet).
// ============================================

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssessmentHistoryItem } from '@/types/assessment.types';

interface AssessmentHistoryState {
  entries: AssessmentHistoryItem[];
  upsertEntry: (entry: AssessmentHistoryItem) => void;
}

export const useAssessmentHistoryStore = create<AssessmentHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      upsertEntry(entry) {
        const existing = get().entries;
        const index = existing.findIndex((e) => e.sessionId === entry.sessionId);
        if (index === -1) {
          set({ entries: [entry, ...existing] });
          return;
        }
        const next = [...existing];
        next[index] = { ...next[index], ...entry };
        set({ entries: next });
      },
    }),
    { name: 'holand-assessment-history' }
  )
);
