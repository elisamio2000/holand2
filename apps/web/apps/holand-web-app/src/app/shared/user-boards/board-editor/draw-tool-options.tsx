'use client';

import { Tooltip } from '@/components/tooltip';
import { useTranslation } from 'react-i18next';
import { ActionIcon } from 'rizzui';
import cn from '@core/utils/class-names';
import type { BoardDrawSettings, BoardInkTool } from '../lib/board-types';
import { BoardColorPickerCompact } from '../components/board-color-picker';
import { PiEraser, PiHighlighterCircle, PiPencilLine } from 'react-icons/pi';

const WIDTHS = [2, 4, 8, 14];

export interface DrawToolOptionsProps {
  settings: BoardDrawSettings;
  onChange: (patch: Partial<BoardDrawSettings>) => void;
  className?: string;
}

export function DrawToolOptions({ settings, onChange, className }: DrawToolOptionsProps) {
  const { t } = useTranslation();

  const toolBtn = (tool: BoardInkTool, icon: React.ReactNode, label: string) => (
    <Tooltip content={label} placement="bottom">
      <ActionIcon
        variant={settings.tool === tool ? 'solid' : 'outline'}
        size="sm"
        onClick={() => onChange({ tool })}
        aria-label={label}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );

  return (
    <div className={cn('flex flex-wrap items-center gap-2 border-b border-muted bg-gray-50/80 px-3 py-1.5 dark:bg-gray-200/10', className)}>
      <span className="text-[10px] font-medium text-gray-500">{t('boards.draw.options', 'Draw')}</span>
      {toolBtn('pen', <PiPencilLine className="size-3.5" />, t('boards.draw.pen', 'Pen'))}
      {toolBtn('highlighter', <PiHighlighterCircle className="size-3.5" />, t('boards.draw.highlighter', 'Highlighter'))}
      {toolBtn('eraser', <PiEraser className="size-3.5" />, t('boards.draw.eraser', 'Eraser'))}
      <div className="mx-1 h-4 w-px bg-muted" />
      <BoardColorPickerCompact
        value={settings.color}
        onChange={(color) => onChange({ color })}
        disabled={settings.tool === 'eraser'}
      />
      <div className="mx-1 h-4 w-px bg-muted" />
      {WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          className={cn(
            'flex size-6 items-center justify-center rounded border text-[9px]',
            settings.width === w ? 'border-primary bg-primary/10' : 'border-muted'
          )}
          onClick={() => onChange({ width: w })}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
