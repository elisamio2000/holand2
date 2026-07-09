import { useCallback, useEffect, useState } from 'react';
import {
  readBoardPanelPrefs,
  writeBoardPanelPrefs,
  type BoardPanelId,
  type BoardPanelMode,
  type BoardPanelPrefs,
  type BoardPanelState,
} from '../lib/board-panel-prefs';

export function useBoardPanels(boardId: string) {
  const [prefs, setPrefs] = useState<BoardPanelPrefs>(() => readBoardPanelPrefs(boardId));

  useEffect(() => {
    setPrefs(readBoardPanelPrefs(boardId));
  }, [boardId]);

  useEffect(() => {
    writeBoardPanelPrefs(prefs, boardId);
  }, [prefs, boardId]);

  const patchPanel = useCallback((id: BoardPanelId, patch: Partial<BoardPanelState>) => {
    setPrefs((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  }, []);

  const showPanel = useCallback((id: BoardPanelId, mode?: BoardPanelMode) => {
    setPrefs((p) => ({
      ...p,
      [id]: { visible: true, mode: mode ?? 'docked' },
    }));
  }, []);

  const hidePanel = useCallback((id: BoardPanelId) => {
    setPrefs((p) => ({ ...p, [id]: { ...p[id], visible: false } }));
  }, []);

  const togglePanel = useCallback((id: BoardPanelId) => {
    setPrefs((p) => {
      const nextVisible = !p[id].visible;
      return {
        ...p,
        [id]: {
          ...p[id],
          visible: nextVisible,
          mode: nextVisible ? 'docked' : p[id].mode,
        },
      };
    });
  }, []);

  const setPanelMode = useCallback((id: BoardPanelId, mode: BoardPanelMode) => {
    setPrefs((p) => ({ ...p, [id]: { ...p[id], mode } }));
  }, []);

  return { prefs, patchPanel, showPanel, hidePanel, togglePanel, setPanelMode };
}
