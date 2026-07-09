'use client';

import { useState, type ReactNode } from 'react';
import { PiPlayFill } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { getFileIcon, getFileIconByExtension } from '@/utils/file-icons';

export type FileTypeIconSize = 'sm' | 'md' | 'lg';

const FRAME: Record<FileTypeIconSize, string> = {
  sm: 'h-8 w-8 rounded-md',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
};

const ICON: Record<FileTypeIconSize, string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-9 w-9',
};

export interface FileTypeIconProps {
  mimeType?: string | null;
  filename?: string | null;
  size?: FileTypeIconSize;
  /** Custom thumbnail (e.g. AuthenticatedImage for JWT-backed URLs) */
  thumbnail?: ReactNode;
  /** Plain img src when auth is not required */
  thumbnailSrc?: string | null;
  thumbnailAlt?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Global file-type icon with consistent frame — matches file-manager card style.
 */
export default function FileTypeIcon({
  mimeType,
  filename,
  size = 'md',
  thumbnail,
  thumbnailSrc,
  thumbnailAlt,
  className,
  onClick,
}: FileTypeIconProps) {
  const icon =
    mimeType != null && mimeType !== ''
      ? getFileIcon(mimeType, ICON[size])
      : getFileIconByExtension(filename, ICON[size]);

  const frameClass = cn(
    'relative flex shrink-0 items-center justify-center overflow-hidden border border-muted bg-gray-100 dark:bg-gray-200/30',
    FRAME[size],
    onClick && 'cursor-pointer',
    className
  );

  if (thumbnail) {
    return (
      <div className={frameClass} onClick={onClick} role={onClick ? 'button' : undefined}>
        {thumbnail}
      </div>
    );
  }

  if (thumbnailSrc) {
    return (
      <div className={frameClass} onClick={onClick} role={onClick ? 'button' : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailSrc}
          alt={thumbnailAlt || filename || 'preview'}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={frameClass} onClick={onClick} role={onClick ? 'button' : undefined}>
      <span dir="ltr" className="inline-flex items-center justify-center [transform:scaleX(1)]">
        {icon}
      </span>
    </div>
  );
}

export interface VideoFileTypeIconProps {
  mimeType?: string | null;
  filename?: string | null;
  size?: FileTypeIconSize;
  className?: string;
  onClick?: () => void;
  /** Full artifact URL for thumbnail fallback fetch */
  src: string;
  localPreviewUrl?: string;
  /** Thumbnail API URL — when missing or failed, shows file icon only */
  thumbnailSrc?: string | null;
  thumbnailAlt?: string;
  /** Authenticated thumbnail layer (must support hidePlaceholder + onStatusChange) */
  ThumbnailImage: React.ComponentType<{
    src: string;
    localPreviewUrl?: string;
    thumbnailSrc?: string;
    alt: string;
    className?: string;
    hidePlaceholder?: boolean;
    onStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
  }>;
}

/**
 * Video attachment icon: file icon by default; thumbnail + play overlay only when thumb loads.
 */
export function VideoFileTypeIcon({
  mimeType,
  filename,
  size = 'md',
  className,
  onClick,
  src,
  localPreviewUrl,
  thumbnailSrc,
  thumbnailAlt,
  ThumbnailImage,
}: VideoFileTypeIconProps) {
  const [thumbStatus, setThumbStatus] = useState<'loading' | 'loaded' | 'error'>(
    localPreviewUrl ? 'loaded' : thumbnailSrc ? 'loading' : 'error'
  );

  const icon =
    mimeType != null && mimeType !== ''
      ? getFileIcon(mimeType, ICON[size])
      : getFileIconByExtension(filename, ICON[size]);

  const tryThumbnail = Boolean(thumbnailSrc || localPreviewUrl);
  const showThumbnail = tryThumbnail && thumbStatus === 'loaded';

  const frameClass = cn(
    'relative flex shrink-0 items-center justify-center overflow-hidden border border-muted bg-gray-100 dark:bg-gray-200/30',
    FRAME[size],
    onClick && 'cursor-pointer',
    className
  );

  return (
    <div className={frameClass} onClick={onClick} role={onClick ? 'button' : undefined}>
      <span
        className={cn(
          'inline-flex items-center justify-center transition-opacity [transform:scaleX(1)]',
          showThumbnail && 'pointer-events-none opacity-0'
        )}
        dir="ltr"
        aria-hidden={showThumbnail}
      >
        {icon}
      </span>

      {tryThumbnail && (
        <ThumbnailImage
          src={src}
          localPreviewUrl={localPreviewUrl}
          thumbnailSrc={thumbnailSrc ?? undefined}
          alt={thumbnailAlt || filename || 'video'}
          className="absolute inset-0 h-full w-full object-cover"
          hidePlaceholder
          onStatusChange={setThumbStatus}
        />
      )}

      {showThumbnail && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          <PiPlayFill className="h-3.5 w-3.5 text-white drop-shadow" />
        </div>
      )}
    </div>
  );
}
