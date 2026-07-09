import type { BoardInkStroke } from '../board-types';

function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function distanceToStroke(stroke: BoardInkStroke, x: number, y: number): number {
  const pts = stroke.points;
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return Math.hypot(pts[0].x - x, pts[0].y - y);
  let min = Infinity;
  for (let i = 1; i < pts.length; i++) {
    min = Math.min(min, distancePointToSegment(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
  }
  return min;
}

export function findStrokeAtPoint(
  strokes: BoardInkStroke[],
  x: number,
  y: number,
  threshold: number
): BoardInkStroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    const hitDist = Math.max(threshold, s.width / 2 + 2);
    if (distanceToStroke(s, x, y) <= hitDist) return s;
  }
  return null;
}

export function eraseStrokesAtPoint(
  strokes: BoardInkStroke[],
  x: number,
  y: number,
  eraserWidth: number
): BoardInkStroke[] {
  const threshold = eraserWidth / 2 + 2;
  return strokes.filter((s) => distanceToStroke(s, x, y) > threshold);
}
