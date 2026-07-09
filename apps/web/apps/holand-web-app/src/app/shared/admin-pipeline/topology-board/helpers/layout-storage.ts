import { TopologyLayoutSnapshot, TOPOLOGY_LAYOUT_KEY } from './topology-board-types';
import { DEFAULT_TOPOLOGY_BOARD_SETTINGS } from './topology-board-settings';
import { mergeNodeShapes } from './topology-node-shapes';


const LEGACY_KEY = 'pipeline-topology-layout:v2';

function migrateV2(raw: Record<string, unknown>): TopologyLayoutSnapshot | null {
  if (raw.version !== 2) return null;
  return {
    version: 3,
    viewport: (raw.viewport as TopologyLayoutSnapshot['viewport']) ?? { x: 0, y: 0, zoom: 1 },
    positions: (raw.positions as TopologyLayoutSnapshot['positions']) ?? {},
    groups: (raw.groups as TopologyLayoutSnapshot['groups']) ?? [],
    edgeUi: (raw.edgeUi as TopologyLayoutSnapshot['edgeUi']) ?? {},
    displaySettings: DEFAULT_TOPOLOGY_BOARD_SETTINGS,
    updatedAt: new Date().toISOString(),
  };
}

function migrateV3(raw: Record<string, unknown>): TopologyLayoutSnapshot | null {
  if (raw.version !== 3) return null;
  const { viewMode: _viewMode, camera3d: _camera3d, camera3dTarget: _camera3dTarget, ...rest } = raw;
  return {
    ...(rest as unknown as TopologyLayoutSnapshot),
    version: 3,
    displaySettings: {
      ...DEFAULT_TOPOLOGY_BOARD_SETTINGS,
      ...((raw.displaySettings as TopologyLayoutSnapshot['displaySettings']) ?? {}),
      nodeShapes: mergeNodeShapes(
        (raw.displaySettings as TopologyLayoutSnapshot['displaySettings'])?.nodeShapes
      ),
    },
    updatedAt: (raw.updatedAt as string) ?? new Date().toISOString(),
  };
}

export function loadTopologyLayout(): TopologyLayoutSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawV3 = localStorage.getItem(TOPOLOGY_LAYOUT_KEY);
    if (rawV3) {
      const parsed = JSON.parse(rawV3) as Record<string, unknown>;
      if (parsed.version === 3) return migrateV3(parsed);
    }
    const rawV2 = localStorage.getItem(LEGACY_KEY);
    if (rawV2) {
      const migrated = migrateV2(JSON.parse(rawV2) as Record<string, unknown>);
      if (migrated) {
        localStorage.setItem(TOPOLOGY_LAYOUT_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTopologyLayout(snapshot: Partial<TopologyLayoutSnapshot>): void {
  if (typeof window === 'undefined') return;
  const prev = loadTopologyLayout();
  const displayPartial = snapshot.displaySettings;
  const next: TopologyLayoutSnapshot = {
    version: 3,
    viewport: snapshot.viewport ?? prev?.viewport ?? { x: 0, y: 0, zoom: 1 },
    positions: snapshot.positions ?? prev?.positions ?? {},
    groups: snapshot.groups ?? prev?.groups ?? [],
    edgeUi: snapshot.edgeUi ?? prev?.edgeUi ?? {},
    manualPlacements: snapshot.manualPlacements ?? prev?.manualPlacements ?? [],
    displaySettings: displayPartial
      ? { ...(prev?.displaySettings ?? DEFAULT_TOPOLOGY_BOARD_SETTINGS), ...displayPartial }
      : prev?.displaySettings ?? DEFAULT_TOPOLOGY_BOARD_SETTINGS,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(TOPOLOGY_LAYOUT_KEY, JSON.stringify(next));
}

export function exportTopologyJson(data: unknown, filename = 'topology-board.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function importTopologyJsonFromFile(
  file: File
): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as {
          nodes?: unknown[];
          edges?: unknown[];
        };
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          reject(new Error('Invalid topology JSON'));
          return;
        }
        resolve({ nodes: parsed.nodes, edges: parsed.edges });
      } catch {
        reject(new Error('Invalid topology JSON'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

const LAYOUT_CACHE_KEY = 'topology-layout-cache-v1';
const LAYOUT_CACHE_MAX = 12;

export function hashGraphLayout(
  nodeIds: string[],
  edgePairs: Array<{ source: string; target: string }>
): string {
  const nodes = [...nodeIds].sort().join('|');
  const edges = edgePairs
    .map((e) => `${e.source}>${e.target}`)
    .sort()
    .join('|');
  return `${nodes}::${edges}`;
}

export function getCachedElkLayout(
  graphHash: string
): Record<string, { x: number; y: number }> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAYOUT_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<
      string,
      Record<string, { x: number; y: number }>
    >;
    return cache[graphHash] ?? null;
  } catch {
    return null;
  }
}

export function setCachedElkLayout(
  graphHash: string,
  positions: Record<string, { x: number; y: number }>
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LAYOUT_CACHE_KEY);
    const cache = raw
      ? (JSON.parse(raw) as Record<string, Record<string, { x: number; y: number }>>)
      : {};
    cache[graphHash] = positions;
    const keys = Object.keys(cache);
    if (keys.length > LAYOUT_CACHE_MAX) {
      keys.slice(0, keys.length - LAYOUT_CACHE_MAX).forEach((k) => delete cache[k]);
    }
    localStorage.setItem(LAYOUT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota errors */
  }
}
