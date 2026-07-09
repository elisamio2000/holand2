'use client';

import { useCallback, useEffect, useState } from 'react';
import { storageService } from '@/services/storage.service';
import {
  resolveStoragePlaybackUrl,
  type StoragePlaybackStrategy,
} from '@/utils/resolve-storage-playback-url';

export interface StoragePlaybackUrlState {
  src: string;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

export interface UseStoragePlaybackUrlOptions {
  /** blob-first suits WaveSurfer; presigned-first suits large video streaming */
  strategy?: StoragePlaybackStrategy;
}

/**
 * Resolve a browser-playable URL for storage artifacts (audio/video).
 * Gateway download URLs require Bearer — WaveSurfer / <audio> cannot send it.
 */
export function useStoragePlaybackUrl(
  artifactId: string | undefined,
  fallbackUrl: string,
  options?: UseStoragePlaybackUrlOptions & { enabled?: boolean }
): StoragePlaybackUrlState {
  const strategy = options?.strategy ?? 'blob-first';
  const enabled = options?.enabled !== false;
  const needsResolve = Boolean(artifactId) && enabled;

  const [src, setSrc] = useState(() => (needsResolve ? '' : fallbackUrl));
  const [loading, setLoading] = useState(needsResolve);
  const [error, setError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const retry = useCallback(() => setRetryNonce((n) => n + 1), []);

  useEffect(() => {
    if (!artifactId || !enabled) {
      setSrc(fallbackUrl);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | undefined;

    setLoading(true);
    setError(false);
    setSrc('');

    void (async () => {
      try {
        const resolved = await resolveStoragePlaybackUrl(artifactId, strategy);
        if (cancelled) {
          if (resolved.revokeOnCleanup) URL.revokeObjectURL(resolved.url);
          return;
        }
        if (resolved.revokeOnCleanup) objectUrl = resolved.url;
        setSrc(resolved.url);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setSrc('');
          setLoading(false);
          setError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artifactId, fallbackUrl, retryNonce, strategy, enabled]);

  return { src, loading, error, retry };
}

/** Convenience when caller only has artifact id (no meta.url yet). */
export function useArtifactPlaybackUrl(
  artifactId: string | undefined,
  options?: UseStoragePlaybackUrlOptions
): StoragePlaybackUrlState {
  const fallbackUrl = artifactId
    ? storageService.getDownloadUrl(artifactId, 'inline')
    : '';
  return useStoragePlaybackUrl(artifactId, fallbackUrl, options);
}
