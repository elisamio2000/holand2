// ============================================
// AuthenticatedStorageImage — JWT-backed storage preview
// Optional lazy mode: fetch only when visible (file explorer grid).
// ============================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PiImageBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { storageService } from '@/services/storage.service';

interface AuthenticatedStorageImageProps {
  src: string;
  thumbnailSrc?: string | null;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  hidePlaceholder?: boolean;
  onStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
  /** Wait until near viewport / scroll container before fetch */
  lazy?: boolean;
  lazyRootMargin?: string;
  /** Parent with overflow-auto (file table). Without this, lazy breaks inside scroll panels */
  scrollRoot?: HTMLElement | null;
}

export default function AuthenticatedStorageImage({
  src,
  thumbnailSrc,
  alt = 'image',
  className,
  loading = 'lazy',
  hidePlaceholder = false,
  onStatusChange,
  lazy = false,
  lazyRootMargin = '80px',
  scrollRoot = null,
}: AuthenticatedStorageImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    lazy ? 'idle' : 'loading'
  );
  const [canFetch, setCanFetch] = useState(!lazy);

  const loadedUrlRef = useRef<string | null>(null);
  const fetchGenRef = useRef(0);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  const attachObserver = useCallback(
    (node: HTMLDivElement) => {
      observerRef.current?.disconnect();
      if (!lazy || canFetch) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setCanFetch(true);
            observerRef.current?.disconnect();
          }
        },
        {
          root: scrollRoot,
          rootMargin: lazyRootMargin,
          threshold: 0.01,
        }
      );
      observerRef.current.observe(node);
    },
    [lazy, lazyRootMargin, scrollRoot, canFetch]
  );

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      elementRef.current = node;
      if (node) attachObserver(node);
      else observerRef.current?.disconnect();
    },
    [attachObserver]
  );

  useEffect(() => {
    if (elementRef.current && lazy && !canFetch) {
      attachObserver(elementRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [lazy, scrollRoot, attachObserver, canFetch]);

  const effectiveSrc = thumbnailSrc || src;

  useEffect(() => {
    if (!canFetch) return;
    if (loadedUrlRef.current === effectiveSrc && blobUrl) return;

    const gen = ++fetchGenRef.current;
    let cancelled = false;

    const fetchImage = async () => {
      setStatus('loading');
      onStatusChangeRef.current?.('loading');

      const primary = await storageService.fetchAuthenticatedBlobUrl(effectiveSrc);
      if (cancelled || gen !== fetchGenRef.current) return;

      if (primary) {
        setBlobUrl(primary);
        setStatus('loaded');
        loadedUrlRef.current = effectiveSrc;
        onStatusChangeRef.current?.('loaded');
        return;
      }

      if (thumbnailSrc && src !== thumbnailSrc) {
        const fallback = await storageService.fetchAuthenticatedBlobUrl(src);
        if (cancelled || gen !== fetchGenRef.current) return;

        if (fallback) {
          setBlobUrl(fallback);
          setStatus('loaded');
          loadedUrlRef.current = src;
          onStatusChangeRef.current?.('loaded');
          return;
        }
      }

      setStatus('error');
      onStatusChangeRef.current?.('error');
    };

    fetchImage();

    return () => {
      cancelled = true;
    };
  }, [blobUrl, canFetch, effectiveSrc, src, thumbnailSrc]);

  if (status === 'idle' || status === 'loading') {
    if (hidePlaceholder) {
      return <div ref={lazy ? setContainerRef : undefined} className={className} />;
    }
    return (
      <div
        ref={lazy ? setContainerRef : undefined}
        className={cn(
          'flex items-center justify-center bg-gray-100 dark:bg-gray-200/30',
          status === 'loading' && 'animate-pulse',
          className
        )}
      >
        <PiImageBold className="h-4 w-4 text-gray-300 dark:text-gray-500" />
      </div>
    );
  }

  if (status === 'error' || !blobUrl) {
    if (hidePlaceholder) return null;
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-100 dark:bg-gray-200/30',
          className
        )}
      >
        <PiImageBold className="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        setStatus('error');
        onStatusChangeRef.current?.('error');
      }}
    />
  );
}
