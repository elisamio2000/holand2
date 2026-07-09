import type { BoardPanelMode } from './board-panel-prefs';

export type BoardGraphPanelId = 'filter' | 'inspector';

export interface BoardGraphPanelState {
  visible: boolean;
  mode: BoardPanelMode;
}

export type BoardGraphPanelPrefs = Record<BoardGraphPanelId, BoardGraphPanelState>;

const STORAGE_KEY = 'board-graph-panel-prefs';

const DEFAULTS: BoardGraphPanelPrefs = {
  filter: { visible: true, mode: 'docked' },
  inspector: { visible: true, mode: 'docked' },
};

export function readBoardGraphPanelPrefs(): BoardGraphPanelPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<BoardGraphPanelPrefs>;
    return {
      filter: { ...DEFAULTS.filter, ...parsed.filter },
      inspector: { ...DEFAULTS.inspector, ...parsed.inspector },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeBoardGraphPanelPrefs(prefs: BoardGraphPanelPrefs) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
