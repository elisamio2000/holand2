'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Dropdown } from 'rizzui';
import type { BoardNodeShape } from '../lib/board-types';
import { PiRectangle, PiCircle, PiDiamond, PiSquaresFour } from 'react-icons/pi';

const SHAPES: { shape: BoardNodeShape; icon: React.ReactNode; labelKey: string }[] = [
  { shape: 'rectangle', icon: <PiRectangle className="size-4" />, labelKey: 'boards.shape.rectangle' },
  { shape: 'rounded', icon: <PiSquaresFour className="size-4" />, labelKey: 'boards.shape.rounded' },
  { shape: 'ellipse', icon: <PiCircle className="size-4" />, labelKey: 'boards.shape.ellipse' },
  { shape: 'diamond', icon: <PiDiamond className="size-4" />, labelKey: 'boards.shape.diamond' },
];

export interface BoardNodeShapePickerProps {
  activeShape: BoardNodeShape;
  onShapeChange: (shape: BoardNodeShape) => void;
  compact?: boolean;
}

export function BoardNodeShapePicker({ activeShape, onShapeChange, compact }: BoardNodeShapePickerProps) {
  const { t } = useTranslation();
  const active = SHAPES.find((s) => s.shape === activeShape) ?? SHAPES[2];

  if (compact) {
    return (
      <Dropdown>
        <Dropdown.Trigger>
          <Tooltip content={t('boards.shape.title', 'Node shape')} placement="bottom">
            <ActionIcon variant="outline" size="sm" aria-label={t('boards.shape.title', 'Node shape')}>
              {active.icon}
            </ActionIcon>
          </Tooltip>
        </Dropdown.Trigger>
        <Dropdown.Menu className="min-w-[140px]">
          {SHAPES.map(({ shape, icon, labelKey }) => (
            <Dropdown.Item
              key={shape}
              onClick={() => onShapeChange(shape)}
              className={activeShape === shape ? 'bg-muted/60' : ''}
            >
              <span className="flex items-center gap-2">
                {icon}
                {t(labelKey, shape)}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      <span className="mb-1 px-1 text-[10px] font-medium uppercase text-gray-500">
        {t('boards.shape.title', 'Shape')}
      </span>
      <div className="flex flex-col gap-0.5">
        {SHAPES.map(({ shape, icon, labelKey }) => (
          <button
            key={shape}
            type="button"
            onClick={() => onShapeChange(shape)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-start text-xs hover:bg-muted/60"
            style={{
              outline: activeShape === shape ? '2px solid var(--primary-default)' : undefined,
            }}
          >
            {icon}
            {t(labelKey, shape)}
          </button>
        ))}
      </div>
    </div>
  );
}

export { SHAPES as NODE_SHAPE_OPTIONS };
