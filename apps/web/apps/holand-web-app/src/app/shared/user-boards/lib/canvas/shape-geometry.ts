import type { BoardNodeObject, BoardNodeRole, BoardNodeShape, BoardShapeGeometry, CornerRadii } from '../board-types';
import { ROLE_DEFAULT_SHAPES } from '../node-role-colors';
import type { NodeShapeBounds } from './node-shape';

const DEFAULT_ROUNDED_RX = 8;

export function normalizeNodeShape(shape?: BoardNodeShape): BoardNodeShape {
  return shape ?? 'ellipse';
}

export function resolveCornerRadii(
  geometry: BoardShapeGeometry,
  width: number,
  height: number
): [number, number, number, number] {
  const maxR = Math.min(width, height) / 2;
  if (geometry.cornerRadii !== undefined) {
    if (typeof geometry.cornerRadii === 'number') {
      const r = Math.min(Math.max(0, geometry.cornerRadii), maxR);
      return [r, r, r, r];
    }
    return geometry.cornerRadii.map((r) => Math.min(Math.max(0, r), maxR)) as [
      number,
      number,
      number,
      number,
    ];
  }
  if (geometry.kind === 'preset' && geometry.preset === 'rounded') {
    const r = Math.min(DEFAULT_ROUNDED_RX, maxR);
    return [r, r, r, r];
  }
  return [0, 0, 0, 0];
}

export function resolveGeometryFromNode(node: BoardNodeObject): BoardShapeGeometry {
  if (node.geometry) return node.geometry;
  const preset = normalizeNodeShape(node.nodeShape ?? ROLE_DEFAULT_SHAPES[node.nodeRole]);
  return { kind: 'preset', preset };
}

export function geometryFromPreset(preset: BoardNodeShape, cornerRadii?: CornerRadii): BoardShapeGeometry {
  return {
    kind: 'preset',
    preset,
    ...(cornerRadii !== undefined ? { cornerRadii } : preset === 'rounded' ? { cornerRadii: DEFAULT_ROUNDED_RX } : {}),
  };
}

export function migrateNodeShapeToGeometry(node: BoardNodeObject): BoardNodeObject {
  if (node.geometry) return node;
  const preset = normalizeNodeShape(node.nodeShape);
  return {
    ...node,
    geometry: geometryFromPreset(preset),
  };
}

/** Build SVG path for rounded rect with per-corner radii [tl, tr, br, bl]. */
export function roundedRectPathD(
  x: number,
  y: number,
  w: number,
  h: number,
  radii: [number, number, number, number]
): string {
  const [tl, tr, br, bl] = radii;
  if (tl + tr + br + bl <= 0) {
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  return [
    `M ${x + tl} ${y}`,
    `H ${x + w - tr}`,
    tr > 0 ? `A ${tr} ${tr} 0 0 1 ${x + w} ${y + tr}` : `L ${x + w} ${y}`,
    `V ${y + h - br}`,
    br > 0 ? `A ${br} ${br} 0 0 1 ${x + w - br} ${y + h}` : `L ${x + w} ${y + h}`,
    `H ${x + bl}`,
    bl > 0 ? `A ${bl} ${bl} 0 0 1 ${x} ${y + h - bl}` : `L ${x} ${y + h}`,
    `V ${y + tl}`,
    tl > 0 ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : `L ${x} ${y}`,
    'Z',
  ].join(' ');
}

export function denormalizePathD(pathD: string, x: number, y: number, w: number, h: number): string {
  return pathD.replace(
    /([MLHVCSQTAZmlhvcsqtaz])\s*([-\d.eE+, ]+)/g,
    (match, cmd: string, nums: string) => {
      const upper = cmd.toUpperCase();
      if (upper === 'Z') return cmd;
      const parts = nums.trim().split(/[\s,]+/).map(Number);
      const out: number[] = [];
      for (let i = 0; i < parts.length; i++) {
        if (upper === 'H') {
          out.push(x + parts[i] * w);
        } else if (upper === 'V') {
          out.push(y + parts[i] * h);
        } else if (i % 2 === 0) {
          out.push(x + parts[i] * w);
        } else {
          out.push(y + parts[i] * h);
        }
      }
      return `${cmd} ${out.join(' ')}`;
    }
  );
}

export interface ShapeElementResult {
  type: 'rect' | 'ellipse' | 'polygon' | 'path';
  attrs: Record<string, string | number>;
}

export function getShapeElement(
  geometry: BoardShapeGeometry,
  bounds: NodeShapeBounds,
  fill: string,
  stroke: string,
  strokeWidth: number
): ShapeElementResult {
  const { x, y, width, height, cx, cy } = bounds;
  const preset = geometry.kind === 'preset' ? normalizeNodeShape(geometry.preset) : undefined;

  if (geometry.kind === 'path' && geometry.pathD) {
    return {
      type: 'path',
      attrs: {
        d: denormalizePathD(geometry.pathD, x, y, width, height),
        fill,
        stroke,
        strokeWidth,
      },
    };
  }

  if (preset === 'ellipse') {
    return {
      type: 'ellipse',
      attrs: { cx, cy, rx: width / 2, ry: height / 2, fill, stroke, strokeWidth },
    };
  }
  if (preset === 'diamond') {
    const pts = `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`;
    return { type: 'polygon', attrs: { points: pts, fill, stroke, strokeWidth } };
  }
  const radii = resolveCornerRadii(geometry, width, height);
  const uniform = radii[0] === radii[1] && radii[1] === radii[2] && radii[2] === radii[3];
  if (uniform && radii[0] > 0) {
    return {
      type: 'rect',
      attrs: { x, y, width, height, rx: radii[0], fill, stroke, strokeWidth },
    };
  }
  if (radii.some((r) => r > 0)) {
    return {
      type: 'path',
      attrs: {
        d: roundedRectPathD(x, y, width, height, radii),
        fill,
        stroke,
        strokeWidth,
      },
    };
  }
  return {
    type: 'rect',
    attrs: { x, y, width, height, rx: 0, fill, stroke, strokeWidth },
  };
}

export function nodeShapeRx(shape: BoardNodeShape): number {
  if (shape === 'rounded') return DEFAULT_ROUNDED_RX;
  return 0;
}

export function graphNodeBorderRadius(shape: BoardNodeShape, cornerRadii?: CornerRadii): string | number {
  if (shape === 'ellipse') return 999;
  if (shape === 'rounded') {
    if (typeof cornerRadii === 'number') return cornerRadii;
    return DEFAULT_ROUNDED_RX;
  }
  if (shape === 'diamond') return 4;
  return 0;
}

