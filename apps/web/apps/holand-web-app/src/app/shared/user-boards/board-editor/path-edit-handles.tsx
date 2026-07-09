'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { BoardVectorObject } from '../lib/board-types';
import {
  normalizedPathFromWorldPoints,
  parseNormalizedPathD,
  worldPointsFromNormalizedPath,
  type PathPoint,
} from '../lib/canvas/path-editor';

interface PathEditHandlesProps {
  object: BoardVectorObject;
  readOnly?: boolean;
  onPathChange: (pathD: string, bbox?: { x: number; y: number; width: number; height: number }) => void;
}

export function PathEditHandles({ object, readOnly, onPathChange }: PathEditHandlesProps) {
  const dragRef = useRef<{ idx: number; startPoints: PathPoint[] } | null>(null);
  const pathD = object.geometry.kind === 'path' ? object.geometry.pathD : undefined;
  const points = useMemo(
    () =>
      pathD
        ? worldPointsFromNormalizedPath(pathD, object.x, object.y, object.width, object.height)
        : [],
    [pathD, object.x, object.y, object.width, object.height]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, idx: number) => {
      if (readOnly) return;
      e.stopPropagation();
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragRef.current = { idx, startPoints: [...points] };
    },
    [readOnly, points]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const svg = (e.target as Element).closest('svg');
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const world = pt.matrixTransform(ctm.inverse());
      const next = [...dragRef.current.startPoints];
      next[dragRef.current.idx] = { x: world.x, y: world.y };
      const xs = next.map((p) => p.x);
      const ys = next.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const w = Math.max(1, maxX - minX);
      const h = Math.max(1, maxY - minY);
      const normPts = next.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }));
      const newPathD = normalizedPathFromWorldPoints(
        normPts.map((p) => ({ x: minX + p.x * w, y: minY + p.y * h })),
        minX,
        minY,
        w,
        h
      );
      onPathChange(newPathD, { x: minX, y: minY, width: w, height: h });
    },
    [onPathChange]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  if (!pathD) return null;

  return (
    <g data-board-path-edit pointerEvents="all">
      {points.map((p, idx) => (
        <circle
          key={idx}
          cx={p.x}
          cy={p.y}
          r={5}
          className="fill-white stroke-primary"
          strokeWidth={1.5}
          style={{ cursor: 'move' }}
          onPointerDown={(e) => onPointerDown(e, idx)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      ))}
    </g>
  );
}

export function getPathPointCount(pathD: string): number {
  return parseNormalizedPathD(pathD).length;
}
