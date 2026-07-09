'use client';

import { useCallback, useState } from 'react';
import AuthenticatedStorageImage from '@/components/authenticated-storage-image';
import ShareStorageImage from '@/components/share-storage-image';
import { THUMBNAIL_PRESETS } from '@/config/file-upload.config';
import { storageService } from '@/services/storage.service';
import { getFileIcon, THUMBNAIL_FALLBACK_ICON_CLASS } from '@/utils/file-icons';
import cn from '@core/utils/class-names';
import {
  supportsArtifactVisualPreview,
  supportsStoragePreviewEndpoint,
  supportsStorageThumbnailEndpoint,
} from '@/utils/storage-media-url';

interface StorageArtifactThumbnailProps {
  artifactId: string;
  mimeType?: string | null;
  mediaType?: string | null;
  alt?: string;
  className?: string;
  /** fileExplorerGrid (default) | panelIcon for SERP/slider */
  preset?: keyof typeof THUMBNAIL_PRESETS;
  /** compact — small attachment chips (no min-height, smaller icons) */
  density?: 'default' | 'compact';
  lazy?: boolean;
  scrollRoot?: HTMLElement | null;
  objectFit?: 'cover' | 'contain';
}

function ThumbnailIconFallback({
  mimeType,
  className,
  density = 'default',
}: {
  mimeType?: string | null;
  className?: string;
  density?: 'default' | 'compact';
}) {
  const mime = mimeType ?? '';
  const isVideo = mime.startsWith('video/');
  const iconClass =
    density === 'compact'
      ? 'h-5 w-5 shrink-0'
      : isVideo
        ? THUMBNAIL_FALLBACK_ICON_CLASS.video
        : THUMBNAIL_FALLBACK_ICON_CLASS.default;

  return (
    <div
      className={cn(
        '@container flex h-full w-full flex-col items-center justify-center',
        density === 'default' && 'min-h-[5rem]',
        'bg-gradient-to-b from-gray-100 via-gray-50 to-gray-200/70',
        'dark:from-gray-200/10 dark:via-gray-200/5 dark:to-gray-200/20',
        className
      )}
    >
      {getFileIcon(mime || undefined, iconClass)}
    </div>
  );
}

/**
 * JWT-safe thumbnail for storage artifacts.
 * Share token first (public cache), then authenticated blob fetch.
 */
export default function StorageArtifactThumbnail({
  artifactId,
  mimeType,
  mediaType,
  alt = '',
  className,
  preset = 'fileExplorerGrid',
  density = 'default',
  lazy = true,
  scrollRoot = null,
  objectFit = 'cover',
}: StorageArtifactThumbnailProps) {
  const [shareTokenFailed, setShareTokenFailed] = useState(false);
  const [blobFailed, setBlobFailed] = useState(false);
  const thumbPreset = THUMBNAIL_PRESETS[preset];

  const handleShareError = useCallback(() => {
    setShareTokenFailed(true);
  }, []);

  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  if (!supportsArtifactVisualPreview(mimeType, mediaType)) {
    return <ThumbnailIconFallback mimeType={mimeType} className={className} density={density} />;
  }

  if (
    supportsStorageThumbnailEndpoint(mimeType, mediaType) &&
    !shareTokenFailed
  ) {
    return (
      <ShareStorageImage
        artifactId={artifactId}
        mimeType={mimeType ?? undefined}
        mediaType={mediaType ?? undefined}
        alt={alt}
        className={className ? `${className} ${fitClass}` : fitClass}
        lazy={lazy}
        scrollRoot={scrollRoot}
        onError={handleShareError}
      />
    );
  }

  if (blobFailed) {
    return <ThumbnailIconFallback mimeType={mimeType} className={className} density={density} />;
  }

  const inlinePreviewUrl = storageService.getDownloadUrl(artifactId, 'inline');
  const thumbnailUrl = supportsStoragePreviewEndpoint(mimeType, mediaType)
    ? storageService.getPreviewUrl(artifactId, 1)
    : storageService.getThumbnailUrl(
        artifactId,
        thumbPreset.width,
        thumbPreset.height,
        'webp',
        thumbPreset.quality,
        mimeType ?? undefined,
        mediaType ?? undefined
      );

  return (
    <AuthenticatedStorageImage
      src={inlinePreviewUrl}
      thumbnailSrc={thumbnailUrl}
      alt={alt}
      className={className ? `${className} ${fitClass}` : fitClass}
      lazy={lazy}
      lazyRootMargin="80px"
      scrollRoot={scrollRoot}
      onStatusChange={(s) => {
        if (s === 'error') setBlobFailed(true);
      }}
    />
  );
}
