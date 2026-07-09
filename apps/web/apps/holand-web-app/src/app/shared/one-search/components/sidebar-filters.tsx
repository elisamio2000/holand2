'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchFacets, OneSearchLaneId } from '@/types/one-search.types';
import { Checkbox } from 'rizzui';
import {
  PiCaretDownBold,
  PiCaretUpBold,
  PiFunnelBold,
  PiXBold,
} from 'react-icons/pi';

export interface SidebarFiltersProps {
  facets?: OneSearchFacets;
  selectedLanes?: OneSearchLaneId[];
  onLanesChange?: (lanes: OneSearchLaneId[]) => void;
  selectedDateRange?: string;
  onDateRangeChange?: (range: string) => void;
  selectedFileTypes?: string[];
  onFileTypesChange?: (types: string[]) => void;
  className?: string;
}

export function SidebarFilters({
  facets,
  selectedLanes = [],
  onLanesChange,
  selectedDateRange,
  onDateRangeChange,
  selectedFileTypes = [],
  onFileTypesChange,
  className,
}: SidebarFiltersProps) {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState({
    lanes: true,
    date: true,
    fileType: true,
    variants: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleLaneToggle = (lane: OneSearchLaneId) => {
    const newLanes = selectedLanes.includes(lane)
      ? selectedLanes.filter((l) => l !== lane)
      : [...selectedLanes, lane];
    onLanesChange?.(newLanes);
  };

  const handleFileTypeToggle = (type: string) => {
    const newTypes = selectedFileTypes.includes(type)
      ? selectedFileTypes.filter((t) => t !== type)
      : [...selectedFileTypes, type];
    onFileTypesChange?.(newTypes);
  };

  const clearAllFilters = () => {
    onLanesChange?.([]);
    onDateRangeChange?.('');
    onFileTypesChange?.([]);
  };

  const hasActiveFilters =
    selectedLanes.length > 0 || selectedDateRange || selectedFileTypes.length > 0;

  return (
    <aside className={cn('w-56 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <PiFunnelBold className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {t('searchHub.filters')}
          </h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('common.clear')}
          </button>
        )}
      </div>

      {/* Source Filter */}
      <FilterSection
        title={t('searchHub.filterSource')}
        isExpanded={expandedSections.lanes}
        onToggle={() => toggleSection('lanes')}
      >
        <div className="space-y-2">
          {facets?.byLane &&
            Object.entries(facets.byLane).map(([lane, count]) => (
              <label
                key={lane}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-1 rounded transition-colors"
              >
                <Checkbox
                  checked={selectedLanes.includes(lane as OneSearchLaneId)}
                  onChange={() => handleLaneToggle(lane as OneSearchLaneId)}
                  className="shrink-0"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                  {t(`searchHub.lanes.${lane}`)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  {count}
                </span>
              </label>
            ))}
        </div>
      </FilterSection>

      {/* Date Range Filter */}
      <FilterSection
        title={t('searchHub.filterDate')}
        isExpanded={expandedSections.date}
        onToggle={() => toggleSection('date')}
      >
        <div className="space-y-2">
          {facets?.byDate &&
            Object.entries(facets.byDate).map(([range, count]) => (
              <label
                key={range}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-1 rounded transition-colors"
              >
                <input
                  type="radio"
                  name="dateRange"
                  checked={selectedDateRange === range}
                  onChange={() => onDateRangeChange?.(range)}
                  className="shrink-0"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                  {t(`searchHub.dateRanges.${range}`)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  {count}
                </span>
              </label>
            ))}
        </div>
      </FilterSection>

      {/* File Type Filter */}
      <FilterSection
        title={t('searchHub.filterFileType')}
        isExpanded={expandedSections.fileType}
        onToggle={() => toggleSection('fileType')}
      >
        <div className="space-y-2">
          {facets?.byFileType &&
            Object.entries(facets.byFileType).map(([type, count]) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-1 rounded transition-colors"
              >
                <Checkbox
                  checked={selectedFileTypes.includes(type)}
                  onChange={() => handleFileTypeToggle(type)}
                  className="shrink-0"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 uppercase">
                  {type}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  {count}
                </span>
              </label>
            ))}
        </div>
      </FilterSection>

      {/* Script Variants */}
      {facets?.scriptVariants && facets.scriptVariants.length > 0 && (
        <FilterSection
          title={t('searchHub.filterScriptVariants')}
          isExpanded={expandedSections.variants}
          onToggle={() => toggleSection('variants')}
        >
          <div className="flex flex-wrap gap-2">
            {facets.scriptVariants.map((variant, idx) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded font-medium"
              >
                {variant}
              </span>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Related Entities */}
      {facets?.relatedEntities && facets.relatedEntities.length > 0 && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
            {t('searchHub.relatedEntities')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {facets.relatedEntities.map((entity, idx) => (
              <button
                key={idx}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {entity}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

interface FilterSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterSection({ title, isExpanded, onToggle, children }: FilterSectionProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full mb-2 group"
      >
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </h3>
        {isExpanded ? (
          <PiCaretUpBold className="h-3 w-3 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
        ) : (
          <PiCaretDownBold className="h-3 w-3 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
        )}
      </button>
      {isExpanded && <div>{children}</div>}
    </div>
  );
}
