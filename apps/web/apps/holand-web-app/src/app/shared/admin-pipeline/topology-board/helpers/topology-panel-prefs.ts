import type { BoardPanelMode } from '@/app/shared/user-boards/lib/board-panel-prefs';

export type TopologyPanelId = 'palette' | 'filter' | 'inspector';

export interface TopologyPanelState {
  visible: boolean;
  mode: BoardPanelMode;
}

export type TopologyPanelPrefs = Record<TopologyPanelId, TopologyPanelState>;

const STORAGE_KEY = 'topology-board-panel-prefs';

const DEFAULTS: TopologyPanelPrefs = {
  palette: { visible: true, mode: 'docked' },
  filter: { visible: true, mode: 'docked' },
  inspector: { visible: true, mode: 'docked' },
};

export function readTopologyPanelPrefs(): TopologyPanelPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<TopologyPanelPrefs>;
    return {
      palette: { ...DEFAULTS.palette, ...parsed.palette },
      filter: { ...DEFAULTS.filter, ...parsed.filter },
      inspector: { ...DEFAULTS.inspector, ...parsed.inspector },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeTopologyPanelPrefs(prefs: TopologyPanelPrefs) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function patchTopologyPanel(
  prefs: TopologyPanelPrefs,
  id: TopologyPanelId,
  patch: Partial<TopologyPanelState>
): TopologyPanelPrefs {
  return { ...prefs, [id]: { ...prefs[id], ...patch } };
}
