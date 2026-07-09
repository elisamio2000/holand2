'use client';

import { memo } from 'react';
import cn from '@core/utils/class-names';
import type { BoardStickyObject, BoardStickyInkStroke, StickyInkRegion } from '../../lib/board-types';
import { StickyNoteEditor } from '../sticky-note-editor';

interface StickyObjectProps {
  object: BoardStickyObject;
  selected: boolean;
  onSelect: (e: React.PointerEvent) => void;
  onDragStart: (e: React.PointerEvent) => void;
  onTextChange: (text: string) => void;
  onTextFocus?: () => void;
  onTextBlur?: () => void;
  onStrokesChange: (strokes: BoardStickyInkStroke[]) => void;
  onInkRegionChange?: (region: StickyInkRegion) => void;
  showConnectPorts?: boolean;
  onConnectPortPointerDown?: (e: React.PointerEvent, port: 'top' | 'bottom') => void;
  onConnectBodyPointerDown?: (e: React.PointerEvent) => void;
}

function StickyObjectViewInner({
  object,
  selected,
  onSelect,
  onDragStart,
  onTextChange,
  onTextFocus,
  onTextBlur,
  onStrokesChange,
  onInkRegionChange,
  showConnectPorts,
  onConnectPortPointerDown,
  onConnectBodyPointerDown,
}: StickyObjectProps) {
  const cx = object.x + object.width / 2;

  return (
    <g>
      {showConnectPorts ? (
        <>
          <rect
            x={cx - 4}
            y={object.y - 4}
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
            y={object.y + object.height - 4}
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
      {object.attachedNodeId ? (
        <circle
          cx={object.x + object.width - 6}
          cy={object.y + 6}
          r={5}
          className="fill-primary stroke-white pointer-events-none"
          strokeWidth={1}
        />
      ) : null}
      <foreignObject
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        className="overflow-visible"
        data-board-object={object.id}
        data-board-type="sticky"
        opacity={object.opacity ?? 1}
        onPointerDown={(e) => {
          if (showConnectPorts) {
            e.stopPropagation();
            onConnectBodyPointerDown?.(e);
          }
        }}
      >
        <div
          className={cn(
            'overflow-hidden rounded-md border shadow-sm',
            selected ? 'ring-2 ring-primary' : 'border-muted',
            object.locked ? 'cursor-not-allowed opacity-90' : ''
          )}
          style={{ width: object.width, height: object.height, backgroundColor: object.color }}
        >
          <StickyNoteEditor
            text={object.text}
            strokes={object.inkStrokes ?? []}
            inkRegion={object.inkRegion}
            width={object.width}
            height={object.height}
            selected={selected}
            locked={object.locked}
            onTextChange={onTextChange}
            onTextFocus={onTextFocus}
            onTextBlur={onTextBlur}
            onStrokesChange={onStrokesChange}
            onInkRegionChange={onInkRegionChange}
            onDragHandlePointerDown={onDragStart}
            onSelectPointerDown={onSelect}
          />
        </div>
      </foreignObject>
    </g>
  );
}

export const StickyObjectView = memo(StickyObjectViewInner);
