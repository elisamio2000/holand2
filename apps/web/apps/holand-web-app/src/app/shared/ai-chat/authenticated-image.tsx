// ============================================
// AuthenticatedImage — Image component with JWT auth
// Fetches images via authenticated requests and displays as blob URLs
// ============================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { PiImageBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { chatService } from '@/services/chat.service';
import { debugLog } from '@/utils/debug-logger';

interface AuthenticatedImageProps {
  /** URL to fetch with auth headers */
  src: string;
  /** Local preview URL (blob) — used directly without auth fetch */
  localPreviewUrl?: string;
  /** Thumbnail URL — preferred over full-size `src` for small displays */
  thumbnailSrc?: string;
  /** Alt text */
  alt?: string;
  /** CSS class name */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether image loading should be lazy */
  loading?: 'lazy' | 'eager';
  /**
   * When true, loading/error states render nothing (caller provides its own fallback).
   * Use this inside VideoFileTypeIcon so the file icon shows while thumb loads.
   */
  hidePlaceholder?: boolean;
  /**
   * Called once each time the internal status changes.
   * Must be a stable reference (e.g. setState from useState) — not an inline arrow.
   */
  onStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
}

/**
 * AuthenticatedImage — Loads images from backend endpoints that require JWT.
 *
 * Browser `<img src>` tags cannot include Authorization headers, so this
 * component fetches the image via `fetch()` with auth, converts to a blob URL,
 * and uses that as the `<img src>`.
 *
 * Prefers `localPreviewUrl` (from current session upload) over authenticated fetch.
 * Shows a loading skeleton while fetching and a fallback icon on failure.
 *
 * @requires chatService.fetchAuthenticatedBlobUrl — for authenticated image fetching
 */
export default function AuthenticatedImage({
  src,
  localPreviewUrl,
  thumbnailSrc,
  alt = 'image',
  className,
  onClick,
  loading = 'lazy',
  hidePlaceholder = false,
  onStatusChange,
}: AuthenticatedImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(localPreviewUrl ?? null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    localPreviewUrl ? 'loaded' : 'loading'
  );

  const loadedUrlRef = useRef<string | null>(localPreviewUrl ?? null);
  const triedFallbackRef = useRef(false);
  // Keep a stable ref to onStatusChange so we don't need it in deps
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  });

  // Prefer thumbnail URL over full-size for initial load (saves bandwidth)
  const effectiveSrc = thumbnailSrc || src;

  useEffect(() => {
    debugLog.thumbnail('AuthenticatedImage effect', {
      hasLocalPreview: !!localPreviewUrl,
      hasThumbnailSrc: !!thumbnailSrc,
      src,
      effectiveSrc,
      currentStatus: status,
      alreadyLoaded: loadedUrlRef.current === effectiveSrc && !!blobUrl,
    });

    if (localPreviewUrl) {
      setBlobUrl(localPreviewUrl);
      setStatus('loaded');
      loadedUrlRef.current = localPreviewUrl;
      onStatusChangeRef.current?.('loaded');
      return;
    }

    if (loadedUrlRef.current === effectiveSrc && blobUrl) {
      return;
    }

    triedFallbackRef.current = false;
    let cancelled = false;

    const fetchImage = async () => {
      setStatus('loading');
      onStatusChangeRef.current?.('loading');
      debugLog.thumbnail('Fetching authenticated image', { effectiveSrc });
      const url = await chatService.fetchAuthenticatedBlobUrl(effectiveSrc);
      if (cancelled) return;

      if (url) {
        setBlobUrl(url);
        setStatus('loaded');
        loadedUrlRef.current = effectiveSrc;
        onStatusChangeRef.current?.('loaded');
        debugLog.thumbnail('Image loaded successfully', { effectiveSrc, blobUrl: url });
      } else {
        if (thumbnailSrc && src && src !== thumbnailSrc && !triedFallbackRef.current) {
          triedFallbackRef.current = true;
          debugLog.thumbnail('Thumbnail failed, trying full-size fallback', { src });
          const fallbackUrl = await chatService.fetchAuthenticatedBlobUrl(src);
          if (cancelled) return;

          if (fallbackUrl) {
            setBlobUrl(fallbackUrl);
            setStatus('loaded');
            loadedUrlRef.current = src;
            onStatusChangeRef.current?.('loaded');
            debugLog.thumbnail('Fallback full-size image loaded', { src, blobUrl: fallbackUrl });
            return;
          }
        }
        setStatus('error');
        onStatusChangeRef.current?.('error');
        debugLog.error('Image load FAILED (all URLs tried)', { effectiveSrc, src });
      }
    };

    fetchImage();

    return () => {
      cancelled = true;
    };
  }, [effectiveSrc, localPreviewUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading skeleton
  if (status === 'loading') {
    if (hidePlaceholder) return null;
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-100 dark:bg-gray-200/30',
          'animate-pulse',
          className
        )}
      >
        <PiImageBold className="h-4 w-4 text-gray-300 dark:text-gray-500" />
      </div>
    );
  }

  // Error fallback
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

  // ⚠️ Using <img> instead of next/image because we serve dynamic blob URLs
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      onClick={onClick}
      loading={loading}
      onError={() => {
        setStatus('error');
        onStatusChangeRef.current?.('error');
      }}
    />
  );
}
