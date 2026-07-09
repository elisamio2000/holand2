'use client';

import type { BoardSnapshot } from '../lib/board-types';
import { BoardCanvas } from './board-canvas';

export interface BoardReadOnlyViewProps {
  snapshot: BoardSnapshot;
  className?: string;
}

const noop = () => {};

/** Lightweight read-only canvas for embeds and shared links. */
export function BoardReadOnlyView({ snapshot, className }: BoardReadOnlyViewProps) {
  return (
    <div className={className ?? 'h-[min(70vh,560px)] w-full'}>
      <BoardCanvas
        snapshot={snapshot}
        mode="pan"
        selectedIds={[]}
        selectedInkIds={[]}
        edgeSourceId={null}
        drawSettings={{ color: '#1e293b', width: 2, tool: 'pen' }}
        snapToGrid={false}
        gridPreferences={{ style: 'dots', opacity: 0.35, majorEvery: 5 }}
        readOnly
        onViewBoxChange={noop}
        onSelect={noop}
        onSelectInk={noop}
        onObjectsDragEnd={noop}
        onObjectResizeEnd={noop}
        onDragStart={noop}
        onDragEnd={noop}
        onStickyTextChange={noop}
        onStickyStrokesChange={noop}
        onCanvasClick={noop}
        onInkStrokeComplete={noop}
        onInkStrokesReplace={noop}
      />
    </div>
  );
}
