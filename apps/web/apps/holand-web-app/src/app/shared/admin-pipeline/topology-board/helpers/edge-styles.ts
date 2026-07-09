import type { Edge } from '@xyflow/react';
import { modelHealthKind } from '@/utils/model-health';
import type { LlmModel } from '@/types/pipeline-admin.types';
import type { TopologyEdgeKind } from './topology-board-types';

export function edgeLabel(kind: TopologyEdgeKind): string {
  switch (kind) {
    case 'loop':
      return 'next · loop';
    case 'success':
      return 'true';
    case 'failure':
      return 'false';
    case 'error_handler':
      return 'error';
    default:
      return 'next';
  }
}

export { resolveEdgeSemantics, type EdgeSemantics, type EdgeSemanticLabel } from './edge-semantics';

export function buildEdgeStyle(
  edgeKind: TopologyEdgeKind,
  targetModelName: string,
  models: LlmModel[],
  invalid?: boolean
): Pick<Edge, 'style' | 'animated' | 'label'> {
  if (edgeKind === 'loop') {
    return {
      label: edgeLabel('loop'),
      style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '6 4' },
    };
  }
  if (edgeKind === 'success') {
    return {
      label: edgeLabel('success'),
      style: { stroke: '#22c55e', strokeWidth: 2 },
    };
  }
  if (edgeKind === 'failure') {
    return {
      label: edgeLabel('failure'),
      style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '4 3' },
    };
  }
  if (edgeKind === 'error_handler') {
    return {
      label: edgeLabel('error_handler'),
      style: { stroke: '#f97316', strokeWidth: 2, strokeDasharray: '8 4' },
    };
  }
  const model = models.find((m) => m.name === targetModelName);
  const healthKind = model ? modelHealthKind(model) : 'unknown';
  return {
    label: edgeLabel('primary'),
    animated: healthKind === 'healthy' && !invalid,
    style: {
      stroke: invalid
        ? '#ef4444'
        : healthKind === 'healthy'
          ? '#22c55e'
          : healthKind === 'unhealthy'
            ? '#ef4444'
            : '#6366f1',
      strokeWidth: 2,
    },
  };
}
