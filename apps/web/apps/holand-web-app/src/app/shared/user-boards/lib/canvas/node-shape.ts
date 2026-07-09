import type { BoardNodeObject, BoardNodeShape } from '../board-types';
import type { AnchorSide } from './connector-routing';
import {
  getShapeElement,
  normalizeNodeShape as normalizeShape,
  resolveGeometryFromNode,
  nodeShapeRx,
  graphNodeBorderRadius,
} from './shape-geometry';

export interface NodeShapeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export function nodeShapeBounds(x: number, y: number, width: number, height: number): NodeShapeBounds {
  return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
}

export function normalizeNodeShape(shape?: BoardNodeShape): BoardNodeShape {
  return normalizeShape(shape);
}

export { nodeShapeRx, graphNodeBorderRadius, resolveGeometryFromNode };

/** Anchor on shape boundary toward a side (rectangle-based for non-ellipse). */
export function anchorOnNodeShape(
  bounds: NodeShapeBounds,
  shape: BoardNodeShape,
  side: AnchorSide,
  pad = 6
): { x: number; y: number } {
  const { cx, cy, x, y, width: w, height: h } = bounds;
  if (shape === 'ellipse') {
    const rx = w / 2;
    const ry = h / 2;
    switch (side) {
      case 'top':
        return { x: cx, y: cy - ry - pad };
      case 'bottom':
        return { x: cx, y: cy + ry + pad };
      case 'left':
        return { x: cx - rx - pad, y: cy };
      case 'right':
        return { x: cx + rx + pad, y: cy };
    }
  }
  if (shape === 'diamond') {
    switch (side) {
      case 'top':
        return { x: cx, y: y - pad };
      case 'bottom':
        return { x: cx, y: y + h + pad };
      case 'left':
        return { x: x - pad, y: cy };
      case 'right':
        return { x: x + w + pad, y: cy };
    }
  }
  switch (side) {
    case 'top':
      return { x: cx, y: y - pad };
    case 'bottom':
      return { x: cx, y: y + h + pad };
    case 'left':
      return { x: x - pad, y: cy };
    case 'right':
      return { x: x + w + pad, y: cy };
  }
}

export interface NodeShapeSvgProps {
  shape?: BoardNodeShape;
  node?: BoardNodeObject;
  bounds: NodeShapeBounds;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

/** Returns SVG element props for the node body (inside optional transform group). */
export function getNodeShapeElement(props: NodeShapeSvgProps): {
  type: 'rect' | 'ellipse' | 'polygon' | 'path';
  attrs: Record<string, string | number>;
} {
  const geometry = props.node
    ? resolveGeometryFromNode(props.node)
    : { kind: 'preset' as const, preset: normalizeNodeShape(props.shape) };
  return getShapeElement(geometry, props.bounds, props.fill, props.stroke, props.strokeWidth);
}
