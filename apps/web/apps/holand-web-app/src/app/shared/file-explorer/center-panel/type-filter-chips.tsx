// ============================================
// TypeFilterChips — Colorful clickable file type pills
// Matches the design from graph/edit-entities entity type pills
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { FILE_TYPE_CONFIG, getFileTypeConfig } from '@/config/file-type-config';
import type {
  FileTypeKey,
  Artifact,
  FileManagerTotals,
} from '@/types/storage.types';

interface TypeFilterChipsProps {
  /** Current active type filter */
  activeType: FileTypeKey;
  /** Callback when a type is clicked */
  onTypeChange: (type: FileTypeKey) => void;
  /** All artifacts for calculating counts */
  allArtifacts: Artifact[];
  /** Currently visible artifacts after filtering */
  visibleArtifacts: Artifact[];
  /**
   * Server-side totals from `plugin.file_manager.facets`. Keyed by media_type
   * (e.g. 'image', 'document', 'video'). When provided, replaces local totals
   * because the backend has visibility across pages and ownership scope.
   */
  serverTotals?: Record<string, FileManagerTotals>;
}

/**
 * TypeFilterChips — Displays colorful clickable pills for each file type.
 *
 * Design pattern from graph-data-processor entity pills:
 * - Colorful pills with config colors
 * - Shows included/total count badges
 * - Clickable to toggle filter
 * - Active state with darker styling
 *
 * @example
 * ```tsx
 * <TypeFilterChips
 *   activeType={activeType}
 *   onTypeChange={setActiveType}
 *   allArtifacts={allFiles}
 *   visibleArtifacts={filteredFiles}
 * />
 * ```
 */
export default function TypeFilterChips({
  activeType,
  onTypeChange,
  allArtifacts,
  visibleArtifacts,
  serverTotals,
}: TypeFilterChipsProps) {
  const { t } = useTranslation();

  /**
   * Calculate counts for each type.
   * Similar to entity type stats calculation in graph-data-processor.
   */
  const typeCounts = useMemo(() => {
    const counts: Record<FileTypeKey, { total: number; visible: number }> = {
      all: { total: allArtifacts.length, visible: visibleArtifacts.length },
      image: { total: 0, visible: 0 },
      pdf: { total: 0, visible: 0 },
      video: { total: 0, visible: 0 },
      audio: { total: 0, visible: 0 },
      archive: { total: 0, visible: 0 },
      text: { total: 0, visible: 0 },
      other: { total: 0, visible: 0 },
    };

    // Count total per type
    allArtifacts.forEach((artifact) => {
      const mime = artifact.mime_type || '';
      const media = artifact.media_type || '';
      if (mime.startsWith('image/') || media === 'image') counts.image.total++;
      else if (mime === 'application/pdf') counts.pdf.total++;
      else if (mime.startsWith('video/') || media === 'video') counts.video.total++;
      else if (mime.startsWith('audio/') || media === 'audio') counts.audio.total++;
      else if (mime.startsWith('text/') || media === 'text') counts.text.total++;
      else if (
        mime.includes('zip') ||
        mime.includes('tar') ||
        mime.includes('rar') ||
        mime.includes('7z') ||
        mime.includes('archive')
      )
        counts.archive.total++;
      else counts.other.total++;
    });

    // Count visible per type
    visibleArtifacts.forEach((artifact) => {
      const mime = artifact.mime_type || '';
      const media = artifact.media_type || '';
      if (mime.startsWith('image/') || media === 'image') counts.image.visible++;
      else if (mime === 'application/pdf') counts.pdf.visible++;
      else if (mime.startsWith('video/') || media === 'video') counts.video.visible++;
      else if (mime.startsWith('audio/') || media === 'audio') counts.audio.visible++;
      else if (mime.startsWith('text/') || media === 'text') counts.text.visible++;
      else if (
        mime.includes('zip') ||
        mime.includes('tar') ||
        mime.includes('rar') ||
        mime.includes('7z') ||
        mime.includes('archive')
      )
        counts.archive.visible++;
      else counts.other.visible++;
    });

    // Override totals with backend facets when present. Backend uses
    // media_type categories ('image' | 'document' | 'video' | 'audio' |
    // 'archive' | 'other'). Map them to chip keys: 'document' feeds both
    // 'pdf' and 'text' chips since the chip set is finer-grained.
    if (serverTotals) {
      const get = (k: string) => serverTotals[k]?.count ?? 0;
      counts.image.total = get('image');
      counts.video.total = get('video');
      counts.audio.total = get('audio');
      counts.archive.total = get('archive');
      counts.other.total = get('other');
      counts.text.total = Math.max(counts.text.total, get('text'));
      counts.pdf.total = Math.max(counts.pdf.total, get('document'));
      // Sum up media_type buckets for the 'all' total so chip math is
      // consistent.
      counts.all.total = Object.values(serverTotals).reduce(
        (sum, b) => sum + (b?.count ?? 0),
        0
      );
    }

    return counts;
  }, [allArtifacts, visibleArtifacts, serverTotals]);

  const typeKeys: FileTypeKey[] = [
    'all',
    'image',
    'pdf',
    'video',
    'audio',
    'archive',
    'text',
    'other',
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {typeKeys.map((typeKey) => {
        const config = getFileTypeConfig(typeKey);
        const Icon = config.icon;
        const labelMap: Record<FileTypeKey, string> = {
          all: t('fileExplorer.types.all'),
          image: t('fileExplorer.types.image'),
          pdf: t('fileExplorer.types.pdf'),
          video: t('fileExplorer.types.video'),
          audio: t('fileExplorer.types.audio'),
          archive: t('fileExplorer.types.archive'),
          text: t('fileExplorer.types.text'),
          other: t('fileExplorer.types.other'),
        };
        const label = labelMap[typeKey];
        const { total, visible } = typeCounts[typeKey];
        const isActive = activeType === typeKey;
        const isEmpty = total === 0 && typeKey !== 'all';

        // Skip 'other' if backend has no unmatched files
        if (typeKey === 'other' && total === 0) return null;

        return (
          <Tooltip
            key={typeKey}
            content={
              <span className="flex items-center gap-1">
                <span>{label}</span>
                <span className="font-mono text-[10px] opacity-70">
                  {visible}/{total}
                </span>
              </span>
            }
            placement="top"
            size="sm"
          >
            <button
              type="button"
              onClick={() => !isEmpty && onTypeChange(typeKey)}
              aria-label={`${label} (${visible}/${total})`}
              aria-pressed={isActive}
              style={
                isEmpty
                  ? undefined
                  : {
                      backgroundColor: isActive ? config.color : `${config.color}14`,
                      borderColor: isActive ? config.color : `${config.color}40`,
                      color: isActive ? '#fff' : config.color,
                    }
              }
              className={cn(
                'group relative inline-flex h-8 min-w-[2.4rem] items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium transition-all',
                isEmpty
                  ? 'cursor-default border-gray-200 bg-gray-50 text-gray-300 dark:border-gray-700 dark:bg-gray-100/40'
                  : 'hover:shadow-sm',
                isActive && !isEmpty && 'shadow-sm'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{label}</span>
              {/* count badge — small chip overlapping bottom-right */}
              {!isEmpty && total > 0 && (
                <span
                  className={cn(
                    'min-w-[1.25rem] rounded-full px-1 text-[10px] font-mono leading-tight',
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-gray-0 dark:bg-gray-50'
                  )}
                  style={isActive ? undefined : { color: config.color }}
                >
                  {total}
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

