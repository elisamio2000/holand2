import { create } from 'zustand';
import { loadTopologyLayout, saveTopologyLayout } from './layout-storage';
import {
  DEFAULT_NODE_SHAPES,
  mergeNodeShapes,
} from './topology-node-shapes';

export type TopologyLayoutAlgorithm = 'elk' | 'column' | 'radial';

export interface TopologyBoardSettings {
  showNodeLabels: boolean;
  showEdgeLabels: boolean;
  healthOverlay: boolean;
  snapToGrid: boolean;
  snapGridSize: number;
  showMinimap: boolean;
  layoutAlgorithm: TopologyLayoutAlgorithm;
  zenMode: boolean;
  fullscreenMode: boolean;
  inspectorWidth: number;
  gridOpacity: number;
  minimapAuto: boolean;
  minimapThreshold: number;
  showOrphanNodes: boolean;
  clusterMode: TopologyClusterMode;
  nodeShapes: Record<import('./topology-board-types').TopologyEntityKind, import('./topology-node-shapes').TopologyNodeShape>;
}

export type TopologyClusterMode = 'none' | 'byModel' | 'byRemoteNode';

export const DEFAULT_TOPOLOGY_BOARD_SETTINGS: TopologyBoardSettings = {
  showNodeLabels: true,
  showEdgeLabels: true,
  healthOverlay: true,
  snapToGrid: true,
  snapGridSize: 16,
  showMinimap: true,
  layoutAlgorithm: 'elk',
  zenMode: false,
  fullscreenMode: false,
  inspectorWidth: 288,
  gridOpacity: 0.35,
  minimapAuto: true,
  minimapThreshold: 12,
  showOrphanNodes: false,
  clusterMode: 'none',
  nodeShapes: { ...DEFAULT_NODE_SHAPES },
};

interface SettingsState extends TopologyBoardSettings {
  hydrated: boolean;
  hydrate: () => void;
  patchSettings: (patch: Partial<TopologyBoardSettings>) => void;
  patchNodeShape: (kind: import('./topology-board-types').TopologyEntityKind, shape: import('./topology-node-shapes').TopologyNodeShape) => void;
  resetSettings: () => void;
}

export const useTopologyBoardSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_TOPOLOGY_BOARD_SETTINGS,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated || typeof window === 'undefined') return;
    const layout = loadTopologyLayout();
    const display = layout?.displaySettings;
    set({
      ...DEFAULT_TOPOLOGY_BOARD_SETTINGS,
      ...(display ?? {}),
      nodeShapes: mergeNodeShapes(display?.nodeShapes),
      hydrated: true,
    });
  },

  patchSettings: (patch) => {
    const next = { ...get(), ...patch };
    set(patch);
    saveTopologyLayout({
      displaySettings: {
        showNodeLabels: next.showNodeLabels,
        showEdgeLabels: next.showEdgeLabels,
        healthOverlay: next.healthOverlay,
        snapToGrid: next.snapToGrid,
        snapGridSize: next.snapGridSize,
        showMinimap: next.showMinimap,
        layoutAlgorithm: next.layoutAlgorithm,
        zenMode: next.zenMode,
        fullscreenMode: next.fullscreenMode,
        inspectorWidth: next.inspectorWidth,
        gridOpacity: next.gridOpacity,
        minimapAuto: next.minimapAuto,
        minimapThreshold: next.minimapThreshold,
        showOrphanNodes: next.showOrphanNodes,
        clusterMode: next.clusterMode,
        nodeShapes: next.nodeShapes,
      },
    });
  },

  patchNodeShape: (kind, shape) => {
    const nodeShapes = { ...get().nodeShapes, [kind]: shape };
    get().patchSettings({ nodeShapes });
  },

  resetSettings: () => {
    set({ ...DEFAULT_TOPOLOGY_BOARD_SETTINGS });
    saveTopologyLayout({
      displaySettings: DEFAULT_TOPOLOGY_BOARD_SETTINGS,
    });
  },
}));
