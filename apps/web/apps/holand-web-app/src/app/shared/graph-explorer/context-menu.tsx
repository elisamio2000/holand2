'use client';

/**
 * ContextMenu — Right-click context menus for nodes, links, and canvas.
 *
 * Renders a positioned dropdown with relevant actions based on target type.
 *
 * @requires react-icons/pi — Phosphor icons
 *
 * @example
 * ```tsx
 * <ContextMenu state={contextMenuState} onNodeAction={handleNodeAction} />
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import {
  PiArrowsOutBold,
  PiGraphBold,
  PiArrowsInBold,
  PiPushPinBold,
  PiPushPinSlashBold,
  PiLockKeyBold,
  PiLockKeyOpenBold,
  PiEyeSlashBold,
  PiEyeBold,
  PiCopyBold,
  PiTargetBold,
  PiPathBold,
  PiSelectionBold,
  PiArrowRightBold,
  PiArrowLeftBold,
  PiHighlighterCircleBold,
  PiCircleBold,
  PiGridFourBold,
  PiTreeStructureBold,
  PiCirclesThreeBold,
  PiArrowCounterClockwiseBold,
  PiSelectionAllBold,
  PiPlayBold,
  PiPauseBold,
  PiImageBold,
  PiGearBold,
  PiCodeBold,
  PiPackageBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

import type {
  ContextMenuState,
  GraphNode,
  GraphLink,
  NodeAction,
  LinkAction,
} from '@/types/graph-explorer.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onNodeAction: (nodeId: string, action: NodeAction) => void;
  onLinkAction: (linkId: string, action: LinkAction) => void;
  onCanvasAction: (action: string) => void;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  danger?: boolean;
  separator?: boolean;
  /** If true, menu stays open after click (submenu navigation). */
  keepOpen?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContextMenu({
  state,
  onClose,
  onNodeAction,
  onLinkAction,
  onCanvasAction,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [nodePanel, setNodePanel] = useState<'main' | 'layouts' | 'advanced'>('main');

  useEffect(() => {
    if (state.visible) setNodePanel('main');
  }, [state.visible, state.target]);

  // Close on outside click
  useEffect(() => {
    if (!state.visible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [state.visible, onClose]);

  // Adjust position for viewport overflow
  useEffect(() => {
    if (!state.visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw) {
      menuRef.current.style.left = `${state.x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${state.y - rect.height}px`;
    }
  }, [state]);

  if (!state.visible || !state.target) return null;

  const items = getMenuItems(
    state,
    onNodeAction,
    onLinkAction,
    onCanvasAction,
    onClose,
    state.target.kind === 'node' ? nodePanel : 'main',
    setNodePanel
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[200px] max-w-[240px] bg-gray-0 dark:bg-gray-50 border border-muted rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: state.x, top: state.y }}
    >
      {state.target.kind === 'node' && nodePanel !== 'main' && (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200"
          onClick={() => setNodePanel('main')}
        >
          <PiArrowLeftBold className="h-3.5 w-3.5" />
          Back
        </button>
      )}
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="h-px bg-muted my-1" />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.action();
              if (!item.keepOpen) onClose();
            }}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors',
              item.danger
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-200'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ─── Menu builders ────────────────────────────────────────────────────────────

function getMenuItems(
  state: ContextMenuState,
  onNodeAction: (nodeId: string, action: NodeAction) => void,
  onLinkAction: (linkId: string, action: LinkAction) => void,
  onCanvasAction: (action: string) => void,
  onClose: () => void,
  nodePanel: 'main' | 'layouts' | 'advanced',
  setNodePanel: (p: 'main' | 'layouts' | 'advanced') => void
): MenuItem[] {
  if (!state.target) return [];

  if (state.target.kind === 'node') {
    const node = state.target.item as GraphNode;
    return getNodeMenuItems(node, onNodeAction, onCanvasAction, nodePanel, setNodePanel);
  }

  if (state.target.kind === 'link') {
    const link = state.target.item as GraphLink;
    return getLinkMenuItems(link, onLinkAction);
  }

  if (state.target.kind === 'canvas') {
    return getCanvasMenuItems(onCanvasAction);
  }

  return [];
}

function getNodeMenuItems(
  node: GraphNode,
  onNodeAction: (nodeId: string, action: NodeAction) => void,
  onCanvasAction: (action: string) => void,
  panel: 'main' | 'layouts' | 'advanced',
  setNodePanel: (p: 'main' | 'layouts' | 'advanced') => void
): MenuItem[] {
  if (panel === 'layouts') {
    return [
      {
        label: 'Force-directed',
        icon: <PiGraphBold className="w-3.5 h-3.5" />,
        action: () => onCanvasAction('layout_force'),
      },
      {
        label: 'Circular',
        icon: <PiCircleBold className="w-3.5 h-3.5" />,
        action: () => onCanvasAction('layout_circular'),
      },
      {
        label: 'Grid',
        icon: <PiGridFourBold className="w-3.5 h-3.5" />,
        action: () => onCanvasAction('layout_grid'),
      },
      {
        label: 'Tree (vertical)',
        icon: <PiTreeStructureBold className="w-3.5 h-3.5" />,
        action: () => onCanvasAction('layout_hierarchical'),
      },
      {
        label: 'Tree (horizontal)',
        icon: <PiTreeStructureBold className="w-3.5 h-3.5 rotate-90" />,
        action: () => onCanvasAction('layout_hierarchical-horizontal'),
      },
      {
        label: 'Radial / clusters',
        icon: <PiTargetBold className="w-3.5 h-3.5" />,
        action: () => onCanvasAction('layout_radial'),
      },
      {
        label: 'Concentric',
        icon: <PiCirclesThreeBold className="w-3.5 h-3.5" />,
        action: () => onCanvasAction('layout_concentric'),
      },
      {
        label: 'Reheat simulation',
        icon: <PiPlayBold className="w-3.5 h-3.5" />,
        action: () => onCanvasAction('reheat_simulation'),
      },
    ];
  }

  if (panel === 'advanced') {
    return [
      {
        label: 'Expand neighbors',
        icon: <PiGraphBold className="w-3.5 h-3.5" />,
        action: () => onNodeAction(node.id, 'expand'),
      },
      {
        label: 'Collapse neighbors',
        icon: <PiArrowsInBold className="w-3.5 h-3.5" />,
        action: () => onNodeAction(node.id, 'collapse'),
      },
      {
        label: 'Select cluster',
        icon: <PiTargetBold className="w-3.5 h-3.5" />,
        action: () => onNodeAction(node.id, 'select_cluster'),
      },
      {
        label: 'Pathfinding…',
        icon: <PiPathBold className="w-3.5 h-3.5" />,
        action: () => onNodeAction(node.id, 'find_path'),
      },
      {
        label: 'Hide unconnected',
        icon: <PiSelectionBold className="w-3.5 h-3.5" />,
        action: () => onNodeAction(node.id, 'hide_unconnected'),
      },
      { label: '', icon: null, action: () => {}, separator: true },
      {
        label: 'Copy ID',
        icon: <PiCopyBold className="w-3.5 h-3.5" />,
        action: () => onNodeAction(node.id, 'copy_id'),
      },
      {
        label: 'Copy label',
        icon: <PiCopyBold className="w-3.5 h-3.5" />,
        action: () => onNodeAction(node.id, 'copy_label'),
      },
    ];
  }

  const mainItems: MenuItem[] = [
    {
      label: 'Focus on node',
      icon: <PiArrowsOutBold className="w-3.5 h-3.5" />,
      action: () => onNodeAction(node.id, 'focus'),
    },
  ];
  if (node.community_id != null) {
    mainItems.push({
      label: 'Cluster details…',
      icon: <PiPackageBold className="w-3.5 h-3.5" />,
      action: () => onNodeAction(node.id, 'inspect_cluster'),
    });
  }
  mainItems.push({ label: '', icon: null, action: () => {}, separator: true });
  return [
    ...mainItems,
    {
      label: 'Pin',
      icon: <PiPushPinBold className="w-3.5 h-3.5" />,
      action: () => onNodeAction(node.id, 'pin'),
    },
    {
      label: 'Unpin',
      icon: <PiPushPinSlashBold className="w-3.5 h-3.5" />,
      action: () => onNodeAction(node.id, 'unpin'),
    },
    {
      label: 'Lock position',
      icon: <PiLockKeyBold className="w-3.5 h-3.5" />,
      action: () => onNodeAction(node.id, 'lock'),
    },
    {
      label: 'Unlock position',
      icon: <PiLockKeyOpenBold className="w-3.5 h-3.5" />,
      action: () => onNodeAction(node.id, 'unlock'),
    },
    { label: '', icon: null, action: () => {}, separator: true },
    {
      label: 'Layouts & simulation…',
      icon: <PiCirclesThreeBold className="w-3.5 h-3.5" />,
      action: () => setNodePanel('layouts'),
      keepOpen: true,
    },
    {
      label: 'More actions…',
      icon: <PiGearBold className="w-3.5 h-3.5" />,
      action: () => setNodePanel('advanced'),
      keepOpen: true,
    },
    { label: '', icon: null, action: () => {}, separator: true },
    {
      label: 'Hide node',
      icon: <PiEyeSlashBold className="w-3.5 h-3.5" />,
      action: () => onNodeAction(node.id, 'hide'),
      danger: true,
    },
  ];
}

function getLinkMenuItems(
  link: GraphLink,
  onLinkAction: (linkId: string, action: LinkAction) => void
): MenuItem[] {
  return [
    {
      label: 'Focus on Link',
      icon: <PiArrowsOutBold className="w-3.5 h-3.5" />,
      action: () => onLinkAction(link.id, 'focus'),
    },
    {
      label: 'Highlight Link',
      icon: <PiHighlighterCircleBold className="w-3.5 h-3.5" />,
      action: () => onLinkAction(link.id, 'highlight'),
    },
    { label: '', icon: null, action: () => {}, separator: true },
    {
      label: 'Go to Source',
      icon: <PiArrowLeftBold className="w-3.5 h-3.5" />,
      action: () => onLinkAction(link.id, 'goto_source'),
    },
    {
      label: 'Go to Target',
      icon: <PiArrowRightBold className="w-3.5 h-3.5" />,
      action: () => onLinkAction(link.id, 'goto_target'),
    },
    { label: '', icon: null, action: () => {}, separator: true },
    {
      label: 'Copy ID',
      icon: <PiCopyBold className="w-3.5 h-3.5" />,
      action: () => onLinkAction(link.id, 'copy_id'),
    },
    { label: '', icon: null, action: () => {}, separator: true },
    {
      label: 'Hide Link',
      icon: <PiEyeSlashBold className="w-3.5 h-3.5" />,
      action: () => onLinkAction(link.id, 'hide'),
      danger: true,
    },
  ];
}

function getCanvasMenuItems(onCanvasAction: (action: string) => void): MenuItem[] {
  return [
    {
      label: 'Fit to View',
      icon: <PiArrowsOutBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('fit_view'),
    },
    {
      label: 'Reset View',
      icon: <PiArrowCounterClockwiseBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('reset_view'),
    },
    { label: '', icon: null, action: () => {}, separator: true },
    {
      label: 'Force Layout',
      icon: <PiGraphBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('layout_force'),
    },
    {
      label: 'Circular Layout',
      icon: <PiCircleBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('layout_circular'),
    },
    {
      label: 'Grid Layout',
      icon: <PiGridFourBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('layout_grid'),
    },
    {
      label: 'Tree Layout',
      icon: <PiTreeStructureBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('layout_hierarchical'),
    },
    {
      label: 'Concentric Layout',
      icon: <PiCirclesThreeBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('layout_concentric'),
    },
    {
      label: 'Tree (horizontal)',
      icon: <PiTreeStructureBold className="w-3.5 h-3.5 rotate-90" />,
      action: () => onCanvasAction('layout_hierarchical-horizontal'),
    },
    { label: '', icon: null, action: () => {}, separator: true },
    {
      label: 'Reheat simulation',
      icon: <PiPlayBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('reheat_simulation'),
    },
    { label: '', icon: null, action: () => {}, separator: true },
    {
      label: 'Select All',
      icon: <PiSelectionAllBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('select_all'),
    },
    {
      label: 'Show Hidden Nodes',
      icon: <PiEyeBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('unhide_all'),
    },
    { label: '', icon: null, action: () => {}, separator: true },
    {
      label: 'Export as PNG',
      icon: <PiImageBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('export_png'),
    },
    {
      label: 'Export interactive HTML…',
      icon: <PiCodeBold className="w-3.5 h-3.5" />,
      action: () => onCanvasAction('export_interactive_html'),
    },
  ];
}
