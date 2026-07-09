'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { BoardSnapshot, BoardRecord } from '../lib/board-types';

export interface BoardEditorContextValue {
  board: BoardRecord;
  snapshot: BoardSnapshot;
  selectedIds: string[];
  readOnly: boolean;
}

const BoardEditorContext = createContext<BoardEditorContextValue | null>(null);

export function BoardEditorProvider({
  value,
  children,
}: {
  value: BoardEditorContextValue;
  children: ReactNode;
}) {
  return <BoardEditorContext.Provider value={value}>{children}</BoardEditorContext.Provider>;
}

export function useBoardEditorContext(): BoardEditorContextValue {
  const ctx = useContext(BoardEditorContext);
  if (!ctx) {
    throw new Error('useBoardEditorContext must be used within BoardEditorProvider');
  }
  return ctx;
}

export function useBoardEditorContextOptional(): BoardEditorContextValue | null {
  return useContext(BoardEditorContext);
}
