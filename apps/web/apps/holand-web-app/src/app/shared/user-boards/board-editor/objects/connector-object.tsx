'use client';

import { memo, useRef, useState } from 'react';
import type { BoardConnectorObject, BoardStyleDefaults } from '../../lib/board-types';
import {
  computeConnectorRoute,
  isConnectorSpatial,
  type ConnectorSpatial,
} from '../../lib/canvas/connector-routing';
import { resolveConnectorStyle, strokeDasharray } from '../../lib/board-style';

interface ConnectorObjectProps {
  connector: BoardConnectorObject;
  spatialById: Map<string, ConnectorSpatial>;
  styleDefaults?: BoardStyleDefaults;
  dragPreview?: Map<string, { x: number; y: number }> | null;
  selected: boolean;
  readOnly?: boolean;
  dimmed?: boolean;
  onSelect: (e: React.PointerEvent) => void;
  onBendChange?: (connectorId: string, bend: { x: number; y: number }) => void;
}

function ConnectorObjectViewInner({
  connector,
  spatialById,
  styleDefaults,
  dragPreview,
  selected,
  readOnly,
  dimmed,
  onSelect,
  onBendChange,
}: ConnectorObjectProps) {
  const bendDragRef = useRef<{ origin: { x: number; y: number }; startX: number; startY: number } | null>(null);
  const pendingBendRef = useRef<{ x: number; y: number } | null>(null);
  const [liveBend, setLiveBend] = useState<{ x: number; y: number } | null>(null);

  const source = spatialById.get(connector.sourceId);
  const target = spatialById.get(connector.targetId);
  if (!source || !target || !isConnectorSpatial(source) || !isConnectorSpatial(target)) return null;

  const effectiveConnector = liveBend ? { ...connector, bendPoints: [liveBend] } : connector;
  const route = computeConnectorRoute(effectiveConnector, source, target, dragPreview);
  if (!route) return null;

  const visual = resolveConnectorStyle(connector, styleDefaults);
  const hitWidth = Math.max(12, visual.strokeWidth + 8);
  const showBendHandle =
    selected && !readOnly && route.bendHandle && connector.routeStyle !== 'straight';

  const onBendPointerDown = (e: React.PointerEvent) => {
    if (!route.bendHandle || readOnly) return;
    e.stopPropagation();
    bendDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origin: route.bendHandle,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onBendPointerMove = (e: React.PointerEvent) => {
    if (!bendDragRef.current) return;
    const svg = (e.target as Element).closest('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scaleX = vb.width / rect.width;
    const scaleY = vb.height / rect.height;
    const dx = (e.clientX - bendDragRef.current.startX) * scaleX;
    const dy = (e.clientY - bendDragRef.current.startY) * scaleY;
    const next = {
      x: bendDragRef.current.origin.x + dx,
      y: bendDragRef.current.origin.y + dy,
    };
    pendingBendRef.current = next;
    setLiveBend(next);
  };

  const onBendPointerUp = () => {
    if (pendingBendRef.current) onBendChange?.(connector.id, pendingBendRef.current);
    bendDragRef.current = null;
    pendingBendRef.current = null;
    setLiveBend(null);
  };

  return (
    <g
      data-board-object={connector.id}
      data-board-type="connector"
      onPointerDown={onSelect}
      className="cursor-pointer"
      opacity={dimmed ? 0.15 : visual.opacity}
    >
      <path
        d={route.pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={hitWidth}
        pointerEvents={dimmed ? 'none' : 'stroke'}
      />
      <path
        d={route.pathD}
        fill="none"
        stroke={visual.color}
        strokeWidth={selected ? visual.strokeWidth + 1 : visual.strokeWidth}
        strokeDasharray={dimmed ? '4 4' : strokeDasharray(visual.strokeStyle)}
        markerStart={visual.arrowStart ? 'url(#board-arrow-start)' : undefined}
        markerEnd={visual.arrowEnd ? 'url(#board-arrow-end)' : undefined}
        pointerEvents="none"
      />
      {connector.label ? (
        <text x={route.labelX} y={route.labelY - 6} textAnchor="middle" className="fill-gray-600 text-[10px]">
          {connector.label}
        </text>
      ) : null}
      {showBendHandle ? (
        <circle
          cx={route.bendHandle!.x}
          cy={route.bendHandle!.y}
          r={5}
          className="fill-primary stroke-white"
          strokeWidth={1.5}
          style={{ cursor: 'grab' }}
          onPointerDown={onBendPointerDown}
          onPointerMove={onBendPointerMove}
          onPointerUp={onBendPointerUp}
          onPointerCancel={onBendPointerUp}
        />
      ) : null}
    </g>
  );
}

export const ConnectorObjectView = memo(ConnectorObjectViewInner);
