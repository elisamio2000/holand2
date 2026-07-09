export interface SpatialMember {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface SpatialBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function unionSpatialBounds(members: SpatialMember[]): SpatialBounds | null {
  if (!members.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of members) {
    minX = Math.min(minX, m.x);
    minY = Math.min(minY, m.y);
    maxX = Math.max(maxX, m.x + m.width);
    maxY = Math.max(maxY, m.y + m.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function scaleGroupMembers(
  members: SpatialMember[],
  initialBounds: SpatialBounds,
  newBounds: SpatialBounds
): Map<string, SpatialMember> {
  const out = new Map<string, SpatialMember>();
  if (initialBounds.width <= 0 || initialBounds.height <= 0) return out;
  const scaleX = newBounds.width / initialBounds.width;
  const scaleY = newBounds.height / initialBounds.height;
  for (const m of members) {
    const relX = (m.x - initialBounds.x) / initialBounds.width;
    const relY = (m.y - initialBounds.y) / initialBounds.height;
    out.set(m.id, {
      ...m,
      x: newBounds.x + relX * newBounds.width,
      y: newBounds.y + relY * newBounds.height,
      width: Math.max(8, m.width * scaleX),
      height: Math.max(8, m.height * scaleY),
    });
  }
  return out;
}

export function rotateGroupMembers(
  members: SpatialMember[],
  pivotX: number,
  pivotY: number,
  deltaDeg: number
): Map<string, SpatialMember> {
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const out = new Map<string, SpatialMember>();
  for (const m of members) {
    const cx = m.x + m.width / 2;
    const cy = m.y + m.height / 2;
    const dx = cx - pivotX;
    const dy = cy - pivotY;
    const ncx = pivotX + dx * cos - dy * sin;
    const ncy = pivotY + dx * sin + dy * cos;
    out.set(m.id, {
      ...m,
      x: ncx - m.width / 2,
      y: ncy - m.height / 2,
      rotation: Math.round((m.rotation ?? 0) + deltaDeg),
    });
  }
  return out;
}
