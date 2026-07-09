import type { LlmModel } from '@/types/pipeline-admin.types';
import { modelHealthKind } from '@/utils/model-health';
import type {
  TopologyEdge,
  TopologyEdgeKind,
  TopologyNode,
} from './topology-board-types';
import { edgeLabel } from './edge-styles';

export type EdgeSemanticLabel =
  | 'bind'
  | 'fallback'
  | 'route'
  | 'assign'
  | 'service'
  | 'deploy'
  | 'register'
  | 'next'
  | 'true'
  | 'false'
  | 'error'
  | 'loop'
  | 'probe';

export interface EdgeSemantics {
  label: string;
  semantic: EdgeSemanticLabel;
  colorHex: string;
  dashed: boolean;
  animated: boolean;
  tubeRadius: number;
}

function healthStroke(
  targetModelName: string | undefined,
  models: LlmModel[],
  invalid?: boolean
): { color: string; animated: boolean } {
  if (invalid) return { color: '#ef4444', animated: false };
  if (!targetModelName) return { color: '#64748b', animated: false };
  const model = models.find((m) => m.name === targetModelName);
  const hk = model ? modelHealthKind(model) : 'unknown';
  if (hk === 'healthy') return { color: '#22c55e', animated: true };
  if (hk === 'unhealthy') return { color: '#ef4444', animated: false };
  return { color: '#6366f1', animated: false };
}

function targetModelName(node: TopologyNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.data.kind === 'model') return node.data.entityId;
  return undefined;
}

function isFallbackEdge(
  edge: TopologyEdge,
  source: TopologyNode | undefined,
  target: TopologyNode | undefined
): boolean {
  if (edge.data?.edgeKind === 'loop') return true;
  if (!source || !target || target.data.kind !== 'model') return false;
  const modelName = target.data.entityId;
  if (source.data.kind === 'tool' || source.data.kind === 'plugin') {
    return source.data.binding?.fallback_model === modelName;
  }
  if (source.data.kind === 'route') {
    return source.data.route?.fallback_model_name === modelName;
  }
  if (source.data.kind === 'service') {
    return source.data.serviceBinding?.fallback_model_name === modelName;
  }
  return false;
}

