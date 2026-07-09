import type { BoardNodeObject, BoardObjectBase, BoardVectorObject } from '../board-types';
import { nodeShapeBounds, type NodeShapeBounds } from './node-shape';
import {
  getShapeElement,
  resolveGeometryFromNode,
  roundedRectPathD,
  type ShapeElementResult,
} from './shape-geometry';

export type WorldRing = [number, number][];

export interface WorldAabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const DEG2RAD = Math.PI / 180;

export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  deg: number
): [number, number] {
  if (deg === 0) return [px, py];
  const rad = deg * DEG2RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

export function rotateRing(ring: WorldRing, cx: number, cy: number, deg: number): WorldRing {
  if (deg === 0) return ring;
  return ring.map(([px, py]) => rotatePoint(px, py, cx, cy, deg));
}

function rectToRing(x: number, y: number, w: number, h: number): WorldRing {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ];
}

function ellipseToRing(cx: number, cy: number, rx: number, ry: number, segments = 32): WorldRing {
  const ring: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return ring;
}

function closeRing(points: [number, number][]): WorldRing {
  if (points.length < 3) return points as WorldRing;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points as WorldRing;
  return [...points, first];
}

function cubicBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  segments: number
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    pts.push([x, y]);
  }
  return pts;
}

function quadraticBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  segments: number
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    pts.push([x, y]);
  }
  return pts;
}

/** Sample an SVG elliptical arc (A command) into line segments. */
function sampleArc(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  xAxisRotation: number,
  largeArc: boolean,
  sweep: boolean,
  x: number,
  y: number,
  segments = 8
): [number, number][] {
  if (rx === 0 || ry === 0) return [[x, y]];

  const phi = xAxisRotation * DEG2RAD;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x0 - x) / 2;
  const dy2 = (y0 - y) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  let sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq));
  sq = Math.sqrt(sq);
  if (largeArc === sweep) sq = -sq;

  const cxp = (sq * rx * y1p) / ry;
  const cyp = (-sq * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let ang = Math.acos(Math.min(Math.max(dot / len, -1), 1));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  const pts: [number, number][] = [];
  for (let i = 1; i <= segments; i++) {
    const t = theta1 + (delta * i) / segments;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const px = cx + rx * cosT * cosPhi - ry * sinT * sinPhi;
    const py = cy + rx * cosT * sinPhi + ry * sinT * cosPhi;
    pts.push([px, py]);
  }
  return pts;
}

/** Flatten SVG path `d` to a closed polygon ring in world coordinates. */
export function flattenPathDToRing(d: string, segmentsPerArc = 8): WorldRing {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens?.length) return [];

  const points: [number, number][] = [];
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const read = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
    } else if (!cmd) {
      i++;
      continue;
    }

    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    cmd = upper;

    switch (cmd) {
      case 'M': {
        cx = read();
        cy = read();
        if (rel) {
          cx += points.length ? points[points.length - 1][0] : 0;
          cy += points.length ? points[points.length - 1][1] : 0;
        }
        sx = cx;
        sy = cy;
        points.push([cx, cy]);
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': {
        let x = read();
        let y = read();
        if (rel) {
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        points.push([cx, cy]);
        break;
      }
      case 'H': {
        let x = read();
        if (rel) x += cx;
        cx = x;
        points.push([cx, cy]);
        break;
      }
      case 'V': {
        let y = read();
        if (rel) y += cy;
        cy = y;
        points.push([cx, cy]);
        break;
      }
      case 'C': {
        const x1 = read() + (rel ? cx : 0);
        const y1 = read() + (rel ? cy : 0);
        const x2 = read() + (rel ? cx : 0);
        const y2 = read() + (rel ? cy : 0);
        let x = read();
        let y = read();
        if (rel) {
          x += cx;
          y += cy;
        }
        const seg = cubicBezier([cx, cy], [x1, y1], [x2, y2], [x, y], segmentsPerArc);
        points.push(...seg);
        cx = x;
        cy = y;
        break;
      }
      case 'Q': {
        const x1 = read() + (rel ? cx : 0);
        const y1 = read() + (rel ? cy : 0);
        let x = read();
        let y = read();
        if (rel) {
          x += cx;
          y += cy;
        }
        const seg = quadraticBezier([cx, cy], [x1, y1], [x, y], segmentsPerArc);
        points.push(...seg);
        cx = x;
        cy = y;
        break;
      }
      case 'A': {
        const rx = read();
        const ry = read();
        const rot = read();
        const laf = read() !== 0;
        const swf = read() !== 0;
        let x = read();
        let y = read();
        if (rel) {
          x += cx;
          y += cy;
        }
        const seg = sampleArc(cx, cy, rx, ry, rot, laf, swf, x, y, segmentsPerArc);
        points.push(...seg);
        cx = x;
        cy = y;
        break;
      }
      case 'Z': {
        cx = sx;
        cy = sy;
        break;
      }
      default:
        break;
    }
  }

  return closeRing(points);
}

