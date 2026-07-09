'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchLaneId } from '@/types/one-search.types';
import { PiXBold } from 'react-icons/pi';

export interface FilterChipsProps {
  selectedLanes?: OneSearchLaneId[];
  onRemoveLane?: (lane: OneSearchLaneId) => void;
  selectedDateRange?: string;
  onRemoveDateRange?: () => void;
  selectedFileTypes?: string[];
  onRemoveFileType?: (type: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function FilterChips({
  selectedLanes = [],
  onRemoveLane,
  selectedDateRange,
  onRemoveDateRange,
  selectedFileTypes = [],
  onRemoveFileType,
  onClearAll,
  className,
}: FilterChipsProps) {
  const { t } = useTranslation();

  const hasFilters =
    selectedLanes.length > 0 || selectedDateRange || selectedFileTypes.length > 0;

  if (!hasFilters) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
        {t('searchHub.activeFilters')}:
      </span>

      {/* Lane Chips */}
      {selectedLanes.map((lane) => (
        <Chip
          key={lane}
          label={t(`searchHub.lanes.${lane}`)}
          onRemove={() => onRemoveLane?.(lane)}
        />
      ))}

      {/* Date Range Chip */}
      {selectedDateRange && (
        <Chip
          label={t(`searchHub.dateRanges.${selectedDateRange}`)}
          onRemove={onRemoveDateRange}
        />
      )}

      {/* File Type Chips */}
      {selectedFileTypes.map((type) => (
        <Chip
          key={type}
          label={type.toUpperCase()}
          onRemove={() => onRemoveFileType?.(type)}
        />
      ))}

      {/* Clear All */}
      <button
        onClick={onClearAll}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
      >
        {t('common.clearAll')}
      </button>
    </div>
  );
}

interface ChipProps {
  label: string;
  onRemove?: () => void;
}

function Chip({ label, onRemove }: ChipProps) {
  return (
    <div className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
      <span>{label}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-full p-0.5 transition-colors"
          aria-label="Remove filter"
        >
          <PiXBold className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
