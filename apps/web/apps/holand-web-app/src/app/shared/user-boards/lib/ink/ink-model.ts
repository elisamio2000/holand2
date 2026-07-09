import { createId } from '@paralleldrive/cuid2';
import type { BoardDrawSettings, BoardInkStroke } from '../board-types';

export function createInkStroke(
  settings: BoardDrawSettings,
  start: { x: number; y: number }
): BoardInkStroke {
  return {
    id: createId(),
    color: settings.color,
    width: settings.width,
    tool: settings.tool === 'eraser' ? 'pen' : settings.tool,
    opacity: settings.tool === 'highlighter' ? 0.35 : 1,
    points: [start],
  };
}

export function appendInkPoint(stroke: BoardInkStroke, point: { x: number; y: number }): BoardInkStroke {
  const last = stroke.points[stroke.points.length - 1];
  if (last && Math.hypot(last.x - point.x, last.y - point.y) < 0.5) return stroke;
  return { ...stroke, points: [...stroke.points, point] };
}

export function strokeToPathD(stroke: BoardInkStroke): string {
  if (stroke.points.length < 2) return '';
  return stroke.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export function inkStrokeStyle(stroke: BoardInkStroke): {
  stroke: string;
  strokeWidth: number;
  opacity: number;
} {
  return {
    stroke: stroke.color,
    strokeWidth: stroke.width,
    opacity: stroke.opacity ?? 1,
  };
}
