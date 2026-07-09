'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { BoardAttachmentRef } from '../lib/board-types';
import { BoardAttachmentPreview } from './components/board-attachment-preview';
import { setAttachmentDragGhost } from './components/attachment-drag-ghost';

export interface BoardAttachmentsBarProps {
  attachments: BoardAttachmentRef[];
  visible: boolean;
  onPlaceOnBoard: (attachment: BoardAttachmentRef, world: { x: number; y: number }) => void;
  className?: string;
}

export function BoardAttachmentsBar({
  attachments,
  visible,
  onPlaceOnBoard,
  className,
}: BoardAttachmentsBarProps) {
  const { t } = useTranslation();

  if (!visible || attachments.length === 0) return null;

  return (
    <div
      className={cn(
        'absolute bottom-0 start-0 end-0 z-20 flex gap-2 overflow-x-auto border-t border-muted bg-white/95 px-2 py-1.5 backdrop-blur dark:bg-gray-100/95',
        className
      )}
    >
      <span className="shrink-0 self-center text-[10px] font-medium text-gray-500">
        {t('boards.attachments.barLabel', 'Attachments')}
      </span>
      {attachments.map((a) => (
        <button
          key={a.id}
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-board-attachment', a.id);
            e.dataTransfer.effectAllowed = 'copy';
            setAttachmentDragGhost(e, a.artifactId, a.name);
          }}
          onClick={() => onPlaceOnBoard(a, { x: 0, y: 0 })}
          className="flex shrink-0 items-center gap-1.5 rounded border border-muted bg-gray-50 py-1 pe-2 ps-1 text-xs hover:bg-gray-100 dark:bg-gray-200/50"
          title={t('boards.attachments.dragHint', 'Drag onto canvas or click to place')}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-muted/80 bg-gray-50 dark:bg-gray-200/30">
            <BoardAttachmentPreview attachment={a} compact livePreview size="sm" className="h-full w-full" />
          </span>
          <span className="max-w-[100px] truncate">{a.name}</span>
        </button>
      ))}
    </div>
  );
}
