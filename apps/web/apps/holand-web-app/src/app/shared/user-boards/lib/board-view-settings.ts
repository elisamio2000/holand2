import { DEFAULT_GRAPH_FILTER, DEFAULT_GRAPH_SETTINGS } from '@/config/graph-config';
import type { GraphFilter, GraphSettings } from '@/types/graph-explorer.types';
import type { BoardNodeRole, BoardSnapshot } from './board-types';

export function resolveCanvasHiddenNodeRoles(snapshot: BoardSnapshot): BoardNodeRole[] {
  if (Array.isArray(snapshot.canvasHiddenNodeRoles)) {
    return snapshot.canvasHiddenNodeRoles;
  }
  if (Array.isArray(snapshot.hiddenNodeRoles)) {
    return snapshot.hiddenNodeRoles;
  }
  return [];
}

export function resolveGraphViewSettings(snapshot: BoardSnapshot): GraphSettings {
  return {
    ...DEFAULT_GRAPH_SETTINGS,
    enablePhysics: true,
    layout: 'force',
    ...snapshot.graphViewSettings,
  };
}

export function resolveGraphViewFilter(snapshot: BoardSnapshot): GraphFilter {
  const stored = snapshot.graphViewFilter;
  return {
    ...DEFAULT_GRAPH_FILTER,
    entityTypes: stored?.entityTypes ?? [],
    relationTypes: stored?.relationTypes ?? [],
    communities: stored?.communities ?? [],
    minStrength: stored?.minStrength ?? DEFAULT_GRAPH_FILTER.minStrength,
    maxStrength: stored?.maxStrength ?? DEFAULT_GRAPH_FILTER.maxStrength,
    searchQuery: stored?.searchQuery ?? '',
    showIsolated: stored?.showIsolated ?? DEFAULT_GRAPH_FILTER.showIsolated,
    highlightPath: stored?.highlightPath ?? DEFAULT_GRAPH_FILTER.highlightPath,
    showHiddenNodes: stored?.showHiddenNodes ?? DEFAULT_GRAPH_FILTER.showHiddenNodes,
  };
}

export function settingsPanelTitleKey(activeTab: string): string {
  switch (activeTab) {
    case 'graph':
      return 'boards.panel.graphSettings';
    case 'report':
      return 'boards.panel.reportSettings';
    default:
      return 'boards.panel.settings';
  }
}

export function settingsPanelTitleDefault(activeTab: string): string {
  switch (activeTab) {
    case 'graph':
      return 'Graph display';
    case 'report':
      return 'Report settings';
    default:
      return 'Board settings';
  }
}
