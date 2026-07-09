'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { BoardNodeObject, CornerRadii } from '../lib/board-types';
import { resolveCornerRadii, resolveGeometryFromNode } from '../lib/canvas/shape-geometry';

/** Minimum inset from corner so handles don't overlap resize grips. */
const HANDLE_INSET_MIN = 18;

/** Per-corner inward axis: dragging along this direction increases radius. */
const INWARD_SIGN: [number, number][] = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

interface CornerRadiusHandlesProps {
  object: BoardNodeObject;
  readOnly?: boolean;
  onCornerRadiiChange: (cornerRadii: CornerRadii) => void;
}

function handlePosition(
  corner: number,
  object: BoardNodeObject,
  radii: [number, number, number, number]
): { hx: number; hy: number } {
  const inset = (r: number) => Math.max(r, HANDLE_INSET_MIN);
  switch (corner) {
    case 0:
      return { hx: object.x + inset(radii[0]), hy: object.y + inset(radii[0]) };
    case 1:
      return {
        hx: object.x + object.width - inset(radii[1]),
        hy: object.y + inset(radii[1]),
      };
    case 2:
      return {
        hx: object.x + object.width - inset(radii[2]),
        hy: object.y + object.height - inset(radii[2]),
      };
  }
  return {
    hx: object.x + inset(radii[3]),
    hy: object.y + object.height - inset(radii[3]),
  };
}

export function CornerRadiusHandles({ object, readOnly, onCornerRadiiChange }: CornerRadiusHandlesProps) {
  const geometry = resolveGeometryFromNode(object);
  const preset = geometry.kind === 'preset' ? geometry.preset : undefined;
  const isEligible = preset === 'rectangle' || preset === 'rounded';
  const radii = useMemo((): [number, number, number, number] => {
    if (!isEligible) return [0, 0, 0, 0];
    return resolveCornerRadii(geometry, object.width, object.height);
  }, [geometry, isEligible, object.width, object.height]);
  const dragRef = useRef<{ corner: number; startX: number; startY: number; startR: number } | null>(null);

  const corners = [0, 1, 2, 3].map((idx) => ({
    idx,
    ...handlePosition(idx, object, radii),
  }));

  const onPointerDown = useCallback(
    (e: React.PointerEvent, corner: number) => {
      if (readOnly) return;
      e.stopPropagation();
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragRef.current = {
        corner,
        startX: e.clientX,
        startY: e.clientY,
        startR: radii[corner],
      };
    },
    [readOnly, radii]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const { corner, startX, startY, startR } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const [sx, sy] = INWARD_SIGN[corner];
      const delta = (dx * sx + dy * sy) / 2;
      const maxR = Math.min(object.width, object.height) / 2;
      const nextR = Math.min(maxR, Math.max(0, startR + delta * 0.5));
      const next: [number, number, number, number] = [...radii] as [number, number, number, number];
      next[corner] = nextR;
      onCornerRadiiChange(next);
    },
    [object.width, object.height, radii, onCornerRadiiChange]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  if (!isEligible) return null;

  return (
    <g data-board-corner-handles pointerEvents="all">
      {corners.map(({ idx, hx, hy }) => (
        <circle
          key={idx}
          cx={hx}
          cy={hy}
          r={4.5}
          className="fill-white stroke-primary"
          strokeWidth={1.5}
          style={{ cursor: 'crosshair' }}
          onPointerDown={(e) => onPointerDown(e, idx)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      ))}
    </g>
  );
}
