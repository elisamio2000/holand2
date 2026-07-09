import type { GraphData } from '@/types/graph-explorer.types';
import type { PathfindingLayerState } from './pathfinding-layer-state';
import { getPathLinkIds } from './graph-pathfinding';

/**
 * Theme tokens from `globals.css` (space-separated RGB triples).
 * Cycled by layer index so concurrent paths are visually distinct on the canvas.
 */
const PATH_LAYER_COLOR_VAR_NAMES = [
  '--orange-default',
  '--blue-default',
  '--secondary-default',
  '--green-default',
  '--red-default',
  '--primary-default',
] as const;

const PATH_LAYER_FALLBACKS = [
  'rgb(245, 166, 35)',
  'rgb(0, 112, 243)',
  'rgb(78, 54, 245)',
  'rgb(17, 168, 73)',
  'rgb(238, 0, 0)',
  'rgb(17, 17, 17)',
] as const;

export function pathLayerColorVarName(layerIndex: number): string {
  return PATH_LAYER_COLOR_VAR_NAMES[layerIndex % PATH_LAYER_COLOR_VAR_NAMES.length]!;
}

/** Resolved stroke for path layer `layerIndex` (SSR-safe fallbacks). */
export function resolvePathLayerRgb(layerIndex: number): string {
  if (typeof window === 'undefined') {
    return PATH_LAYER_FALLBACKS[layerIndex % PATH_LAYER_FALLBACKS.length]!;
  }
  const varName = pathLayerColorVarName(layerIndex);
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (raw) return `rgb(${raw})`;
  return PATH_LAYER_FALLBACKS[layerIndex % PATH_LAYER_FALLBACKS.length]!;
}

/** Soft underlay for path edges (2D canvas glow pass). */
export function pathLayerGlowFromStroke(strokeRgb: string): string {
  const m = strokeRgb.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!m) return 'rgba(245, 166, 35, 0.35)';
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0.35)`;
}

export interface PathHighlightColorMaps {
  linkColors: Map<string, string>;
  nodeColors: Map<string, string>;
}

/**
 * Builds per-id colors for the force graph. Later layers overwrite earlier ones on shared ids.
 */
export function buildPathHighlightColorMaps(
  graphData: GraphData | null,
  layers: PathfindingLayerState[] = []
): PathHighlightColorMaps | null {
  if (!graphData) return null;
  const linkColors = new Map<string, string>();
  const nodeColors = new Map<string, string>();
  layers.forEach((layer, idx) => {
    if (!layer.highlightEnabled) return;
    const r = layer.results[layer.activeResultIndex];
    if (!r?.found) return;
    const color = resolvePathLayerRgb(idx);
    r.path.forEach((nid) => nodeColors.set(nid, color));
    getPathLinkIds(r, graphData).forEach((lid) => linkColors.set(lid, color));
  });
  if (linkColors.size === 0 && nodeColors.size === 0) return null;
  return { linkColors, nodeColors };
}
