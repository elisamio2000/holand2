'use client';

import { useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useTopologyBoardStore } from '../store/topology-board-store';

interface Options {
  onSave?: () => void;
  onLayout?: () => void;
  enabled?: boolean;
}

export function useTopologyKeyboard({ onSave, onLayout, enabled = true }: Options) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const undo = useTopologyBoardStore((s) => s.undo);
  const redo = useTopologyBoardStore((s) => s.redo);
  const removeNode = useTopologyBoardStore((s) => s.removeNode);
  const createGroupFromSelection = useTopologyBoardStore((s) => s.createGroupFromSelection);
  const duplicateSelected = useCallback(() => {
    const state = useTopologyBoardStore.getState();
    const sel = state.nodes.find((n) => n.id === state.selectedNodeId);
    if (!sel || sel.data.kind === 'group') return;
    const { kind, entityId, label } = sel.data;
    state.addEntityNode(kind, `${entityId}_copy_${Date.now()}`, `${label} (copy)`);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        createGroupFromSelection('Cluster');
      }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        onLayout?.();
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = useTopologyBoardStore.getState().selectedNodeId;
        if (sel) removeNode(sel);
      }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        fitView({ padding: 0.2 });
      }
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
      }
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    enabled,
    undo,
    redo,
    createGroupFromSelection,
    removeNode,
    fitView,
    zoomIn,
    zoomOut,
    onSave,
    onLayout,
    duplicateSelected,
  ]);
}
