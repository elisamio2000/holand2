'use client';

import cn from '@core/utils/class-names';
import { PiPlayFill } from 'react-icons/pi';
import {
  MpsUltraCompactAudio,
  MpsUltraCompactVideo,
  MpsInlineAudioPlayer,
} from '@/components/media-playback';
import { storageService } from '@/services/storage.service';
import type { BoardAttachmentRef } from '../../lib/board-types';
import { attachmentMime } from '../../lib/board-attachment-utils';
import { BoardAttachmentPreview } from './board-attachment-preview';

export interface BoardAttachmentInlinePlayerProps {
  attachment: BoardAttachmentRef;
  rowId: string;
  className?: string;
  /** ultraCompact list row vs tighter canvas embed */
  layout?: 'row' | 'canvas';
  livePreview?: boolean;
  onCanvasExpand?: () => void;
}

/**
 * Inline play/pause via global AudioPlayer / VideoPlayer (MPS ultraCompact).
 * Expand opens the same full modal used elsewhere in the app.
 */
export function BoardAttachmentInlinePlayer({
  attachment,
  rowId,
  className,
  layout = 'row',
  livePreview = true,
  onCanvasExpand,
}: BoardAttachmentInlinePlayerProps) {
  const mime = attachmentMime(attachment) ?? undefined;
  const src = storageService.getDownloadUrl(attachment.artifactId, 'inline');
  const category = attachment.category ?? 'other';

  if (category === 'audio') {
    if (layout === 'canvas') {
      return (
        <MpsInlineAudioPlayer
          src={src}
          artifactId={attachment.artifactId}
          mimeType={mime}
          fileSize={attachment.size}
          title={attachment.name}
          variant="chatInline"
          className={cn('min-h-0 w-full', className)}
          sessionKey={rowId}
          stickyEnabled={false}
        />
      );
    }

    return (
      <MpsUltraCompactAudio
        src={src}
        artifactId={attachment.artifactId}
        mimeType={mime}
        fileSize={attachment.size}
        title={attachment.name}
        rowId={rowId}
        className={className}
        stickyEnabled
      />
    );
  }

  if (category === 'video') {
    if (layout === 'canvas') {
      return (
        <button
          type="button"
          className={cn('group relative h-full w-full min-h-[48px] overflow-hidden rounded-sm', className)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onCanvasExpand?.();
          }}
        >
          <BoardAttachmentPreview
            attachment={attachment}
            compact
            livePreview={livePreview}
            className="h-full w-full"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-90 transition-opacity group-hover:bg-black/35">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow">
              <PiPlayFill className="ms-0.5 h-3.5 w-3.5" />
            </span>
          </span>
        </button>
      );
    }

    const thumb = (
      <BoardAttachmentPreview
        attachment={attachment}
        compact
        livePreview={livePreview}
        className="h-full w-full rounded-md"
      />
    );

    return (
      <MpsUltraCompactVideo
        src={src}
        artifactId={attachment.artifactId}
        mimeType={mime}
        fileSize={attachment.size}
        title={attachment.name}
        rowId={rowId}
        className={className}
        thumbnailSlot={thumb}
      />
    );
  }

  return null;
}

export function isPlayableAttachmentCategory(
  category: BoardAttachmentRef['category']
): boolean {
  return category === 'audio' || category === 'video';
}
