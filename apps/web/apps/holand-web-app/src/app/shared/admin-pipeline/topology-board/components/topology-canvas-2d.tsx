'use client';



import { useCallback, useEffect, useRef, useState, useMemo, type DragEvent } from 'react';

import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  SelectionMode,
  type ReactFlowInstance,
  type OnInit,
} from '@xyflow/react';
import { TopologyEdge, TopologyNode, TopologyEntityKind, entityNodeId } from '../helpers/topology-board-types';

import '@xyflow/react/dist/style.css';

import { Text } from 'rizzui';

import { useTranslation } from 'react-i18next';

import toast from 'react-hot-toast';

import { useTopologyBoardStore } from '../store/topology-board-store';

import { useTopologyBoardSettingsStore } from '../helpers/topology-board-settings';
import { useTopologyDisplayFilterStore } from '../store/topology-display-filter-store';
import { filterCanvasGraph } from '../helpers/display-filter';

import { topologyNodeTypes } from './topology-entity-nodes';

import { ENTITY_REGISTRY } from '../helpers/entity-registry';



import { edgeLabel } from '../helpers/edge-styles';
import { resolveEdgeSemantics } from '../helpers/edge-semantics';

import TopologyContextMenu from './topology-context-menu';

import { useTopologyKeyboard } from '../hooks/use-topology-keyboard';

import { useTopologyFocusFromUrl } from '../hooks/use-topology-focus';
import { useTopologySelectionStore } from '../../store/topology-selection-store';
import { useHealthPulse, type EdgePulseKind } from '../hooks/use-health-pulse';
import { formatConnectionError } from '../helpers/validate-connection';

import type { AddEntityModalConfig } from './add-entity-modal';



interface Props {

  onSave?: () => void;

  onLayout?: () => void;

  onRequestAdd?: (config: AddEntityModalConfig, position?: { x: number; y: number }) => void;

}



