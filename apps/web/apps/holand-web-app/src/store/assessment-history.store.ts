// ============================================
// Assessment History Store (Zustand)
// Local cache of recently started/completed sessions. Per Phase B (BLK-04),
// this store is a *non-authoritative cache* — the backend (GET /sessions/my
// and GET /sessions/{id}/resume) is the canonical source. The cache is used
// only as a hint/offline fallback and for UI-only fields (ageBand, progress).
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
