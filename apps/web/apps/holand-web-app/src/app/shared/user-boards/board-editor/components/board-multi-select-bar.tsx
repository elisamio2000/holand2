'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';
import { ActionIcon } from 'rizzui';
import {
  PiAlignBottom,
  PiAlignLeft,
  PiAlignRight,
  PiAlignTop,
  PiArrowsHorizontal,
  PiArrowsVertical,
} from 'react-icons/pi';
import type { BoardObject, BoardObjectBase } from '../../lib/board-types';

export type MultiSelectAlign = 'left' | 'right' | 'top' | 'bottom' | 'distribute-h' | 'distribute-v';

interface BoardMultiSelectBarProps {
  totalCount: number;
  spatialCount: number;
  onAlign: (action: MultiSelectAlign) => void;
  className?: string;
}

export function BoardMultiSelectBar({
  totalCount,
  spatialCount,
  onAlign,
  className,
}: BoardMultiSelectBarProps) {
  const { t } = useTranslation();
  if (totalCount < 2) return null;

  const canAlign = spatialCount >= 2;

  return (
    <div
      className={`pointer-events-auto absolute start-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-muted bg-background/95 px-2 py-1 shadow-md backdrop-blur-sm ${className ?? ''}`}
    >
      <span className="px-1.5 text-xs text-gray-500">
        {t('boards.multiSelect.count', '{{count}} selected', { count: totalCount })}
      </span>
      {canAlign ? (
        <>
          <span className="mx-0.5 h-4 w-px bg-muted" />
          <Tooltip content={t('boards.multiSelect.alignLeft', 'Align left')} placement="bottom">
            <ActionIcon size="sm" variant="text" aria-label={t('boards.multiSelect.alignLeft', 'Align left')} onClick={() => onAlign('left')}>
              <PiAlignLeft className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('boards.multiSelect.alignRight', 'Align right')} placement="bottom">
            <ActionIcon size="sm" variant="text" aria-label={t('boards.multiSelect.alignRight', 'Align right')} onClick={() => onAlign('right')}>
              <PiAlignRight className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('boards.multiSelect.alignTop', 'Align top')} placement="bottom">
            <ActionIcon size="sm" variant="text" aria-label={t('boards.multiSelect.alignTop', 'Align top')} onClick={() => onAlign('top')}>
              <PiAlignTop className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('boards.multiSelect.alignBottom', 'Align bottom')} placement="bottom">
            <ActionIcon size="sm" variant="text" aria-label={t('boards.multiSelect.alignBottom', 'Align bottom')} onClick={() => onAlign('bottom')}>
              <PiAlignBottom className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('boards.multiSelect.distributeH', 'Distribute horizontally')} placement="bottom">
            <ActionIcon size="sm" variant="text" aria-label={t('boards.multiSelect.distributeH', 'Distribute H')} onClick={() => onAlign('distribute-h')}>
              <PiArrowsHorizontal className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('boards.multiSelect.distributeV', 'Distribute vertically')} placement="bottom">
            <ActionIcon size="sm" variant="text" aria-label={t('boards.multiSelect.distributeV', 'Distribute V')} onClick={() => onAlign('distribute-v')}>
              <PiArrowsVertical className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        </>
      ) : (
        <span className="px-1 text-[10px] text-gray-400">
          {t('boards.multiSelect.alignHint', 'Align applies to shapes & nodes, not connectors')}
        </span>
      )}
    </div>
  );
}

export function alignSpatialObjects(
  objects: BoardObject[],
  ids: string[],
  action: MultiSelectAlign
): Map<string, Partial<BoardObject & BoardObjectBase>> {
  const spatial = objects.filter(
    (o): o is BoardObject & BoardObjectBase =>
      ids.includes(o.id) && o.type !== 'connector' && 'x' in o && 'width' in o
  );
  if (spatial.length < 2) return new Map();

  const patches = new Map<string, Partial<BoardObject & BoardObjectBase>>();
  const xs = spatial.map((o) => o.x);
  const ys = spatial.map((o) => o.y);
  const rights = spatial.map((o) => o.x + o.width);
  const bottoms = spatial.map((o) => o.y + o.height);

  const minX = Math.min(...xs);
  const maxRight = Math.max(...rights);
  const minY = Math.min(...ys);
  const maxBottom = Math.max(...bottoms);

  if (action === 'left') {
    for (const o of spatial) patches.set(o.id, { x: minX });
  } else if (action === 'right') {
    for (const o of spatial) patches.set(o.id, { x: maxRight - o.width });
  } else if (action === 'top') {
    for (const o of spatial) patches.set(o.id, { y: minY });
  } else if (action === 'bottom') {
    for (const o of spatial) patches.set(o.id, { y: maxBottom - o.height });
  } else if (action === 'distribute-h') {
    const sorted = [...spatial].sort((a, b) => a.x - b.x);
    const totalWidth = sorted.reduce((s, o) => s + o.width, 0);
    const span = maxRight - minX - totalWidth;
    const gap = span / (sorted.length - 1);
    let cursor = minX;
    for (const o of sorted) {
      patches.set(o.id, { x: cursor });
      cursor += o.width + gap;
    }
  } else if (action === 'distribute-v') {
    const sorted = [...spatial].sort((a, b) => a.y - b.y);
    const totalHeight = sorted.reduce((s, o) => s + o.height, 0);
    const span = maxBottom - minY - totalHeight;
    const gap = span / (sorted.length - 1);
    let cursor = minY;
    for (const o of sorted) {
      patches.set(o.id, { y: cursor });
      cursor += o.height + gap;
    }
  }

  return patches;
}

export function countSelectedSpatial(ids: string[], objects: BoardObject[]): number {
  return objects.filter(
    (o) => ids.includes(o.id) && o.type !== 'connector' && 'x' in o && 'width' in o
  ).length;
}
