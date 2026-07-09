export interface SpatialPosition {
  id: string;
  x: number;
  y: number;
}

export interface DragSession {
  primaryId: string;
  offsetX: number;
  offsetY: number;
  startPositions: Map<string, { x: number; y: number }>;
}

export function createDragSession(
  primaryId: string,
  worldX: number,
  worldY: number,
  objectX: number,
  objectY: number,
  selectedIds: string[],
  allPositions: SpatialPosition[]
): DragSession {
  const ids = selectedIds.includes(primaryId) ? selectedIds : [primaryId];
  const startPositions = new Map<string, { x: number; y: number }>();
  for (const p of allPositions) {
    if (ids.includes(p.id)) startPositions.set(p.id, { x: p.x, y: p.y });
  }
  return {
    primaryId,
    offsetX: worldX - objectX,
    offsetY: worldY - objectY,
    startPositions,
  };
}

export function computeDragPreview(
  session: DragSession,
  worldX: number,
  worldY: number,
  snap: (v: number) => number
): Map<string, { x: number; y: number }> {
  const primaryStart = session.startPositions.get(session.primaryId);
  if (!primaryStart) return new Map();

  const rawX = worldX - session.offsetX;
  const rawY = worldY - session.offsetY;
  const snappedX = snap(rawX);
  const snappedY = snap(rawY);
  const dx = snappedX - primaryStart.x;
  const dy = snappedY - primaryStart.y;

  const out = new Map<string, { x: number; y: number }>();
  for (const [id, start] of session.startPositions) {
    out.set(id, { x: start.x + dx, y: start.y + dy });
  }
  return out;
}

export function dragPreviewToUpdates(preview: Map<string, { x: number; y: number }>): SpatialPosition[] {
  return [...preview.entries()].map(([id, pos]) => ({ id, x: pos.x, y: pos.y }));
}
