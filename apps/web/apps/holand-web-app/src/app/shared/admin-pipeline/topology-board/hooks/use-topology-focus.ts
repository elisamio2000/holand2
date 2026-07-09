'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useReactFlow } from '@xyflow/react';
import type { LlmModel } from '@/types/pipeline-admin.types';
import { entityNodeId, TopologyEntityKind, TopologyNode } from '../helpers/topology-board-types';
import { useTopologyBoardStore } from '../store/topology-board-store';
import { useTopologySelectionStore } from '../../store/topology-selection-store';
import { findModelByEntityId, resolveLogicalId } from '../../helpers/logical-model-options';

/** Parse focus=route:chat.default | tool:id | role:key | model:logical_id */
export function parseFocusParam(
  focus: string | null
): { kind: TopologyEntityKind; entityId: string } | null {
  if (!focus) return null;
  const idx = focus.indexOf(':');
  if (idx <= 0) return null;
  const kind = focus.slice(0, idx) as TopologyEntityKind;
  const entityId = decodeURIComponent(focus.slice(idx + 1));
  const valid: TopologyEntityKind[] = [
    'tool',
    'route',
    'role',
    'model',
    'endpoint',
    'remoteNode',
    'plugin',
    'service',
  ];
  if (!valid.includes(kind) || !entityId) return null;
  return { kind, entityId };
}

function resolveModelNodeId(
  entityId: string,
  nodes: TopologyNode[],
  models: LlmModel[]
): string | null {
  const direct = entityNodeId('model', entityId);
  if (nodes.some((n) => n.id === direct)) return direct;

  const model = findModelByEntityId(models ?? [], entityId);
  if (!model) return null;

  const candidates = [
    entityNodeId('model', resolveLogicalId(model)),
    entityNodeId('model', model.name),
  ];
  for (const id of candidates) {
    if (nodes.some((n) => n.id === id)) return id;
  }
  return null;
}

function resolveNodeIdFromParam(
  raw: string,
  nodes: TopologyNode[],
  models: LlmModel[]
): string | null {
  if (nodes.some((n) => n.id === raw)) return raw;
  const parsed = parseFocusParam(raw);
  if (!parsed) return null;
  let nodeId = entityNodeId(parsed.kind, parsed.entityId);
  if (parsed.kind === 'model') {
    const resolved = resolveModelNodeId(parsed.entityId, nodes, models);
    if (resolved) nodeId = resolved;
  }
  return nodes.some((n) => n.id === nodeId) ? nodeId : null;
}

export function useTopologyFocusFromUrl(): void {
  const searchParams = useSearchParams();
  const focusRaw = searchParams.get('focus');
  const highlightRaw = searchParams.get('highlight');
  const setSelectedNodeId = useTopologyBoardStore((s) => s.setSelectedNodeId);
  const setSelectedNodeIds = useTopologyBoardStore((s) => s.setSelectedNodeIds);
  const setHighlightedNodeIds = useTopologySelectionStore((s) => s.setHighlightedNodeIds);
  const nodes = useTopologyBoardStore((s) => s.nodes);
  const pipelineData = useTopologyBoardStore((s) => s.pipelineData);
  const { fitView, setCenter } = useReactFlow();

  useEffect(() => {
    const models = pipelineData?.models ?? [];

    if (highlightRaw) {
      const ids = highlightRaw
        .split(',')
        .map((part) => resolveNodeIdFromParam(part.trim(), nodes, models))
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) return;
      setHighlightedNodeIds(ids);
      setSelectedNodeIds(ids.slice(0, 1));
      const node = nodes.find((n) => n.id === ids[0]);
      if (node) {
        const x = node.position.x + 80;
        const y = node.position.y + 40;
        setCenter(x, y, { zoom: 1.2, duration: 400 });
        fitView({ nodes: [{ id: ids[0] }], padding: 0.4, duration: 400 });
      }
      return;
    }

    const parsed = parseFocusParam(focusRaw);
    if (!parsed) return;

    let nodeId = entityNodeId(parsed.kind, parsed.entityId);
    if (parsed.kind === 'model') {
      const resolved = resolveModelNodeId(parsed.entityId, nodes, models);
      if (resolved) nodeId = resolved;
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setHighlightedNodeIds([nodeId]);
    const x = node.position.x + 80;
    const y = node.position.y + 40;
    setCenter(x, y, { zoom: 1.2, duration: 400 });
    fitView({ nodes: [{ id: nodeId }], padding: 0.4, duration: 400 });
  }, [
    focusRaw,
    highlightRaw,
    nodes,
    pipelineData?.models,
    setSelectedNodeId,
    setSelectedNodeIds,
    setHighlightedNodeIds,
    fitView,
    setCenter,
  ]);
}
