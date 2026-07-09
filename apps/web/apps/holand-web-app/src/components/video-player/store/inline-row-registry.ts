'use client';

import { create } from 'zustand';

/** Ensures only one ultraCompact row runs inline playback at a time. */
interface InlineRowRegistry {
  activeRowId: string | null;
  claim: (rowId: string) => void;
  release: (rowId: string) => void;
  isActive: (rowId: string) => boolean;
}

export const useInlineRowRegistry = create<InlineRowRegistry>((set, get) => ({
  activeRowId: null,
  claim: (rowId) => set({ activeRowId: rowId }),
  release: (rowId) => {
    if (get().activeRowId === rowId) set({ activeRowId: null });
  },
  isActive: (rowId) => get().activeRowId === rowId,
}));
