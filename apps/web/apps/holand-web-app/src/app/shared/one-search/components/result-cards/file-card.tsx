'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Badge } from 'rizzui';
import cn from '@core/utils/class-names';
import { OneSearchHit, OneSearchLaneId } from '@/types/one-search.types';
import { formatRelativeDate, formatFileSize } from '../../utils/format-date';
import { LaneResultIcon } from './lane-result-icon';
import { PiFolderOpenDuotone, PiClockDuotone, PiArrowSquareOutBold } from 'react-icons/pi';
import { artifactIdFromHit } from '@/utils/storage-artifact-media';
import { useHitFilePreview } from '../hit-file-actions';

export interface FileCardProps {
  data: OneSearchHit;
  lane?: OneSearchLaneId;
  onClick?: () => void;
  className?: string;
}

export function FileCard({ data, lane = 'files', onClick, className }: FileCardProps) {
  const { t, i18n } = useTranslation();
  const previewHit = useHitFilePreview();
  const artifactId = artifactIdFromHit(data.meta);
  const href = data.href || '#';
  const pathLine = data.href ? data.href.replace(/^https?:\/\/[^/]+/i, '') : '';
  const iconLane: OneSearchLaneId = lane === 'storage' ? 'storage' : 'files';

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return formatRelativeDate(dateString, i18n.language);
  };

  const handleMainClick = () => {
    if (artifactId && previewHit(data)) return;
    onClick?.();
  };

  const inner = (
    <div
      className={cn(
        'group flex gap-3 rounded-lg border border-transparent p-3 transition-all',
        'hover:border-amber-200/80 hover:bg-amber-50/30 hover:shadow-sm',
        'dark:hover:border-amber-900/40 dark:hover:bg-amber-950/15',
        className
      )}
    >
      <LaneResultIcon lane={iconLane} />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 font-mono text-[15px] font-medium text-blue-700 group-hover:underline dark:text-blue-400">
          {data.title}
        </h3>
        {pathLine ? (
          <p className="mt-1 truncate font-mono text-xs text-emerald-800 dark:text-emerald-400/90">{pathLine}</p>
        ) : null}
        {data.snippet ? (
          <p className="mt-2 line-clamp-2 font-sans text-sm text-gray-600 dark:text-gray-400">{data.snippet}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {data.meta?.path ? (
            <span className="inline-flex max-w-full items-center gap-1 truncate">
              <PiFolderOpenDuotone className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="truncate">{String(data.meta.path)}</span>
            </span>
          ) : null}
          {data.meta?.mime ? (
            <Badge rounded="md" variant="outline" className="text-[10px] font-normal">
              {String(data.meta.mime)}
            </Badge>
          ) : null}
          {data.meta?.match ? (
            <Badge rounded="md" color="secondary" className="text-[10px] font-normal">
              {String(data.meta.match)}
            </Badge>
          ) : null}
          {data.meta?.size_bytes ? <span>{formatFileSize(Number(data.meta.size_bytes))}</span> : null}
          {data.occurredAt ? (
            <span className="inline-flex items-center gap-1">
              <PiClockDuotone className="h-3.5 w-3.5 text-gray-400" />
              {formatDate(data.occurredAt)}
            </span>
          ) : null}
        </div>
        {artifactId && href !== '#' ? (
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <PiArrowSquareOutBold className="h-3.5 w-3.5" />
            {t('searchHub.openInFileExplorer', { defaultValue: 'Open in File Explorer' })}
          </Link>
        ) : null}
      </div>
    </div>
  );

  if (onClick || artifactId) {
    return (
      <button type="button" className="block w-full text-start" onClick={handleMainClick}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
      {inner}
    </Link>
  );
}
