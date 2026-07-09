'use client';

import { useTranslation } from 'react-i18next';
import { PiXBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import StorageArtifactThumbnail from '@/components/storage-artifact-thumbnail';

export interface VisualSearchArtifactChip {
  artifact_id?: string;
  filename?: string;
  /** Local blob preview while upload is in flight */
  previewUrl?: string;
}

export interface VisualSearchChipProps {
  artifactId?: string;
  filename?: string;
  /** Local blob preview while upload is in flight */
  previewUrl?: string;
  onRemove: () => void;
  uploading?: boolean;
  size?: 'compact' | 'large';
  className?: string;
}

function truncateFilename(name: string, max = 20): string {
  if (name.length <= max) return name;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const baseMax = Math.max(8, max - ext.length - 1);
  return `${name.slice(0, baseMax)}…${ext}`;
}

export function VisualSearchChip({
  artifactId,
  filename,
  previewUrl,
  onRemove,
  uploading = false,
  size = 'compact',
  className,
}: VisualSearchChipProps) {
  const { t } = useTranslation();
  const isLarge = size === 'large';
  const label = filename?.trim() || t('searchHub.searchByImage');
  const thumbSize = isLarge ? 'h-10 w-10' : 'h-8 w-8';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md border border-primary/25 bg-primary/[0.06] pe-1 ps-1',
        isLarge ? 'py-1' : 'py-0.5',
        className
      )}
      title={label}
      aria-label={uploading ? t('searchHub.visualUploading') : label}
    >
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-200/30',
          thumbSize
        )}
      >
        {uploading ? (
          <span
            className={cn(
              'inline-block animate-spin rounded-full border-2 border-primary/30 border-t-primary',
              isLarge ? 'h-5 w-5' : 'h-4 w-4'
            )}
            aria-hidden
          />
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : artifactId ? (
          <StorageArtifactThumbnail
            artifactId={artifactId}
            mimeType="image/*"
            alt={label}
            className="h-full w-full"
            preset="fileExplorerGrid"
            lazy={false}
          />
        ) : (
          <span className="text-[10px] text-gray-400">IMG</span>
        )}
      </div>

      <span
        className={cn(
          'truncate font-medium text-gray-700 dark:text-gray-300',
          isLarge ? 'max-w-[120px] text-sm' : 'max-w-[72px] text-xs'
        )}
      >
        {truncateFilename(label, isLarge ? 28 : 20)}
      </span>

      <button
        type="button"
        onClick={onRemove}
        disabled={uploading}
        className={cn(
          'flex shrink-0 items-center justify-center rounded text-gray-500 transition-colors',
          'hover:bg-gray-200/70 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40',
          'dark:hover:bg-gray-200/20 dark:hover:text-gray-200',
          isLarge ? 'h-7 w-7' : 'h-6 w-6'
        )}
        aria-label={t('searchHub.removeVisualSearch')}
      >
        <PiXBold className={isLarge ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      </button>
    </div>
  );
}
