'use client';

import { useState } from 'react';
import type { OneSearchHit } from '@/types/one-search.types';
import StorageArtifactThumbnail from '@/components/storage-artifact-thumbnail';
import { artifactIdFromHit } from '@/utils/storage-artifact-media';
import cn from '@core/utils/class-names';
import { getFileIcon, THUMBNAIL_FALLBACK_ICON_CLASS } from '@/utils/file-icons';

interface SearchHitThumbnailProps {
  hit: OneSearchHit;
  className?: string;
  objectFit?: 'cover' | 'contain';
  lazy?: boolean;
  scrollRoot?: HTMLElement | null;
}

function HitThumbnailPlaceholder({
  hit,
  className,
}: {
  hit: OneSearchHit;
  className?: string;
}) {
  const mime = String(hit.meta?.mime ?? '');
  const isVideo = mime.startsWith('video/');

  return (
    <div
      className={cn(
        '@container flex h-full w-full min-h-[5rem] flex-col items-center justify-center',
        'bg-gradient-to-b from-gray-100 via-gray-50 to-gray-200/70',
        'dark:from-gray-200/10 dark:via-gray-200/5 dark:to-gray-200/20',
        className
      )}
    >
      {getFileIcon(
        mime || undefined,
        isVideo ? THUMBNAIL_FALLBACK_ICON_CLASS.video : THUMBNAIL_FALLBACK_ICON_CLASS.default
      )}
    </div>
  );
}

/** Renders storage hits with JWT-safe thumbnails; mock/public URLs use plain img. */
export function SearchHitThumbnail({
  hit,
  className = 'h-full w-full',
  objectFit = 'cover',
  lazy = true,
  scrollRoot = null,
}: SearchHitThumbnailProps) {
  const artifactId = artifactIdFromHit(hit.meta);
  const fallbackUrl = String(hit.meta?.thumb_url || hit.meta?.url || '');

  if (artifactId) {
    return (
      <StorageArtifactThumbnail
        artifactId={artifactId}
        mimeType={String(hit.meta?.mime ?? '')}
        mediaType={String(hit.meta?.media_type ?? '')}
        alt={hit.title}
        className={className}
        objectFit={objectFit}
        lazy={lazy}
        scrollRoot={scrollRoot}
      />
    );
  }

  if (!fallbackUrl) {
    return <HitThumbnailPlaceholder hit={hit} className={className} />;
  }

  return (
    <SearchHitThumbnailImage
      hit={hit}
      src={fallbackUrl}
      className={className}
      objectFit={objectFit}
      lazy={lazy}
    />
  );
}

function SearchHitThumbnailImage({
  hit,
  src,
  className,
  objectFit,
  lazy,
}: {
  hit: OneSearchHit;
  src: string;
  className?: string;
  objectFit: 'cover' | 'contain';
  lazy: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <HitThumbnailPlaceholder hit={hit} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={hit.title}
      className={className}
      loading={lazy ? 'lazy' : 'eager'}
      style={{ objectFit }}
      onError={() => setFailed(true)}
    />
  );
}
