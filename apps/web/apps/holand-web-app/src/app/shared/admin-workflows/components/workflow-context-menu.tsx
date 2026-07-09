// ============================================
// WorkflowContextMenu — Right-click context menu for canvas
// Provides quick actions: add node, paste, select all, fit view, etc.
// ============================================
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'rizzui';
import {
  PiPlusBold,
  PiCopyBold,
  PiClipboardBold,
  PiTrashBold,
  PiSelectionAllBold,
  PiArrowsOutBold,
  PiTreeStructureBold,
  PiPlayCircleBold,
  PiGitBranchBold,
  PiBrainBold,
  PiWrenchBold,
  PiFlagCheckeredBold,
  PiNoteBold,
  PiLockKeyBold,
  PiLockKeyOpenBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';

import { useWorkflowStore } from '../store/workflow-store';
import { STEP_META } from '../helpers/step-meta';
import type { WorkflowStepKind, WorkflowNodeData } from '@/types/workflow.types';

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  /** If right-clicked on a node */
  nodeId: string | null;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  danger?: boolean;
  dividerAfter?: boolean;
  disabled?: boolean;
}

interface SubMenuItem {
  label: string;
  icon: React.ReactNode;
  kind: WorkflowStepKind;
}

const QUICK_ADD_NODES: SubMenuItem[] = [
  { label: 'Trigger', icon: <PiPlayCircleBold className="h-3.5 w-3.5" style={{ color: '#10b981' }} />, kind: 'trigger' },
  { label: 'Tool Execute', icon: <PiWrenchBold className="h-3.5 w-3.5" style={{ color: '#14b8a6' }} />, kind: 'tool_execute' },
  { label: 'LLM Call', icon: <PiBrainBold className="h-3.5 w-3.5" style={{ color: '#06b6d4' }} />, kind: 'llm_call' },
  { label: 'Condition', icon: <PiGitBranchBold className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />, kind: 'condition' },
  { label: 'Output', icon: <PiFlagCheckeredBold className="h-3.5 w-3.5" style={{ color: '#ef4444' }} />, kind: 'output' },
];

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    nodeId: null,
  });

  const openMenu = useCallback(
    (x: number, y: number, nodeId?: string | null) => {
      setMenu({ show: true, x, y, nodeId: nodeId ?? null });
    },
    []
  );

  const closeMenu = useCallback(() => {
    setMenu((m) => ({ ...m, show: false }));
  }, []);

  return { menu, openMenu, closeMenu };
}

interface WorkflowContextMenuProps {
  x: number;
  y: number;
  nodeId: string | null;
  onClose: () => void;
  onAutoLayout: () => void;
}

export default function WorkflowContextMenu({
  x,
  y,
  nodeId,
  onClose,
  onAutoLayout,
}: WorkflowContextMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const {
    addNode,
    removeNode,
    duplicateNode,
    setSelectedNodeId,
    nodes,
  } = useWorkflowStore();

  const [showAddSub, setShowAddSub] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const handleAddNode = useCallback(
    (kind: WorkflowStepKind) => {
      const meta = STEP_META[kind];
      const position = screenToFlowPosition({ x, y });
      const nodeData: WorkflowNodeData = {
        label: kind.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        kind,
        config: { ...meta.default_config },
        status: 'idle',
      };
      addNode({
        id: `node_${Date.now()}`,
        type: 'workflowStep',
        position,
        data: nodeData,
      });
      onClose();
    },
    [screenToFlowPosition, x, y, addNode, onClose]
  );

  const nodeMenuItems: MenuItem[] = nodeId
    ? [
        {
          label: t('workflow.editor.duplicateNode'),
          icon: <PiCopyBold className="h-3.5 w-3.5" />,
          shortcut: 'Ctrl+D',
          action: () => { duplicateNode(nodeId); onClose(); },
        },
        {
          label: t('workflow.editor.deleteNode'),
          icon: <PiTrashBold className="h-3.5 w-3.5" />,
          shortcut: 'Del',
          action: () => { removeNode(nodeId); onClose(); },
          danger: true,
          dividerAfter: true,
        },
      ]
    : [];

  const canvasMenuItems: MenuItem[] = [
    {
      label: t('workflow.editor.fitView'),
      icon: <PiArrowsOutBold className="h-3.5 w-3.5" />,
      shortcut: 'Ctrl+0',
      action: () => { fitView(); onClose(); },
    },
    {
      label: t('workflow.editor.autoLayout'),
      icon: <PiTreeStructureBold className="h-3.5 w-3.5" />,
      shortcut: 'Ctrl+L',
      action: () => { onAutoLayout(); onClose(); },
    },
    {
      label: 'Select All',
      icon: <PiSelectionAllBold className="h-3.5 w-3.5" />,
      shortcut: 'Ctrl+A',
      action: () => {
        const allNodeIds = nodes.map((n) => n.id);
        useWorkflowStore.setState({
          nodes: nodes.map((n) => ({ ...n, selected: true })),
        });
        onClose();
      },
      dividerAfter: true,
    },
  ];

  const allItems = [...nodeMenuItems, ...canvasMenuItems];

  const adjustedX = typeof window !== 'undefined' && x + 220 > window.innerWidth ? x - 220 : x;
  const adjustedY = typeof window !== 'undefined' && y + 400 > window.innerHeight ? y - 200 : y;

  return (
    <div
      ref={ref}
      className={cn(
        'fixed z-50 min-w-[200px] overflow-hidden rounded-xl border border-muted',
        'bg-white shadow-xl dark:bg-gray-50',
        'animate-in fade-in-0 zoom-in-95 duration-100'
      )}
      style={{ left: adjustedX, top: adjustedY }}
    >
      {/* Quick Add Sub-menu */}
      <div className="border-b border-muted p-1">
        <button
          type="button"
          onMouseEnter={() => setShowAddSub(true)}
          onMouseLeave={() => setShowAddSub(false)}
          className="relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/50"
        >
          <PiPlusBold className="h-3.5 w-3.5 text-primary" />
          <span className="flex-1 text-start text-xs font-medium">
            Add Node
          </span>
          <span className="text-[10px] text-gray-400">▸</span>

          {showAddSub && (
            <div
              className={cn(
                'absolute left-full top-0 z-50 ms-1 min-w-[160px] overflow-hidden rounded-xl border border-muted',
                'bg-white shadow-xl dark:bg-gray-50'
              )}
              onMouseEnter={() => setShowAddSub(true)}
              onMouseLeave={() => setShowAddSub(false)}
            >
              <div className="p-1">
                {QUICK_ADD_NODES.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => handleAddNode(item.kind)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/50"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Menu Items */}
      <div className="p-1">
        {allItems.map((item, i) => (
          <div key={i}>
            <button
              type="button"
              onClick={item.action}
              disabled={item.disabled}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors',
                item.danger
                  ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-200/50',
                item.disabled && 'cursor-not-allowed opacity-40'
              )}
            >
              <span className={item.danger ? 'text-red-500' : 'text-gray-500'}>
                {item.icon}
              </span>
              <span className="flex-1 text-start font-medium">{item.label}</span>
              {item.shortcut && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-400 dark:bg-gray-200">
                  {item.shortcut}
                </span>
              )}
            </button>
            {item.dividerAfter && (
              <div className="my-1 border-t border-muted" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
