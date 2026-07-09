import {
  DEFAULT_GRID_OPACITY,
  GRID_OPACITY_MAX,
  GRID_OPACITY_MIN,
} from './grid-tokens';

export type GridStyle = 'dots' | 'lines';

export interface GridPreferences {
  /** null = follow snap-to-grid toggle */
  visible: boolean | null;
  opacity: number;
  style: GridStyle;
  /** null = theme default */
  color: string | null;
}

const STORAGE_KEY = 'boards.grid.prefs';

const DEFAULTS: GridPreferences = {
  visible: null,
  opacity: DEFAULT_GRID_OPACITY,
  style: 'dots',
  color: null,
};

function clampOpacity(v: number): number {
  return Math.min(GRID_OPACITY_MAX, Math.max(GRID_OPACITY_MIN, v));
}

export function readGridPreferences(): GridPreferences {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GridPreferences>;
    return {
      visible: parsed.visible ?? DEFAULTS.visible,
      opacity: clampOpacity(parsed.opacity ?? DEFAULTS.opacity),
      style: parsed.style === 'lines' ? 'lines' : 'dots',
      color: typeof parsed.color === 'string' ? parsed.color : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeGridPreferences(patch: Partial<GridPreferences>): GridPreferences {
  const next: GridPreferences = {
    ...readGridPreferences(),
    ...patch,
    opacity: patch.opacity !== undefined ? clampOpacity(patch.opacity) : readGridPreferences().opacity,
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function effectiveGridVisible(prefs: GridPreferences, snapToGrid: boolean): boolean {
  if (prefs.visible !== null) return prefs.visible;
  return snapToGrid;
}
