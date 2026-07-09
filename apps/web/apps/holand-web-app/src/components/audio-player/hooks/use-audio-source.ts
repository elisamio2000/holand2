'use client';

import { useMemo } from 'react';
import { storageService } from '@/services/storage.service';
import { useStoragePlaybackUrl } from '@/hooks/use-storage-playback-url';
import type { AudioPlayerProps } from '../types';

export interface UseAudioSourceResult {
  resolvedSrc: string;
  srcLoading: boolean;
  srcError: boolean;
  retrySrc: () => void;
}

/**
 * Resolves playback URL from `artifactId` (JWT blob-first) or falls back to `src`.
 */
export function useAudioSource(
  props: Pick<AudioPlayerProps, 'src' | 'artifactId' | 'playbackStrategy'>
): UseAudioSourceResult {
  const { src: propSrc, artifactId, playbackStrategy = 'blob-first' } = props;

  const fallbackUrl = useMemo(() => {
    if (propSrc) return propSrc;
    if (artifactId) return storageService.getDownloadUrl(artifactId, 'inline');
    return '';
  }, [propSrc, artifactId]);

  const {
    src: resolvedArtifactSrc,
    loading,
    error,
    retry,
  } = useStoragePlaybackUrl(artifactId, fallbackUrl, {
    strategy: playbackStrategy,
    enabled: Boolean(artifactId),
  });

  if (artifactId) {
    return {
      resolvedSrc: resolvedArtifactSrc,
      srcLoading: loading,
      srcError: error,
      retrySrc: retry,
    };
  }

  return {
    resolvedSrc: propSrc ?? '',
    srcLoading: false,
    srcError: false,
    retrySrc: retry,
  };
}
