export interface ConnectSession {
  sourceId: string;
  cursorX: number;
  cursorY: number;
  startX: number;
  startY: number;
  moved: boolean;
  sourcePort?: 'top' | 'bottom';
}

const MOVE_THRESHOLD = 4;

export const CONNECTABLE_TYPES = new Set(['node', 'sticky', 'media', 'frame']);

export function isConnectableType(type: string | undefined): boolean {
  return type !== undefined && CONNECTABLE_TYPES.has(type);
}

export function createConnectSession(
  sourceId: string,
  x: number,
  y: number,
  sourcePort?: 'top' | 'bottom'
): ConnectSession {
  return { sourceId, cursorX: x, cursorY: y, startX: x, startY: y, moved: false, sourcePort };
}

export function updateConnectCursor(
  session: ConnectSession,
  x: number,
  y: number
): ConnectSession {
  const moved =
    session.moved ||
    Math.hypot(x - session.startX, y - session.startY) > MOVE_THRESHOLD;
  return { ...session, cursorX: x, cursorY: y, moved };
}

/** Exit point on circle boundary toward target */
export function getCircleBoundaryPoint(
  cx: number,
  cy: number,
  radius: number,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const dx = targetX - cx;
  const dy = targetY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { x: cx + radius, y: cy };
  return {
    x: cx + (dx / dist) * radius,
    y: cy + (dy / dist) * radius,
  };
}

/** Exit point on rect boundary toward target */
export function getRectBoundaryPoint(
  rect: { x: number; y: number; width: number; height: number },
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: rect.y };
  }
  const hw = rect.width / 2;
  const hh = rect.height / 2;
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function getObjectAnchorPoint(
  obj: { type: string; x: number; y: number; width: number; height: number },
  targetX: number,
  targetY: number,
  port?: 'top' | 'bottom' | 'center'
): { x: number; y: number } {
  if (obj.type === 'node') {
    const cx = obj.x + obj.width / 2;
    const cy = obj.y + obj.height / 2;
    const r = Math.min(obj.width, obj.height) / 2;
    if (port === 'top') return { x: cx, y: cy - r };
    if (port === 'bottom') return { x: cx, y: cy + r };
    return getCircleBoundaryPoint(cx, cy, r, targetX, targetY);
  }
  const rect = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
  if (port === 'top') return { x: rect.x + rect.width / 2, y: rect.y };
  if (port === 'bottom') return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  return getRectBoundaryPoint(rect, targetX, targetY);
}

export function resolveConnectTargetId(element: Element | null): string | null {
  let el: Element | null = element;
  while (el) {
    const id = el.getAttribute?.('data-board-object');
    const type = el.getAttribute?.('data-board-type');
    if (id && type && isConnectableType(type)) return id;
    el = el.parentElement;
  }
  return null;
}
