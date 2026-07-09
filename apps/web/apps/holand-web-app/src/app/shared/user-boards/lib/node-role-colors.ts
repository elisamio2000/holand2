import type { BoardNodeRole, BoardNodeShape } from './board-types';

export const NODE_COLORS: Record<BoardNodeRole, string> = {
  person: '#3b82f6',
  organization: '#8b5cf6',
  evidence: '#f59e0b',
  topic: '#22c55e',
  question: '#ef4444',
  custom: '#64748b',
};

export const ROLE_DEFAULT_SHAPES: Record<BoardNodeRole, BoardNodeShape> = {
  person: 'ellipse',
  organization: 'rounded',
  evidence: 'diamond',
  topic: 'rounded',
  question: 'rectangle',
  custom: 'ellipse',
};

export function resolveNodeColor(
  nodeRole: BoardNodeRole,
  boardDefaultNodeColor?: string
): string {
  if (nodeRole === 'custom') {
    return boardDefaultNodeColor ?? NODE_COLORS.custom;
  }
  return NODE_COLORS[nodeRole];
}

export function resolveNodeShape(
  nodeRole: BoardNodeRole,
  explicit?: BoardNodeShape
): BoardNodeShape {
  return explicit ?? ROLE_DEFAULT_SHAPES[nodeRole];
}
