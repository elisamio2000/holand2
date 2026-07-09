import { create } from 'zustand';
import {
  DEFAULT_DISPLAY_FILTER,
  type TopologyDisplayFilterState,
} from '../helpers/display-filter';

interface DisplayFilterState extends TopologyDisplayFilterState {
  patch: (patch: Partial<TopologyDisplayFilterState>) => void;
  reset: () => void;
}

export const useTopologyDisplayFilterStore = create<DisplayFilterState>((set) => ({
  ...DEFAULT_DISPLAY_FILTER,
  patch: (patch) => set((s) => ({ ...s, ...patch })),
  reset: () => set({ ...DEFAULT_DISPLAY_FILTER }),
}));
