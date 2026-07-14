// ============================================
// Assessment History Store (Zustand)
// Tracks a lightweight local record of assessment sessions the current
// browser/user has started or completed, persisted to localStorage. Used by
// the "My Assessments" history page as a fallback when the backend is
// unavailable, and as the source for ageBand / progressPercent (fields the
// backend does not store).
// ============================================

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssessmentHistoryItem } from '@/types/assessment.types';

interface AssessmentHistoryState {
  entries: AssessmentHistoryItem[];
  upsertEntry: (entry: AssessmentHistoryItem) => void;
  /** Remove all entries for sessions no longer present in the backend list. */
  pruneToIds: (keepIds: Set<string>) => void;
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
      pruneToIds(keepIds) {
        const current = get().entries;
        const pruned = current.filter((e) => keepIds.has(e.sessionId));
        if (pruned.length !== current.length) {
          set({ entries: pruned });
        }
      },
    }),
    { name: 'holand-assessment-history' }
  )
);
