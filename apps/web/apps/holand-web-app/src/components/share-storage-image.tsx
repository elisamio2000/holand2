'use client';

import { useEffect, useRef, useState } from 'react';
import { storageService } from '@/services/storage.service';
import { isImageArtifact } from '@/utils/storage-media-url';

interface ShareStorageImageProps {
  artifactId: string;
  mimeType?: string;
  mediaType?: string;
  alt: string;
  className?: string;
  lazy?: boolean;
  scrollRoot?: HTMLElement | null;
  onError?: () => void;
}

/**
 * Grid/list image preview via share-token URL (browser HTTP cache, no JWT blob fetch).
 * When lazy=true, defers share-token creation until the tile is near the viewport.
 */
export default function ShareStorageImage({
  artifactId,
  mimeType,
  mediaType,
  alt,
  className,
  lazy = true,
  scrollRoot = null,
  onError,
}: ShareStorageImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(!lazy);
  const onErrorRef = useRef(onError);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!lazy) {
      setVisible(true);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot, rootMargin: '160px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, scrollRoot]);

  useEffect(() => {
    if (!visible) return;
    if (!isImageArtifact(mimeType, mediaType)) {
      setFailed(true);
      onErrorRef.current?.();
      return;
    }
    let cancelled = false;
    storageService
      .getShareImageUrl(artifactId)
      .then((url) => {
        if (cancelled) return;
        if (url) setSrc(url);
        else {
          setFailed(true);
          onErrorRef.current?.();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onErrorRef.current?.();
      });
    return () => {
      cancelled = true;
    };
  }, [visible, artifactId, mimeType, mediaType]);

  if (!visible || failed || !src) {
    return (
      <span
        ref={containerRef}
        className={className}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        setFailed(true);
        onErrorRef.current?.();
      }}
    />
  );
}
