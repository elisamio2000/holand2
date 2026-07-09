'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PiDownloadBold, PiEyeBold } from 'react-icons/pi';

import cn from '@core/utils/class-names';
import { useFilePreview } from '@/hooks/use-file-preview';
import { getFileCategory } from '@/utils/mime-utils';
import { artifactIdFromHit, downloadStorageArtifact } from '@/utils/storage-artifact-media';
import { storageService } from '@/services/storage.service';
import type { OneSearchHit } from '@/types/one-search.types';
import { hitMediaMeta } from '../utils/media-hit-meta';
import toast from 'react-hot-toast';

export interface HitFileActionsProps {
  hit: OneSearchHit;
  variant?: 'buttons' | 'icons';
  className?: string;
  /** Active MPS session when preview opens from inline/grid player — preserves playback. */
  mediaSessionId?: string;
  initialShowWaveform?: boolean;
}

export function HitFileActions({
  hit,
  variant = 'buttons',
  className,
  mediaSessionId,
  initialShowWaveform,
}: HitFileActionsProps) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();
  const artifactId = artifactIdFromHit(hit.meta);
  const disabled = !artifactId;
  const mimeType = String(hit.meta?.mime || '');
  const size = Number(hit.meta?.size_bytes || 0);
  const disabledTip = t('searchHub.previewUnavailable', {
    defaultValue: 'No storage artifact linked',
  });

  const handlePreview = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (!artifactId) return;
      const category = getFileCategory(mimeType, hit.title);
      const meta = hitMediaMeta(hit);
      const startSec = meta.transcript_match?.start_sec;
      openFilePreview({
        src: storageService.getDownloadUrl(artifactId, 'inline'),
        name: hit.title,
        mimeType,
        fileSize: size || undefined,
        artifactId,
        meta: hit.meta as Record<string, unknown> | undefined,
        mediaSessionId,
        initialShowWaveform,
        initialCurrentTime:
          (category === 'video' || category === 'audio') &&
          startSec != null &&
          Number.isFinite(startSec)
            ? startSec
            : undefined,
      });
    },
    [artifactId, hit, mimeType, openFilePreview, size, mediaSessionId, initialShowWaveform]
  );

  const handleDownload = useCallback(
    async (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (!artifactId) return;
      try {
        await downloadStorageArtifact(artifactId, hit.title);
      } catch {
        toast.error(t('common.error', { defaultValue: 'Something went wrong' }));
      }
    },
    [artifactId, hit.title, t]
  );

  if (variant === 'icons') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Tooltip content={disabled ? disabledTip : t('common.preview')} placement="top">
          <span>
            <button
              type="button"
              disabled={disabled}
              onClick={handlePreview}
              className={cn(
                'rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20',
                disabled && 'cursor-not-allowed opacity-40'
              )}
              aria-label={t('common.preview')}
            >
              <PiEyeBold className="h-4 w-4" />
            </button>
          </span>
        </Tooltip>
        <Tooltip content={disabled ? disabledTip : t('common.download')} placement="top">
          <span>
            <button
              type="button"
              disabled={disabled}
              onClick={handleDownload}
              className={cn(
                'rounded p-1 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20',
                disabled && 'cursor-not-allowed opacity-40'
              )}
              aria-label={t('common.download')}
            >
              <PiDownloadBold className="h-4 w-4" />
            </button>
          </span>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Tooltip content={disabled ? disabledTip : undefined} placement="top">
        <span>
          <button
            type="button"
            disabled={disabled}
            onClick={handlePreview}
            className={cn(
              'flex items-center gap-1 rounded border border-muted px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20',
              disabled && 'cursor-not-allowed opacity-40'
            )}
          >
            <PiEyeBold className="h-3 w-3" />
            <span>{t('common.preview')}</span>
          </button>
        </span>
      </Tooltip>
      <Tooltip content={disabled ? disabledTip : undefined} placement="top">
        <span>
          <button
            type="button"
            disabled={disabled}
            onClick={handleDownload}
            className={cn(
              'flex items-center gap-1 rounded border border-muted px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20',
              disabled && 'cursor-not-allowed opacity-40'
            )}
          >
            <PiDownloadBold className="h-3 w-3" />
            <span>{t('common.download')}</span>
          </button>
        </span>
      </Tooltip>
    </div>
  );
}

export function useHitFilePreview() {
  const { openFilePreview } = useFilePreview();

  return useCallback(
    (hit: OneSearchHit) => {
      const artifactId = artifactIdFromHit(hit.meta);
      if (!artifactId) return false;
      openFilePreview({
        src: storageService.getDownloadUrl(artifactId, 'inline'),
        name: hit.title,
        mimeType: String(hit.meta?.mime || ''),
        fileSize: Number(hit.meta?.size_bytes || 0) || undefined,
        artifactId,
      });
      return true;
    },
    [openFilePreview]
  );
}
