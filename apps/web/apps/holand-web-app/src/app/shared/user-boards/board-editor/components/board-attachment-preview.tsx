'use client';

import cn from '@core/utils/class-names';
import { PiFilmStripBold, PiMusicNoteFill } from 'react-icons/pi';
import StorageArtifactThumbnail from '@/components/storage-artifact-thumbnail';
import { getFileIcon, getFileIconByExtension } from '@/utils/file-icons';
import type { BoardAttachmentRef } from '../../lib/board-types';
import { attachmentMime } from '../../lib/board-attachment-utils';

export type BoardAttachmentPreviewSize = 'sm' | 'md';

const ICON_CLASS: Record<BoardAttachmentPreviewSize, string> = {
  sm: 'h-4 w-4 shrink-0',
  md: 'h-5 w-5 shrink-0',
};

export interface BoardAttachmentPreviewProps {
  attachment: Pick<BoardAttachmentRef, 'artifactId' | 'name' | 'category' | 'mime' | 'mimeType' | 'thumbnailUrl'>;
  compact?: boolean;
  /** Thumb cell size — sm: 32px bar chips, md: 40px library rows */
  size?: BoardAttachmentPreviewSize;
  /** When false, show type icon only (Graph builder icon mode). */
  livePreview?: boolean;
  className?: string;
}

/**
 * Compact attachment thumbnail — images/video posters via StorageArtifactThumbnail,
 * category icons for audio/docs (pattern from Graph AttachmentPreview).
 */
export function BoardAttachmentPreview({
  attachment,
  compact = true,
  size = 'md',
  livePreview = true,
  className,
}: BoardAttachmentPreviewProps) {
  const mime = attachmentMime(attachment as BoardAttachmentRef) ?? '';
  const category = attachment.category ?? 'other';
  const iconClass = ICON_CLASS[size];

  const showVisualThumb =
    livePreview &&
    Boolean(attachment.artifactId) &&
    (category === 'image' || category === 'video');

  if (showVisualThumb && attachment.artifactId) {
    return (
      <div className={cn('relative h-full w-full overflow-hidden', className)}>
        <StorageArtifactThumbnail
          artifactId={attachment.artifactId}
          mimeType={mime}
          alt={attachment.name}
          className="h-full w-full"
          preset="panelIcon"
          density="compact"
          objectFit={compact ? 'cover' : 'contain'}
          lazy={false}
        />
        {category === 'video' && compact ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35">
            <PiFilmStripBold className={cn(iconClass, 'text-white/90')} />
          </div>
        ) : null}
      </div>
    );
  }

  if (attachment.thumbnailUrl && category === 'image') {
    return (
      <div className={cn('relative h-full w-full overflow-hidden', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.thumbnailUrl}
          alt={attachment.name}
          className={cn('h-full w-full', compact ? 'object-cover' : 'object-contain')}
          draggable={false}
        />
      </div>
    );
  }

  if (category === 'audio') {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200/80 dark:from-gray-200/10 dark:to-gray-200/25',
          className
        )}
      >
        <PiMusicNoteFill className={cn(iconClass, 'text-primary')} />
      </div>
    );
  }

  if (category === 'video') {
    return (
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center bg-black/60',
          className
        )}
      >
        <PiFilmStripBold className={cn(iconClass, 'text-white/80')} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center overflow-hidden bg-gray-100 p-1 dark:bg-gray-200/40',
        className
      )}
    >
      {mime
        ? getFileIcon(mime, iconClass)
        : getFileIconByExtension(attachment.name, iconClass)}
    </div>
  );
}