export default function TopologyCanvas2D({ onSave, onLayout, onRequestAdd }: Props) {

  const { t } = useTranslation();

  const nodes = useTopologyBoardStore((s) => s.nodes);

  const edges = useTopologyBoardStore((s) => s.edges);

  const onNodesChange = useTopologyBoardStore((s) => s.onNodesChange);

  const onEdgesChange = useTopologyBoardStore((s) => s.onEdgesChange);

  const onConnectStore = useTopologyBoardStore((s) => s.onConnect);

  const setSelectedNodeId = useTopologyBoardStore((s) => s.setSelectedNodeId);

  const setSelectedNodeIds = useTopologyBoardStore((s) => s.setSelectedNodeIds);

  const toggleNodeSelection = useTopologyBoardStore((s) => s.toggleNodeSelection);

  const setSelectedEdgeId = useTopologyBoardStore((s) => s.setSelectedEdgeId);

  const selectedNodeIds = useTopologyBoardStore((s) => s.selectedNodeIds);

  const graphVersion = useTopologyBoardStore((s) => s.graphVersion);

  const placedNodeIds = useTopologyBoardStore((s) => s.placedNodeIds);
  const pipelineData = useTopologyBoardStore((s) => s.pipelineData);



  const showEdgeLabels = useTopologyBoardSettingsStore((s) => s.showEdgeLabels);

  const snapToGrid = useTopologyBoardSettingsStore((s) => s.snapToGrid);

  const snapGridSize = useTopologyBoardSettingsStore((s) => s.snapGridSize);

  const healthOverlay = useTopologyBoardSettingsStore((s) => s.healthOverlay);

  const gridOpacity = useTopologyBoardSettingsStore((s) => s.gridOpacity);

  const hiddenKinds = useTopologyDisplayFilterStore((s) => s.hiddenKinds);
  const placementFilter = useTopologyDisplayFilterStore((s) => s.placement);
  const statusFilter = useTopologyDisplayFilterStore((s) => s.status);
  const semanticGroups = useTopologyDisplayFilterStore((s) => s.semanticGroups);
  const toolCategories = useTopologyDisplayFilterStore((s) => s.toolCategories);
  const roleUnassignedOnly = useTopologyDisplayFilterStore((s) => s.roleUnassignedOnly);
  const roleRequiredOnly = useTopologyDisplayFilterStore((s) => s.roleRequiredOnly);
  const unhealthyRoutesOnly = useTopologyDisplayFilterStore((s) => s.unhealthyRoutesOnly);
  const modalityFilter = useTopologyDisplayFilterStore((s) => s.modality);

  const placedSet = useMemo(() => new Set(placedNodeIds), [placedNodeIds]);

  const displayFilter = useMemo(
    () => ({
      hiddenKinds,
      placement: placementFilter,
      status: statusFilter,
      semanticGroups,
      toolCategories,
      roleUnassignedOnly,
      roleRequiredOnly,
      unhealthyRoutesOnly,
      modality: modalityFilter,
    }),
    [
      hiddenKinds,
      placementFilter,
      statusFilter,
      semanticGroups,
      toolCategories,
      roleUnassignedOnly,
      roleRequiredOnly,
      unhealthyRoutesOnly,
      modalityFilter,
    ]
  );

  const { nodes: displayNodes, edges: filteredEdges } = useMemo(
    () => filterCanvasGraph(nodes, edges, displayFilter, placedSet, pipelineData),
    [nodes, edges, displayFilter, placedSet, pipelineData]
  );

  const { screenToFlowPosition, fitView } = useReactFlow();

  const { edgePulse } = useHealthPulse(
    nodes,
    edges,
    pipelineData?.models ?? [],
    healthOverlay
  );
  const fitOnceRef = useRef(false);

  const [menu, setMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);



  useTopologyKeyboard({ onSave, onLayout, enabled: true });

  useTopologyFocusFromUrl();



  useEffect(() => {
    const nextKey = selectedNodeIds.join(',');
    const storeKey = useTopologySelectionStore.getState().highlightedNodeIds.join(',');
    if (nextKey === storeKey) return;
    useTopologySelectionStore.getState().setHighlightedNodeIds(selectedNodeIds);
  }, [selectedNodeIds]);



  const pulseEdgeStyle = (kind: EdgePulseKind | undefined) => {
    if (!kind || kind === 'unknown') {
      return { animated: false, style: { stroke: '#6366f1', strokeWidth: 2 } };
    }
    if (kind === 'unhealthy') {
      return { animated: false, style: { stroke: '#ef4444', strokeWidth: 2 } };
    }
    return { animated: true, style: { stroke: '#22c55e', strokeWidth: 2 } };
  };

  const models = pipelineData?.models ?? [];

  const displayEdges: TopologyEdge[] = filteredEdges.map((e) => {
    const source = displayNodes.find((n) => n.id === e.source);
    const target = displayNodes.find((n) => n.id === e.target);
    const sem = resolveEdgeSemantics(e, source, target, models, filteredEdges, displayNodes);
    const label = showEdgeLabels ? sem.label : undefined;
    if (!healthOverlay) {
      return {
        ...e,
        label,
        style: {
          ...e.style,
          stroke: sem.colorHex,
          strokeDasharray: sem.dashed ? '6 4' : undefined,
        },
      };
    }
    const pulse = pulseEdgeStyle(edgePulse[e.id]);
    return {
      ...e,
      label,
      animated: pulse.animated || sem.animated,
      style: {
        ...e.style,
        ...pulse.style,
        stroke: sem.colorHex,
        strokeDasharray: sem.dashed ? '6 4' : undefined,
      },
    };
  });



  const onConnect = useCallback(

    (conn: Parameters<typeof onConnectStore>[0]) => {

      const result = onConnectStore(conn);

      if (!result.ok) {

        toast.error(formatConnectionError(result.reason, t as (k: string, fb?: string) => string));

      }

    },

    [onConnectStore, t]

  );



  const handleDragOver = useCallback((e: DragEvent) => {

    e.preventDefault();

    e.dataTransfer.dropEffect = 'move';

  }, []);



  const handleDrop = useCallback(

    (e: DragEvent) => {

      e.preventDefault();

      const kind = e.dataTransfer.getData('application/topology-entity-kind') as TopologyEntityKind;

      const entityId = e.dataTransfer.getData('application/topology-entity-id');

      const label = e.dataTransfer.getData('application/topology-entity-label');

      if (!kind || !entityId || !ENTITY_REGISTRY[kind]) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      const id = entityNodeId(kind, entityId);

      if (placedNodeIds.includes(id)) {

        toast.error(t('pipeline.topology.board.alreadyPlaced', 'Already on board'));

        return;

      }

      if (onRequestAdd) {

        onRequestAdd({ kind, entityId, label: label || entityId }, position);

      }

    },

    [screenToFlowPosition, onRequestAdd, placedNodeIds, t]

  );



  const onInit = useCallback<OnInit<TopologyNode, TopologyEdge>>(
    (instance) => {
      if (!fitOnceRef.current && nodes.length > 0) {
        fitOnceRef.current = true;
        requestAnimationFrame(() => {
          instance.fitView({ padding: 0.2, duration: 200 });
        });
      }
    },
    [nodes.length]
  );



  useEffect(() => {

    fitOnceRef.current = false;

  }, [graphVersion]);



  useEffect(() => {

    if (nodes.length > 0) {

      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 200 }));

    }

  }, [graphVersion, nodes.length, fitView]);



  const gridColor = `rgba(51, 65, 85, ${gridOpacity})`;



  if (nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-2 bg-gray-950">
        <Text className="text-sm text-gray-400">
          {t(
            'pipeline.topology.board.emptyCanvas',
            'No connected nodes on canvas. Add entities from the palette sidebar.'
          )}
        </Text>
      </div>
    );
  }



  return (

    <div className="relative h-full w-full" data-tour="topology-canvas">

      <ReactFlow

        key={graphVersion}

        nodes={displayNodes}

        edges={displayEdges}

        nodeTypes={topologyNodeTypes}

        onNodesChange={onNodesChange}

        onEdgesChange={onEdgesChange}

        onConnect={onConnect}

        onInit={onInit}

        onNodeClick={(e, n) => {

          if (e.shiftKey) {

            toggleNodeSelection(n.id);

          } else {

            setSelectedNodeId(n.id);

          }

          setMenu(null);

        }}

        onNodeDoubleClick={(_, n) => {

          setSelectedNodeId(n.id);

          useTopologyBoardStore.getState().openAdvancedSettings(n.id);

        }}

        onEdgeClick={(_, edge) => {

          setSelectedEdgeId(edge.id);

          setMenu(null);

        }}

        onPaneClick={() => {

          setSelectedNodeIds([]);

          setSelectedEdgeId(null);

          setMenu(null);

        }}

        onPaneContextMenu={(e) => {

          e.preventDefault();

          setMenu({ x: e.clientX, y: e.clientY });

        }}

        onNodeContextMenu={(e, n) => {

          e.preventDefault();

          setSelectedNodeId(n.id);

          setMenu({ x: e.clientX, y: e.clientY, nodeId: n.id });

        }}

        onDragOver={handleDragOver}

        onDrop={handleDrop}

        onlyRenderVisibleElements

        snapToGrid={snapToGrid}

        snapGrid={[snapGridSize, snapGridSize]}

        selectionMode={SelectionMode.Partial}

        multiSelectionKeyCode="Shift"

        proOptions={{ hideAttribution: true }}

        className="bg-gray-950"

        defaultEdgeOptions={{

          style: healthOverlay ? undefined : { stroke: '#6366f1', strokeWidth: 2 },

        }}

      >

        <Background gap={20} color={gridColor} />

        <Controls showInteractive={false} className="!border-muted !bg-gray-900" />

      </ReactFlow>



      {menu && onLayout && (

        <TopologyContextMenu

          x={menu.x}

          y={menu.y}

          nodeId={menu.nodeId}

          onClose={() => setMenu(null)}

          onAutoLayout={onLayout}

        />

      )}

    </div>

  );

}