/** Unified edge label + style for topology board views */
export function resolveEdgeSemantics(
  edge: TopologyEdge,
  sourceNode: TopologyNode | undefined,
  targetNode: TopologyNode | undefined,
  models: LlmModel[] = [],
  allEdges: TopologyEdge[] = [],
  allNodes: TopologyNode[] = []
): EdgeSemantics {
  const edgeKind: TopologyEdgeKind = edge.data?.edgeKind ?? 'primary';
  const invalid = edge.data?.invalid;
  const targetName = targetModelName(targetNode);

  if (edgeKind === 'loop') {
    return {
      label: edgeLabel('loop'),
      semantic: 'loop',
      colorHex: '#a855f7',
      dashed: true,
      animated: false,
      tubeRadius: 0.08,
    };
  }
  if (edgeKind === 'success') {
    return {
      label: edgeLabel('success'),
      semantic: 'true',
      colorHex: '#22c55e',
      dashed: false,
      animated: false,
      tubeRadius: 0.09,
    };
  }
  if (edgeKind === 'failure') {
    return {
      label: edgeLabel('failure'),
      semantic: 'false',
      colorHex: '#ef4444',
      dashed: true,
      animated: false,
      tubeRadius: 0.09,
    };
  }
  if (edgeKind === 'error_handler') {
    return {
      label: edgeLabel('error_handler'),
      semantic: 'error',
      colorHex: '#f97316',
      dashed: true,
      animated: false,
      tubeRadius: 0.09,
    };
  }

  if (isFallbackEdge(edge, sourceNode, targetNode)) {
    let active = false;
    if (sourceNode && allEdges.length > 0) {
      const primaryModel =
        sourceNode.data.kind === 'tool' || sourceNode.data.kind === 'plugin'
          ? sourceNode.data.binding?.model
          : sourceNode.data.kind === 'route'
            ? sourceNode.data.route?.model_name
            : sourceNode.data.kind === 'service'
              ? sourceNode.data.serviceBinding?.model_name
              : undefined;
      if (primaryModel) {
        const primaryModelNode = allNodes.find(
          (n) => n.data.kind === 'model' && n.data.entityId === primaryModel
        );
        const primaryEdge = allEdges.find(
          (e) => e.source === sourceNode.id && e.target === primaryModelNode?.id
        );
        if (primaryEdge) {
          const primaryTarget = allNodes.find((n) => n.id === primaryEdge.target);
          const primaryName = targetModelName(primaryTarget);
          const hk = primaryName
            ? modelHealthKind(models.find((m) => m.name === primaryName) ?? ({} as LlmModel))
            : 'unknown';
          active = hk === 'unhealthy' || hk === 'unknown';
        }
      }
    }
    return {
      label: active ? 'fallback · active' : 'fallback',
      semantic: 'fallback',
      colorHex: '#a855f7',
      dashed: true,
      animated: active,
      tubeRadius: 0.08,
    };
  }

  const sk = sourceNode?.data.kind;
  const tk = targetNode?.data.kind;

  if (sk === 'tool' || sk === 'plugin') {
    const h = healthStroke(targetName, models, invalid);
    return {
      label: 'bind',
      semantic: 'bind',
      colorHex: h.color,
      dashed: false,
      animated: h.animated,
      tubeRadius: 0.1,
    };
  }
  if (sk === 'route') {
    const h = healthStroke(targetName, models, invalid);
    return {
      label: 'route',
      semantic: 'route',
      colorHex: h.color,
      dashed: false,
      animated: h.animated,
      tubeRadius: 0.1,
    };
  }
  if (sk === 'role') {
    const h = healthStroke(targetName, models, invalid);
    return {
      label: 'assign',
      semantic: 'assign',
      colorHex: h.color,
      dashed: false,
      animated: h.animated,
      tubeRadius: 0.1,
    };
  }
  if (sk === 'service') {
    const h = healthStroke(targetName, models, invalid);
    return {
      label: 'service',
      semantic: 'service',
      colorHex: h.color,
      dashed: false,
      animated: h.animated,
      tubeRadius: 0.1,
    };
  }
  if (edge.data?.uiSemantic === 'register' || (sk === 'remoteNode' && tk === 'model')) {
    return {
      label: 'register',
      semantic: 'register',
      colorHex: '#06b6d4',
      dashed: false,
      animated: false,
      tubeRadius: 0.09,
    };
  }

  if (edge.data?.uiSemantic === 'deploy' || (sk === 'model' && tk === 'remoteNode')) {
    return {
      label: 'deploy',
      semantic: 'deploy',
      colorHex: '#06b6d4',
      dashed: false,
      animated: false,
      tubeRadius: 0.1,
    };
  }
  if (sk === 'endpoint' || tk === 'endpoint') {
    return {
      label: 'probe',
      semantic: 'probe',
      colorHex: invalid ? '#ef4444' : '#6366f1',
      dashed: !!invalid,
      animated: false,
      tubeRadius: 0.09,
    };
  }

  const h = healthStroke(targetName, models, invalid);
  return {
    label: edgeLabel('primary'),
    semantic: 'next',
    colorHex: h.color,
    dashed: false,
    animated: h.animated,
    tubeRadius: 0.1,
  };
}

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Live wire label while dragging a connection on the board (no persisted edge yet). */
export function previewConnectionSemantics(
  sourceNode: TopologyNode,
  targetNode: TopologyNode | undefined,
  models: LlmModel[] = []
): EdgeSemantics {
  const fakeEdge = {
    id: '__preview__',
    source: sourceNode.id,
    target: targetNode?.id ?? '',
    data: {},
  } as TopologyEdge;
  return resolveEdgeSemantics(fakeEdge, sourceNode, targetNode, models);
}
