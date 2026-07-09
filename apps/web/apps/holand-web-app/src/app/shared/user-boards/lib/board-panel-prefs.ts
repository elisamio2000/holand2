export type BoardPanelMode = 'docked' | 'floating' | 'minimized' | 'popout';

export interface BoardPanelState {
  visible: boolean;
  mode: BoardPanelMode;
}

export const BOARD_PANEL_IDS = [
  'settings',
  'selection',
  'tools',
  'minimap',
  'comments',
  'attachments',
  'report',
  'graph',
  'drawOptions',
] as const;

export type BoardPanelId = (typeof BOARD_PANEL_IDS)[number];

export type BoardPanelPrefs = Record<BoardPanelId, BoardPanelState>;

const LEGACY_STORAGE_KEY = 'user-boards-panel-prefs';

const DEFAULT_PANEL_STATE: BoardPanelState = { visible: false, mode: 'docked' };

export const DEFAULT_BOARD_PANEL_PREFS: BoardPanelPrefs = {
  settings: { visible: true, mode: 'docked' },
  selection: { visible: true, mode: 'docked' },
  tools: { visible: true, mode: 'docked' },
  minimap: { visible: true, mode: 'docked' },
  comments: { visible: false, mode: 'docked' },
  attachments: { visible: false, mode: 'docked' },
  report: { visible: false, mode: 'docked' },
  graph: { visible: false, mode: 'docked' },
  drawOptions: { visible: false, mode: 'docked' },
};

function boardPrefsKey(boardId?: string) {
  return boardId ? `user-boards-panel-prefs:${boardId}` : LEGACY_STORAGE_KEY;
}

function mergePrefs(partial?: Partial<BoardPanelPrefs>): BoardPanelPrefs {
  const merged = { ...DEFAULT_BOARD_PANEL_PREFS };
  if (!partial) return merged;
  for (const id of BOARD_PANEL_IDS) {
    if (partial[id]) {
      merged[id] = { ...DEFAULT_PANEL_STATE, ...DEFAULT_BOARD_PANEL_PREFS[id], ...partial[id] };
    }
  }
  return merged;
}

/** Migrate legacy global prefs (settings/selection/tools only). */
function readLegacyGlobalPrefs(): Partial<BoardPanelPrefs> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<'settings' | 'selection' | 'tools', BoardPanelState>>;
    return parsed as Partial<BoardPanelPrefs>;
  } catch {
    return null;
  }
}

export function readBoardPanelPrefs(boardId?: string): BoardPanelPrefs {
  if (typeof window === 'undefined') return mergePrefs();
  try {
    const raw = window.localStorage.getItem(boardPrefsKey(boardId));
    if (raw) {
      return mergePrefs(JSON.parse(raw) as Partial<BoardPanelPrefs>);
    }
    const legacy = readLegacyGlobalPrefs();
    return mergePrefs(legacy ?? undefined);
  } catch {
    return mergePrefs();
  }
}

export function writeBoardPanelPrefs(prefs: BoardPanelPrefs, boardId?: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(boardPrefsKey(boardId), JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

const WIDTH_PREFIX = 'user-boards-panel-width:';

export function loadPanelWidth(id: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(WIDTH_PREFIX + id);
    if (!raw) return fallback;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function savePanelWidth(id: string, width: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WIDTH_PREFIX + id, String(width));
  } catch {
    /* ignore */
  }
}
