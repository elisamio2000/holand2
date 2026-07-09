import type { CSSProperties } from 'react';
import type { TopologyEntityKind } from './topology-board-types';

export type TopologyNodeShape =
  | 'rectangle'
  | 'hexagon'
  | 'diamond'
  | 'circle'
  | 'pill'
  | 'parallelogram';

export const TOPOLOGY_NODE_SHAPE_OPTIONS: {
  value: TopologyNodeShape;
  labelKey: string;
  fallback: string;
}[] = [
  { value: 'rectangle', labelKey: 'pipeline.topology.board.shapes.rectangle', fallback: 'Rectangle' },
  { value: 'hexagon', labelKey: 'pipeline.topology.board.shapes.hexagon', fallback: 'Hexagon' },
  { value: 'diamond', labelKey: 'pipeline.topology.board.shapes.diamond', fallback: 'Diamond' },
  { value: 'circle', labelKey: 'pipeline.topology.board.shapes.circle', fallback: 'Circle' },
  { value: 'pill', labelKey: 'pipeline.topology.board.shapes.pill', fallback: 'Pill' },
  {
    value: 'parallelogram',
    labelKey: 'pipeline.topology.board.shapes.parallelogram',
    fallback: 'Parallelogram',
  },
];

/** Entity kinds users can assign a canvas shape to (groups keep their own frame). */
export const SHAPE_CONFIGURABLE_KINDS: TopologyEntityKind[] = [
  'tool',
  'route',
  'role',
  'model',
  'endpoint',
  'remoteNode',
  'plugin',
  'service',
];

export const DEFAULT_NODE_SHAPES: Record<TopologyEntityKind, TopologyNodeShape> = {
  tool: 'rectangle',
  route: 'hexagon',
  role: 'rectangle',
  model: 'rectangle',
  endpoint: 'rectangle',
  remoteNode: 'rectangle',
  plugin: 'rectangle',
  service: 'rectangle',
  group: 'rectangle',
};

export type TopologyNodeShapeMap = Partial<Record<TopologyEntityKind, TopologyNodeShape>>;

export function mergeNodeShapes(
  partial?: TopologyNodeShapeMap | null
): Record<TopologyEntityKind, TopologyNodeShape> {
  return { ...DEFAULT_NODE_SHAPES, ...(partial ?? {}) };
}

export function getNodeShapeForKind(
  kind: TopologyEntityKind,
  shapes?: TopologyNodeShapeMap | null
): TopologyNodeShape {
  return shapes?.[kind] ?? DEFAULT_NODE_SHAPES[kind];
}

export function isClipPathShape(shape: TopologyNodeShape): boolean {
  return shape === 'hexagon' || shape === 'diamond' || shape === 'parallelogram';
}

export function nodeShapeStyle(shape: TopologyNodeShape): CSSProperties {
  switch (shape) {
    case 'hexagon':
      return {
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
      };
    case 'diamond':
      return { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' };
    case 'parallelogram':
      return { clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' };
    case 'circle':
      return { borderRadius: '9999px', minWidth: 88, minHeight: 88 };
    case 'pill':
      return { borderRadius: '9999px' };
    case 'rectangle':
    default:
      return {};
  }
}

export function nodeShapePreviewStyle(shape: TopologyNodeShape): CSSProperties {
  switch (shape) {
    case 'hexagon':
      return {
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
      };
    case 'diamond':
      return { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' };
    case 'parallelogram':
      return { clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' };
    case 'circle':
    case 'pill':
      return { borderRadius: '9999px' };
    case 'rectangle':
    default:
      return { borderRadius: 4 };
  }
}
