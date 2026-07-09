import { describe, expect, it } from 'vitest';
import { createEmptySnapshot, normalizeBoardSnapshot } from '../board-snapshot';
import {
  resolveCanvasHiddenNodeRoles,
  resolveGraphViewFilter,
  resolveGraphViewSettings,
  settingsPanelTitleDefault,
  settingsPanelTitleKey,
} from '../board-view-settings';
import { DEFAULT_GRAPH_SETTINGS } from '@/config/graph-config';

describe('board-view-settings', () => {
  it('migrates hiddenNodeRoles to canvasHiddenNodeRoles on normalize', () => {
    const snap = normalizeBoardSnapshot({
      version: 1,
      viewBox: createEmptySnapshot().viewBox,
      objects: [],
      hiddenNodeRoles: ['topic', 'evidence'],
    });
    expect(snap.canvasHiddenNodeRoles).toEqual(['topic', 'evidence']);
    expect(resolveCanvasHiddenNodeRoles(snap)).toEqual(['topic', 'evidence']);
  });

  it('resolveGraphViewSettings merges defaults', () => {
    const snap = createEmptySnapshot();
    snap.graphViewSettings = { ...DEFAULT_GRAPH_SETTINGS, nodeSize: 12, showLabels: false };
    const resolved = resolveGraphViewSettings(snap);
    expect(resolved.nodeSize).toBe(12);
    expect(resolved.showLabels).toBe(false);
    expect(resolved.layout).toBe(DEFAULT_GRAPH_SETTINGS.layout);
  });

  it('resolveGraphViewFilter merges defaults', () => {
    const snap = createEmptySnapshot();
    snap.graphViewFilter = {
      entityTypes: [],
      relationTypes: [],
      communities: [],
      minStrength: 0,
      maxStrength: 1,
      searchQuery: 'alpha',
      showIsolated: false,
      highlightPath: false,
    };
    expect(resolveGraphViewFilter(snap).searchQuery).toBe('alpha');
    expect(resolveGraphViewFilter(snap).showIsolated).toBe(false);
  });

  it('settings panel title keys vary by tab', () => {
    expect(settingsPanelTitleKey('canvas')).toBe('boards.panel.settings');
    expect(settingsPanelTitleKey('graph')).toBe('boards.panel.graphSettings');
    expect(settingsPanelTitleDefault('graph')).toBe('Graph display');
  });
});
