'use client';

import { memo } from 'react';
import cn from '@core/utils/class-names';
import type { BoardNodeObject } from '../../lib/board-types';
import {
  getNodeShapeElement,
  nodeShapeBounds,
} from '../../lib/canvas/node-shape';
import { renderShapeSvgElement } from './shape-body';

interface NodeObjectProps {
  object: BoardNodeObject;
  selected: boolean;
  dimmed?: boolean;
  anchorPeerCount?: number;
  onSelect: (e: React.PointerEvent) => void;
  onDragStart: (e: React.PointerEvent) => void;
  showConnectPorts?: boolean;
  onConnectPortPointerDown?: (e: React.PointerEvent, port: 'top' | 'bottom') => void;
  onConnectBodyPointerDown?: (e: React.PointerEvent) => void;
}

function NodeBody({
  object,
  selected,
}: {
  object: BoardNodeObject;
  selected: boolean;
}) {
  const bounds = nodeShapeBounds(object.x, object.y, object.width, object.height);
  const el = getNodeShapeElement({
    node: object,
    bounds,
    fill: object.color,
    stroke: selected ? 'var(--primary-default)' : '#94a3b8',
    strokeWidth: selected ? 2.5 : 1,
  });
  const rot = object.rotation ?? 0;
  const transform =
    rot !== 0 ? `rotate(${rot} ${bounds.cx} ${bounds.cy})` : undefined;

  const body = renderShapeSvgElement(el, selected);

  if (transform) {
    return <g transform={transform}>{body}</g>;
  }
  return body;
}

function NodeObjectViewInner({
  object,
  selected,
  dimmed,
  anchorPeerCount = 0,
  onSelect,
  onDragStart,
  showConnectPorts,
  onConnectPortPointerDown,
  onConnectBodyPointerDown,
}: NodeObjectProps) {
  const bounds = nodeShapeBounds(object.x, object.y, object.width, object.height);
  const { cx, cy } = bounds;
  const r = Math.min(object.width, object.height) / 2;

  return (
    <g
      data-board-object={object.id}
      data-board-type="node"
      opacity={dimmed ? 0.15 : (object.opacity ?? 1)}
      style={dimmed ? { pointerEvents: 'none' } : undefined}
      onPointerDown={(e) => {
        if (dimmed) return;
        if (showConnectPorts) {
          e.stopPropagation();
          onConnectBodyPointerDown?.(e);
          return;
        }
        if (!object.locked) onDragStart(e);
        onSelect(e);
      }}
      className={object.locked ? 'cursor-not-allowed' : showConnectPorts ? 'cursor-crosshair' : 'cursor-grab'}
    >
      {selected && !dimmed ? (
        <>
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
        </>
      ) : null}
      {showConnectPorts && !dimmed ? (
        <>
          <rect
            x={cx - 4}
            y={cy - r - 4}
            width={8}
            height={8}
            className="fill-slate-800 stroke-white"
            strokeWidth={1}
            data-board-connect-port={object.id}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onConnectPortPointerDown?.(e, 'top');
            }}
          />
          <rect
            x={cx - 4}
            y={cy + r - 4}
            width={8}
            height={8}
            className="fill-slate-800 stroke-white"
            strokeWidth={1}
            data-board-connect-port={object.id}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onConnectPortPointerDown?.(e, 'bottom');
            }}
          />
        </>
      ) : null}
      <NodeBody object={object} selected={selected && !dimmed} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className="pointer-events-none select-none fill-white text-[11px] font-medium"
        transform={object.rotation ? `rotate(${object.rotation} ${cx} ${cy})` : undefined}
      >
        {object.label.length > 12 ? `${object.label.slice(0, 10)}…` : object.label}
      </text>
      {selected && !dimmed && anchorPeerCount > 0 ? (
        <g className="pointer-events-none" transform={`translate(${object.x + object.width - 4}, ${object.y - 4})`}>
          <circle r={9} className="fill-primary" />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-white text-[8px] font-bold"
          >
            {anchorPeerCount}
          </text>
        </g>
      ) : null}
    </g>
  );
}

export const NodeObjectView = memo(NodeObjectViewInner);