export function shapeElementToRing(el: ShapeElementResult, bounds: NodeShapeBounds): WorldRing {
  const { x, y, width, height, cx, cy } = bounds;

  if (el.type === 'rect') {
    const rx = Number(el.attrs.rx ?? 0);
    if (rx > 0) {
      const radii: [number, number, number, number] = [rx, rx, rx, rx];
      return flattenPathDToRing(roundedRectPathD(x, y, width, height, radii));
    }
    return rectToRing(x, y, width, height);
  }

  if (el.type === 'ellipse') {
    const rx = Number(el.attrs.rx ?? width / 2);
    const ry = Number(el.attrs.ry ?? height / 2);
    const ecx = Number(el.attrs.cx ?? cx);
    const ecy = Number(el.attrs.cy ?? cy);
    return ellipseToRing(ecx, ecy, rx, ry);
  }

  if (el.type === 'polygon') {
    const ptsStr = String(el.attrs.points ?? '');
    const pairs = ptsStr.trim().split(/\s+/);
    const pts: [number, number][] = pairs.map((pair) => {
      const [px, py] = pair.split(',').map(Number);
      return [px, py];
    });
    return closeRing(pts);
  }

  if (el.type === 'path' && typeof el.attrs.d === 'string') {
    return flattenPathDToRing(el.attrs.d);
  }

  return rectToRing(x, y, width, height);
}

export type BooleanCapableObject = BoardVectorObject | BoardNodeObject;

export function objectToWorldRing(obj: BooleanCapableObject): WorldRing {
  const { x, y, width, height } = obj;
  const bounds = nodeShapeBounds(x, y, width, height);
  const geometry =
    obj.type === 'vector' ? obj.geometry : resolveGeometryFromNode(obj as BoardNodeObject);
  const el = getShapeElement(geometry, bounds, '#000', '#000', 1);
  let ring = shapeElementToRing(el, bounds);
  const rot = obj.rotation ?? 0;
  if (rot !== 0) {
    ring = rotateRing(ring, bounds.cx, bounds.cy, rot);
  }
  return ring;
}

export function ringToAabb(ring: WorldRing): WorldAabb {
  if (!ring.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function objectToWorldAabb(
  obj: BoardObjectBase & { width: number; height: number; type: string }
): WorldAabb {
  if (obj.type === 'vector' || obj.type === 'node') {
    return ringToAabb(objectToWorldRing(obj as BooleanCapableObject));
  }
  return {
    minX: obj.x,
    minY: obj.y,
    maxX: obj.x + obj.width,
    maxY: obj.y + obj.height,
  };
}

export function aabbIntersects(
  a: WorldAabb,
  b: { x: number; y: number; width: number; height: number }
): boolean {
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  return a.minX < bx2 && a.maxX > b.x && a.minY < by2 && a.maxY > b.y;
}
