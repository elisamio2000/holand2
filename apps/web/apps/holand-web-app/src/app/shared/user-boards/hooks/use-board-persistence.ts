import { useCallback, useEffect, useRef } from 'react';
import type { BoardRecord } from '../lib/board-types';
import { upsertBoard } from '../lib/board-local-storage';
import { scheduleBoardRemoteSync } from '../lib/board-remote-sync';

export function useBoardPersistence(board: BoardRecord | null, debounceMs = 2200) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const persist = useCallback(async (record: BoardRecord) => {
    const updated = { ...record, updatedAt: new Date().toISOString() };
    await upsertBoard(updated);
    scheduleBoardRemoteSync({
      id: updated.id,
      title: updated.title,
      purpose: updated.purpose,
      caseId: updated.caseId,
      snapshot: updated.snapshot,
    });
    return updated;
  }, []);

  const schedulePersist = useCallback(() => {
    if (!boardRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (boardRef.current) void persist(boardRef.current);
    }, debounceMs);
  }, [debounceMs, persist]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!boardRef.current) return null;
    return persist(boardRef.current);
  }, [persist]);

  return { schedulePersist, flush, persist };
}
