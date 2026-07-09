import type { BoardConnectorObject, BoardNodeObject, BoardObject, BoardObjectBase } from '../board-types';
import { anchorOnNodeShape, nodeShapeBounds, normalizeNodeShape } from './node-shape';
import { rotatePoint } from './shape-world-geometry';

export type ConnectorSpatial = BoardObject & BoardObjectBase;

export interface ConnectorPoint {
  x: number;
  y: number;
}

export type AnchorSide = 'top' | 'bottom' | 'left' | 'right';

export interface AnchorPoint extends ConnectorPoint {
  side: AnchorSide;
}

export interface ObjectBounds {
  cx: number;
  cy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  rotation?: number;
  nodeShape?: BoardNodeObject['nodeShape'];
}

export interface ConnectorRouteResult {
  pathD: string;
  labelX: number;
  labelY: number;
  source: ConnectorPoint;
  target: ConnectorPoint;
  from?: AnchorPoint;
  to?: AnchorPoint;
  bendHandle?: ConnectorPoint;
}

export const ANCHOR_PAD = 6;
export const CONNECTOR_ARROW_TRIM = 4;

export function isConnectorSpatial(obj: BoardObject): obj is ConnectorSpatial {
  return obj.type !== 'connector' && 'x' in obj && 'width' in obj;
}

export function resolveSpatialObject(
  obj: ConnectorSpatial,
  dragPreview?: Map<string, { x: number; y: number }> | null
): ConnectorSpatial {
  const pos = dragPreview?.get(obj.id);
  if (!pos) return obj;
  return { ...obj, x: pos.x, y: pos.y };
}

export function boundsOfObject(obj: ConnectorSpatial): ObjectBounds {
  const base = {
    cx: obj.x + obj.width / 2,
    cy: obj.y + obj.height / 2,
    x: obj.x,
    y: obj.y,
    w: obj.width,
    h: obj.height,
    type: obj.type,
    rotation: obj.rotation ?? 0,
  };
  if (obj.type === 'node') {
    return { ...base, nodeShape: (obj as BoardNodeObject).nodeShape };
  }
  return base;
}

function rotateAnchor(pt: { x: number; y: number }, bounds: ObjectBounds): { x: number; y: number } {
  const rot = bounds.rotation ?? 0;
  if (rot === 0) return pt;
  const [x, y] = rotatePoint(pt.x, pt.y, bounds.cx, bounds.cy, rot);
  return { x, y };
}

/** Comfy/n8n-style smart port picking (workflow-builder parity). */
export function pickAnchorSides(
  source: ObjectBounds,
  target: ObjectBounds
): { from: AnchorSide; to: AnchorSide } {
  const dx = target.cx - source.cx;
  const dy = target.cy - source.cy;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  if (ax > ay * 1.15) {
    return dx > 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
  }
  if (ay > ax * 1.15) {
    return dy > 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
  }
  if (dy <= 0 && ax <= ay) return { from: 'top', to: 'bottom' };
  if (dy > 0 && ax <= ay) return { from: 'bottom', to: 'top' };
  return dx >= 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
}

export function anchorOnSide(bounds: ObjectBounds, side: AnchorSide, pad = ANCHOR_PAD): AnchorPoint {
  let pt: { x: number; y: number };
  if (bounds.type === 'node') {
    const shape = normalizeNodeShape(bounds.nodeShape);
    const nb = nodeShapeBounds(bounds.x, bounds.y, bounds.w, bounds.h);
    pt = anchorOnNodeShape(nb, shape, side, pad);
  } else {
    switch (side) {
      case 'top':
        pt = { x: bounds.cx, y: bounds.y - pad };
        break;
      case 'bottom':
        pt = { x: bounds.cx, y: bounds.y + bounds.h + pad };
        break;
      case 'left':
        pt = { x: bounds.x - pad, y: bounds.cy };
        break;
      case 'right':
        pt = { x: bounds.x + bounds.w + pad, y: bounds.cy };
        break;
    }
  }
  pt = rotateAnchor(pt, bounds);
  return { ...pt, side };
}

