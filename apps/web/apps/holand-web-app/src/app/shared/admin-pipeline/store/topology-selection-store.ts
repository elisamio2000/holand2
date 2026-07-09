'use client';

import { create } from 'zustand';
import type { TopologyEntityKind } from '../topology-board/helpers/topology-board-types';

export interface SelectedEntity {
  kind: TopologyEntityKind | 'route';
  id: string;
}

interface TopologySelectionState {
  selectedEntity: SelectedEntity | null;
  highlightedNodeIds: string[];
  setSelectedEntity: (entity: SelectedEntity | null) => void;
  setHighlightedNodeIds: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useTopologySelectionStore = create<TopologySelectionState>((set) => ({
  selectedEntity: null,
  highlightedNodeIds: [],
  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),
  setHighlightedNodeIds: (highlightedNodeIds) => set({ highlightedNodeIds }),
  clearSelection: () => set({ selectedEntity: null, highlightedNodeIds: [] }),
}));
