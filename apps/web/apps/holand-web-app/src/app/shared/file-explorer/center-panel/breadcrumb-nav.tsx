// ============================================
// BreadcrumbNav — Folder path breadcrumb
// Shows current folder path with click-to-navigate segments.
// ============================================

'use client';

import { PiHouseBold, PiCaretRightBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';

interface BreadcrumbNavProps {
  /** Current folder path e.g. "Documents/Reports/Q1". Empty = root. */
  path: string;
  onNavigate: (path: string) => void;
  className?: string;
}

/**
 * BreadcrumbNav — Folder breadcrumb for file explorer center panel.
 *
 * Splits folder_path by "/" and renders each segment as a clickable link.
 * Root is represented by a house icon.
 *
 * @example
 * ```tsx
 * <BreadcrumbNav path="Documents/Reports" onNavigate={setCurrentPath} />
 * // Renders: 🏠 > Documents > Reports
 * ```
 */
export default function BreadcrumbNav({ path, onNavigate, className }: BreadcrumbNavProps) {
  const { t } = useTranslation();
  const segments = path ? path.split('/').filter(Boolean) : [];
  const maxVisibleSegments = 4;
  const shouldCollapse = segments.length > maxVisibleSegments;
  const head = shouldCollapse ? segments.slice(0, 1) : segments;
  const tail = shouldCollapse ? segments.slice(-2) : [];
  const visibleSegments = shouldCollapse ? [...head, '...', ...tail] : segments;

  const handleSegmentClick = (index: number) => {
    // Build path up to and including this segment
    const newPath = segments.slice(0, index + 1).join('/');
    onNavigate(newPath);
  };

  return (
    <nav
      aria-label="Folder navigation"
      className={cn('flex min-w-0 items-center gap-1 text-sm', className)}
      title={path}
    >
      {/* Root */}
      <button
        onClick={() => onNavigate('')}
        className={cn(
          'flex items-center rounded p-1 transition-colors',
          segments.length === 0
            ? 'text-primary font-medium'
            : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
        )}
        title={t('fileExplorer.root')}
      >
        <PiHouseBold className="h-4 w-4" />
      </button>

      {/* Segments */}
      {visibleSegments.map((segment, idx) => {
        const realIndex = shouldCollapse
          ? idx === 0
            ? 0
            : idx === visibleSegments.length - 2
            ? segments.length - 2
            : idx === visibleSegments.length - 1
            ? segments.length - 1
            : -1
          : idx;
        const isEllipsis = segment === '...';
        const isLast = realIndex === segments.length - 1;
        const hiddenSegments = shouldCollapse ? segments.slice(1, -2).join(' / ') : '';

        return (
          <span key={`${segment}-${idx}`} className="flex min-w-0 items-center gap-1">
            <PiCaretRightBold className="h-3 w-3 text-gray-400" />
            <button
              onClick={() => !isEllipsis && !isLast && handleSegmentClick(realIndex)}
              className={cn(
                'max-w-[180px] truncate rounded px-1 py-0.5 transition-colors',
                isEllipsis
                  ? 'cursor-default text-gray-400'
                  : isLast
                  ? 'text-gray-900 font-medium dark:text-gray-100 cursor-default'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-100/10'
              )}
              title={isEllipsis ? hiddenSegments : segment}
            >
              {isEllipsis ? '...' : segment}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