export function anchorTowardPoint(bounds: ObjectBounds, tx: number, ty: number): AnchorPoint {
  const dx = tx - bounds.cx;
  const dy = ty - bounds.cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return anchorOnSide(bounds, dx > 0 ? 'right' : 'left');
  }
  return anchorOnSide(bounds, dy > 0 ? 'bottom' : 'top');
}

function portControlPoint(anchor: AnchorPoint, dist: number): ConnectorPoint {
  switch (anchor.side) {
    case 'top':
      return { x: anchor.x, y: anchor.y - dist };
    case 'bottom':
      return { x: anchor.x, y: anchor.y + dist };
    case 'left':
      return { x: anchor.x - dist, y: anchor.y };
    case 'right':
      return { x: anchor.x + dist, y: anchor.y };
  }
}

export function buildCurvedPath(from: AnchorPoint, to: AnchorPoint): string {
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const bend = Math.max(28, Math.min(120, span * 0.38));
  const c1 = portControlPoint(from, bend);
  const c2 = portControlPoint(to, bend);
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`;
}

export function buildOrthogonalPath(from: AnchorPoint, to: AnchorPoint): string {
  const horizFrom = from.side === 'left' || from.side === 'right';
  const horizTo = to.side === 'left' || to.side === 'right';

  if (horizFrom && horizTo) {
    const midX = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
  }
  if (!horizFrom && !horizTo) {
    const midY = (from.y + to.y) / 2;
    return `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`;
  }
  if (horizFrom) {
    const elbowX = from.side === 'right' ? Math.max(from.x, to.x) : Math.min(from.x, to.x);
    return `M ${from.x} ${from.y} L ${elbowX} ${from.y} L ${elbowX} ${to.y} L ${to.x} ${to.y}`;
  }
  const elbowY = from.side === 'bottom' ? Math.max(from.y, to.y) : Math.min(from.y, to.y);
  return `M ${from.x} ${from.y} L ${from.x} ${elbowY} L ${to.x} ${elbowY} L ${to.x} ${to.y}`;
}

function buildOrthogonalPathViaPoints(points: ConnectorPoint[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function labelAlongPath(from: AnchorPoint, to: AnchorPoint, orthogonal: boolean): ConnectorPoint {
  if (orthogonal) {
    const horizFrom = from.side === 'left' || from.side === 'right';
    if (horizFrom) {
      const midX = (from.x + to.x) / 2;
      return { x: midX, y: (from.y + to.y) / 2 };
    }
    const midY = (from.y + to.y) / 2;
    return { x: (from.x + to.x) / 2, y: midY };
  }
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

function trimAlongNormal(anchor: AnchorPoint, amount: number): AnchorPoint {
  switch (anchor.side) {
    case 'top':
      return { ...anchor, y: anchor.y + amount };
    case 'bottom':
      return { ...anchor, y: anchor.y - amount };
    case 'left':
      return { ...anchor, x: anchor.x + amount };
    case 'right':
      return { ...anchor, x: anchor.x - amount };
  }
}

export function resolveSmartAnchors(
  source: ConnectorSpatial,
  target: ConnectorSpatial,
  dragPreview?: Map<string, { x: number; y: number }> | null
): { from: AnchorPoint; to: AnchorPoint } {
  const sObj = resolveSpatialObject(source, dragPreview);
  const tObj = resolveSpatialObject(target, dragPreview);
  const A = boundsOfObject(sObj);
  const B = boundsOfObject(tObj);
  const sides = pickAnchorSides(A, B);
  const from = trimAlongNormal(anchorOnSide(A, sides.from), CONNECTOR_ARROW_TRIM);
  const to = trimAlongNormal(anchorOnSide(B, sides.to), CONNECTOR_ARROW_TRIM);
  return { from, to };
}

function defaultOrthogonalBendFromSides(from: AnchorPoint, to: AnchorPoint): ConnectorPoint {
  const horizFrom = from.side === 'left' || from.side === 'right';
  if (horizFrom) {
    const midX = (from.x + to.x) / 2;
    return { x: midX, y: from.y };
  }
  const midY = (from.y + to.y) / 2;
  return { x: from.x, y: midY };
}

export function objectCenter(obj: ConnectorSpatial): ConnectorPoint {
  return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 };
}

/** Legacy helper for tests */
export function defaultOrthogonalBend(source: ConnectorPoint, target: ConnectorPoint): ConnectorPoint {
  const dx = Math.abs(target.x - source.x);
  const dy = Math.abs(target.y - source.y);
  if (dx >= dy) {
    return { x: (source.x + target.x) / 2, y: source.y };
  }
  return { x: source.x, y: (source.y + target.y) / 2 };
}

export function resolveConnectorEndpoints(
  source: ConnectorSpatial,
  target: ConnectorSpatial,
  dragPreview?: Map<string, { x: number; y: number }> | null
): { source: ConnectorPoint; target: ConnectorPoint } {
  const { from, to } = resolveSmartAnchors(source, target, dragPreview);
  return { source: from, target: to };
}

export function computeConnectorRoute(
  connector: BoardConnectorObject,
  source: ConnectorSpatial,
  target: ConnectorSpatial,
  dragPreview?: Map<string, { x: number; y: number }> | null
): ConnectorRouteResult | null {
  const { from, to } = resolveSmartAnchors(source, target, dragPreview);
  const style = connector.routeStyle ?? 'curved';
  const isLiveDrag = Boolean(dragPreview && dragPreview.size > 0);
  const customBend = isLiveDrag ? undefined : connector.bendPoints?.[0];

  const rawSource = anchorOnSide(boundsOfObject(resolveSpatialObject(source, dragPreview)), from.side);
  const rawTarget = anchorOnSide(boundsOfObject(resolveSpatialObject(target, dragPreview)), to.side);

  if (style === 'straight') {
    return {
      pathD: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      labelX: (from.x + to.x) / 2,
      labelY: (from.y + to.y) / 2,
      source: { x: rawSource.x, y: rawSource.y },
      target: { x: rawTarget.x, y: rawTarget.y },
      from,
      to,
    };
  }

  if (style === 'orthogonal') {
    let pathD = buildOrthogonalPath(from, to);
    let bend = defaultOrthogonalBendFromSides(from, to);
    if (customBend) {
      pathD = buildOrthogonalPathViaPoints([
        from,
        { x: customBend.x, y: from.y },
        { x: customBend.x, y: to.y },
        to,
      ]);
      bend = customBend;
    }
    const label = labelAlongPath(from, to, true);
    return {
      pathD,
      labelX: label.x,
      labelY: label.y,
      source: { x: rawSource.x, y: rawSource.y },
      target: { x: rawTarget.x, y: rawTarget.y },
      from,
      to,
      bendHandle: bend,
    };
  }

  const pathD = buildCurvedPath(from, to);
  const label = labelAlongPath(from, to, false);
  const bendHandle = customBend ?? label;
  return {
    pathD,
    labelX: bendHandle.x,
    labelY: bendHandle.y - 8,
    source: { x: rawSource.x, y: rawSource.y },
    target: { x: rawTarget.x, y: rawTarget.y },
    from,
    to,
    bendHandle,
  };
}

export function reactFlowHandleSides(
  source: ConnectorSpatial,
  target: ConnectorSpatial
): { sourceSide: AnchorSide; targetSide: AnchorSide } {
  const sides = pickAnchorSides(boundsOfObject(source), boundsOfObject(target));
  return { sourceSide: sides.from, targetSide: sides.to };
}

export function routeStyleToFlowEdgeType(
  routeStyle: BoardConnectorObject['routeStyle']
): 'straight' | 'default' | 'smoothstep' {
  if (routeStyle === 'straight') return 'straight';
  if (routeStyle === 'orthogonal') return 'smoothstep';
  return 'default';
}
