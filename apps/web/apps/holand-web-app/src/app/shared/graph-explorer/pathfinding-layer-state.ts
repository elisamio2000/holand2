import type { GraphNode, PathfindingComputation } from '@/types/graph-explorer.types';
import type { PathfindingMode } from './graph-pathfinding';

/** One completed pathfinding run (possibly K variants); highlight can be toggled independently. */
export interface PathfindingLayerState {
  id: string;
  sourceNode: GraphNode;
  targetNode: GraphNode;
  mode: PathfindingMode;
  results: PathfindingComputation[];
  activeResultIndex: number;
  highlightEnabled: boolean;
  expanded: boolean;
}

export function createPathfindingLayerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `path-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
