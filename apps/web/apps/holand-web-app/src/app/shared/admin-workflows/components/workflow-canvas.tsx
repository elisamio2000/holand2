// ============================================
// WorkflowCanvas — Enhanced React Flow canvas
// Context menu, keyboard shortcuts, improved minimap
// ============================================
'use client';

import { useCallback, useEffect, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  useReactFlow,
  SelectionMode,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '../store/workflow-store';
import WorkflowStepNode from './workflow-step-node';
import WorkflowContextMenu, { useContextMenu } from './workflow-context-menu';
import WorkflowShortcutsHelp from './workflow-shortcuts-help';
import { STEP_META } from '../helpers/step-meta';
import type { WorkflowStepKind, WorkflowNodeData } from '@/types/workflow.types';

const NODE_TYPES: NodeTypes = {
  workflowStep: WorkflowStepNode,
};

interface WorkflowCanvasProps {
  onAutoLayout: () => void;
}

export default function WorkflowCanvas({ onAutoLayout }: WorkflowCanvasProps) {
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();
  const { menu, openMenu, closeMenu } = useContextMenu();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    addNode,
    removeNode,
    duplicateNode,
    selectedNodeId,
  } = useWorkflowStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;
      if (isInput) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          removeNode(selectedNodeId);
        }
      }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        if (selectedNodeId) duplicateNode(selectedNodeId);
      }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        fitView();
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        onAutoLayout();
      }
      if (e.ctrlKey && e.key === '=') {
        e.preventDefault();
        zoomIn();
      }
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    selectedNodeId,
    removeNode,
    duplicateNode,
    fitView,
    zoomIn,
    zoomOut,
    onAutoLayout,
  ]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
      closeMenu();
    },
    [setSelectedNodeId, closeMenu]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    closeMenu();
  }, [setSelectedNodeId, closeMenu]);

  const handleContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      openMenu(event.clientX, event.clientY);
    },
    [openMenu]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string }) => {
      event.preventDefault();
      setSelectedNodeId(node.id);
      openMenu(event.clientX, event.clientY, node.id);
    },
    [setSelectedNodeId, openMenu]
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(
        'application/workflow-node-kind'
      ) as WorkflowStepKind;
      if (!kind || !STEP_META[kind]) return;

      const meta = STEP_META[kind];
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nodeData: WorkflowNodeData = {
        label: kind
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
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
    },
    [screenToFlowPosition, addNode]
  );

  const miniMapNodeColor = useCallback(
    (node: { data: Record<string, unknown> }) => {
      const d = node.data as WorkflowNodeData | undefined;
      if (d?.status === 'running') return '#3b82f6';
      if (d?.status === 'success') return '#22c55e';
      if (d?.status === 'error') return '#ef4444';
      const meta = d?.kind ? STEP_META[d.kind] : undefined;
      return meta?.color ?? '#6b7280';
    },
    []
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={NODE_TYPES}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        deleteKeyCode="Delete"
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 2, stroke: '#94a3b8' },
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-50/50 dark:bg-gray-100/50"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#d1d5db"
          className="!bg-transparent dark:!bg-transparent"
        />
        <Controls
          position="bottom-right"
          showInteractive={false}
          className="!rounded-xl !border-muted !bg-white/90 !shadow-lg !backdrop-blur-sm dark:!bg-gray-100/90"
        />
        <MiniMap
          position="bottom-left"
          nodeColor={miniMapNodeColor}
          nodeStrokeWidth={2}
          maskColor="rgba(0,0,0,0.06)"
          className="!rounded-xl !border-muted !bg-white/80 !shadow-lg !backdrop-blur-sm dark:!bg-gray-100/80"
          style={{ width: 160, height: 100 }}
          pannable
          zoomable
        />

        {/* Top-right info panel */}
        <Panel position="top-right" className="!m-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-white/80 px-2.5 py-1 text-[10px] font-medium text-gray-500 shadow-sm backdrop-blur-sm dark:bg-gray-100/80">
              {nodes.length} nodes · {edges.length} edges
            </div>
            <WorkflowShortcutsHelp />
          </div>
        </Panel>
      </ReactFlow>

      {/* Context Menu */}
      {menu.show && (
        <WorkflowContextMenu
          x={menu.x}
          y={menu.y}
          nodeId={menu.nodeId}
          onClose={closeMenu}
          onAutoLayout={onAutoLayout}
        />
      )}
    </div>
  );
}
