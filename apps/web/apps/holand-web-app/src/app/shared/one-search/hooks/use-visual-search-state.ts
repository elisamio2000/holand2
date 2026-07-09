'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import type { OneSearchMode, OneSearchQueryImage } from '@/types/one-search.types';
import { isRateLimitedError } from '@/lib/gateway-retry';
import { isSearchAbortError } from '../utils/search-request-policy';
import {
  cancelPendingVisualUploads,
  queueVisualSearchUpload,
} from '../utils/visual-upload-coordinator';
import {
  isEphemeralCleanupEnabled,
  purgeActiveEphemeralArtifact,
  purgeEphemeralQueryImage,
  registerEphemeralArtifact,
} from '../utils/ephemeral-visual-artifact';
import type { VisualSearchArtifactChip } from '../components/visual-search-chip';

type PendingVisualUpload = {
  filename: string;
  previewUrl: string;
};

export interface UseVisualSearchStateOptions {
  query: string;
  mode: OneSearchMode;
  queryImage: OneSearchQueryImage | null;
  setQueryImage: (v: OneSearchQueryImage | null) => void;
  setMode: (m: OneSearchMode) => void;
  applyToUrl: (
    nextQuery: string,
    nextMode: OneSearchMode,
    visual?: OneSearchQueryImage | null
  ) => void;
}

export function useVisualSearchState({
  query,
  mode,
  queryImage,
  setQueryImage,
  setMode,
  applyToUrl,
}: UseVisualSearchStateOptions) {
  const { t } = useTranslation();
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadRateLimited, setUploadRateLimited] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [queryImagePreview, setQueryImagePreview] = useState<PendingVisualUpload | null>(null);

  useEffect(() => {
    return () => {
      if (queryImagePreview?.previewUrl) {
        URL.revokeObjectURL(queryImagePreview.previewUrl);
      }
      purgeActiveEphemeralArtifact();
    };
  }, [queryImagePreview?.previewUrl]);

  const visualArtifactChip = useMemo((): VisualSearchArtifactChip | null => {
    if (!queryImage?.artifact_id && !queryImagePreview && !imageUploading) {
      return null;
    }
    return {
      artifact_id: queryImage?.artifact_id,
      filename: queryImagePreview?.filename ?? uploadedFileName ?? undefined,
      previewUrl: queryImagePreview?.previewUrl,
    };
  }, [queryImage?.artifact_id, queryImagePreview, uploadedFileName, imageUploading]);

  const runVisualSearch = useCallback(
    (visual: OneSearchQueryImage, nextMode?: OneSearchMode) => {
      // Use provided mode, or keep current mode (don't force to 'image')
      const targetMode = nextMode ?? mode;
      setQueryImage(visual);
      setMode(targetMode);
      applyToUrl(query, targetMode, visual);
    },
    [applyToUrl, query, mode, setMode, setQueryImage]
  );

  const handleClearVisual = useCallback(() => {
    cancelPendingVisualUploads();
    purgeEphemeralQueryImage(queryImage);
    if (queryImagePreview?.previewUrl) {
      URL.revokeObjectURL(queryImagePreview.previewUrl);
    }
    setQueryImagePreview(null);
    setUploadedFileName(null);
    setQueryImage(null);
    setUploadRateLimited(false);
    setImageUploading(false);
    toast.dismiss('visual-upload');
    applyToUrl(query, mode, null);
  }, [applyToUrl, query, mode, queryImage, queryImagePreview, setQueryImage]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      cancelPendingVisualUploads();
      purgeEphemeralQueryImage(queryImage);
      setUploadRateLimited(false);
      if (queryImagePreview?.previewUrl) {
        URL.revokeObjectURL(queryImagePreview.previewUrl);
      }

      const previewUrl = URL.createObjectURL(file);
      setQueryImagePreview({ filename: file.name, previewUrl });
      setUploadedFileName(file.name);
      setImageUploading(true);
      toast.loading(t('searchHub.visualUploading'), { id: 'visual-upload' });

      try {
        const visual = await queueVisualSearchUpload(file);
        if (visual.ephemeral) {
          registerEphemeralArtifact(visual.artifact_id);
        }
        // Keep current mode when uploading image (e.g. user in 'all' mode stays in 'all')
        runVisualSearch(visual);
        toast.success(t('searchHub.visualSearchStarted'), { id: 'visual-upload' });
      } catch (err) {
        if (isSearchAbortError(err)) {
          toast.dismiss('visual-upload');
          return;
        }
        URL.revokeObjectURL(previewUrl);
        setQueryImagePreview(null);
        setUploadedFileName(null);
        if (isRateLimitedError(err)) {
          setUploadRateLimited(true);
          toast.error(t('searchHub.rateLimitedMessage'), { id: 'visual-upload' });
          return;
        }
        toast.error(err instanceof Error ? err.message : t('searchHub.visualSearchFailed'), {
          id: 'visual-upload',
        });
      } finally {
        setImageUploading(false);
      }
    },
    [runVisualSearch, t, queryImage, queryImagePreview]
  );

  const clearPreviewOnTextSubmit = useCallback(() => {
    purgeEphemeralQueryImage(queryImage);
    if (queryImagePreview?.previewUrl) {
      URL.revokeObjectURL(queryImagePreview.previewUrl);
    }
    setQueryImagePreview(null);
    setUploadedFileName(null);
    setQueryImage(null);
    applyToUrl(query.trim(), mode, null);
  }, [applyToUrl, query, mode, queryImage, queryImagePreview, setQueryImage]);

  return {
    imageUploading,
    uploadRateLimited,
    visualArtifactChip,
    runVisualSearch,
    handleClearVisual,
    handleImageUpload,
    clearPreviewOnTextSubmit,
    ephemeralCleanupEnabled: isEphemeralCleanupEnabled(),
  };
}
