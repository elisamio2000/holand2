'use client';

import { memo } from 'react';
import type { BoardVectorObject } from '../../lib/board-types';
import { getShapeElement } from '../../lib/canvas/shape-geometry';
import { nodeShapeBounds } from '../../lib/canvas/node-shape';
import { renderShapeSvgElement } from './shape-body';

interface VectorObjectProps {
  object: BoardVectorObject;
  selected: boolean;
  onSelect: (e: React.PointerEvent) => void;
  onDragStart: (e: React.PointerEvent) => void;
}

function VectorObjectViewInner({ object, selected, onSelect, onDragStart }: VectorObjectProps) {
  const bounds = nodeShapeBounds(object.x, object.y, object.width, object.height);
  const { cx, cy } = bounds;
  const el = getShapeElement(
    object.geometry,
    bounds,
    object.fill,
    selected ? 'var(--primary-default)' : object.stroke ?? '#94a3b8',
    selected ? 2.5 : object.strokeWidth ?? 1
  );
  const rot = object.rotation ?? 0;
  const transform = rot !== 0 ? `rotate(${rot} ${cx} ${cy})` : undefined;
  const body = renderShapeSvgElement(el, selected);

  return (
    <g
      data-board-object={object.id}
      data-board-type="vector"
      opacity={object.opacity ?? 1}
      onPointerDown={(e) => {
        if (!object.locked) onDragStart(e);
        onSelect(e);
      }}
      className={object.locked ? 'cursor-not-allowed' : 'cursor-grab'}
    >
      {selected ? (
        <rect
          x={object.x - 5}
          y={object.y - 5}
          width={object.width + 10}
          height={object.height + 10}
          fill="none"
          stroke="var(--primary-default)"
          strokeWidth={2}
          strokeDasharray="4 2"
          opacity={0.85}
          className="pointer-events-none"
          rx={4}
        />
      ) : null}
      {transform ? <g transform={transform}>{body}</g> : body}
      {object.label ? (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="pointer-events-none fill-slate-800 text-[10px]"
          transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
        >
          {object.label.length > 14 ? `${object.label.slice(0, 12)}…` : object.label}
        </text>
      ) : null}
    </g>
  );
}

export const VectorObjectView = memo(VectorObjectViewInner);
