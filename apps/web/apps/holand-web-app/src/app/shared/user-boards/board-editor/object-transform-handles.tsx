'use client';

import type { BoardObjectBase } from '../lib/board-types';
import type { ResizeCorner } from '../lib/canvas/resize-session';

const HANDLE = 10;

interface ObjectTransformHandlesProps {
  object: BoardObjectBase;
  onResizeStart: (e: React.PointerEvent, corner: ResizeCorner) => void;
  onRotateStart?: (e: React.PointerEvent) => void;
}

export function ObjectTransformHandles({
  object,
  onResizeStart,
  onRotateStart,
}: ObjectTransformHandlesProps) {
  const { x, y, width, height } = object;
  const corners: { corner: ResizeCorner; hx: number; hy: number; cursor: string }[] = [
    { corner: 'nw', hx: x, hy: y, cursor: 'nwse-resize' },
    { corner: 'ne', hx: x + width, hy: y, cursor: 'nesw-resize' },
    { corner: 'sw', hx: x, hy: y + height, cursor: 'nesw-resize' },
    { corner: 'se', hx: x + width, hy: y + height, cursor: 'nwse-resize' },
  ];
  const rotY = y - 24;

  return (
    <g data-board-transform-handles={object.id} pointerEvents="all">
      {onRotateStart ? (
        <>
          <line
            x1={x + width / 2}
            y1={y}
            x2={x + width / 2}
            y2={rotY + HANDLE / 2}
            stroke="var(--primary-default)"
            strokeWidth={1}
            className="pointer-events-none"
          />
          <circle
            cx={x + width / 2}
            cy={rotY}
            r={HANDLE / 2 + 1}
            className="fill-white stroke-primary"
            strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onRotateStart(e);
            }}
          />
        </>
      ) : null}
      {corners.map(({ corner, hx, hy, cursor }) => (
        <rect
          key={corner}
          x={hx - HANDLE / 2}
          y={hy - HANDLE / 2}
          width={HANDLE}
          height={HANDLE}
          rx={2}
          className="fill-primary stroke-white"
          strokeWidth={1.5}
          style={{ cursor }}
          data-board-resize-handle={object.id}
          data-board-resize-corner={corner}
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, corner);
          }}
        />
      ))}
    </g>
  );
}
