import type { BoardPanelId } from './board-panel-prefs';

export interface BoardPanelDefinition {
  id: BoardPanelId;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  side: 'left' | 'right';
  supportsPopout: boolean;
  supportsMinimize: boolean;
}

export const BOARD_PANEL_REGISTRY: Record<BoardPanelId, BoardPanelDefinition> = {
  settings: {
    id: 'settings',
    defaultWidth: 280,
    minWidth: 240,
    maxWidth: 420,
    side: 'right',
    supportsPopout: true,
    supportsMinimize: true,
  },
  selection: {
    id: 'selection',
    defaultWidth: 280,
    minWidth: 240,
    maxWidth: 420,
    side: 'right',
    supportsPopout: true,
    supportsMinimize: true,
  },
  tools: {
    id: 'tools',
    defaultWidth: 220,
    minWidth: 200,
    maxWidth: 320,
    side: 'left',
    supportsPopout: true,
    supportsMinimize: true,
  },
  minimap: {
    id: 'minimap',
    defaultWidth: 200,
    minWidth: 160,
    maxWidth: 280,
    side: 'right',
    supportsPopout: false,
    supportsMinimize: true,
  },
  comments: {
    id: 'comments',
    defaultWidth: 320,
    minWidth: 260,
    maxWidth: 480,
    side: 'right',
    supportsPopout: true,
    supportsMinimize: true,
  },
  attachments: {
    id: 'attachments',
    defaultWidth: 320,
    minWidth: 260,
    maxWidth: 480,
    side: 'right',
    supportsPopout: true,
    supportsMinimize: true,
  },
  report: {
    id: 'report',
    defaultWidth: 400,
    minWidth: 320,
    maxWidth: 560,
    side: 'right',
    supportsPopout: true,
    supportsMinimize: true,
  },
  graph: {
    id: 'graph',
    defaultWidth: 480,
    minWidth: 360,
    maxWidth: 720,
    side: 'right',
    supportsPopout: true,
    supportsMinimize: true,
  },
  drawOptions: {
    id: 'drawOptions',
    defaultWidth: 220,
    minWidth: 180,
    maxWidth: 280,
    side: 'left',
    supportsPopout: false,
    supportsMinimize: true,
  },
};
