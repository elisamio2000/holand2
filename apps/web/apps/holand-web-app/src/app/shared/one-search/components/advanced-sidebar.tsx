'use client';

import { useState } from 'react';
import { Text, Title, Checkbox, Input } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  PiFunnelDuotone,
  PiCaretDownBold,
  PiCaretUpBold,
  PiCalendarDuotone,
  PiSortAscendingBold,
  PiXBold,
  PiChatCenteredDotsDuotone,
  PiFolderOpenDuotone,
  PiFolderDuotone,
  PiHardDrivesDuotone,
  PiUserCircleDuotone,
  PiGraphDuotone,
  PiListChecksDuotone,
  PiFileDocDuotone,
  PiGlobeDuotone,
  PiStarDuotone,
  PiArchiveDuotone,
} from 'react-icons/pi';
import type { OneSearchLaneId } from '@/types/one-search.types';
import { getOneSearchVisibleLaneIds } from '../config/search-config';

export interface AdvancedSearchFilters {
  lanes: OneSearchLaneId[];
  dateRange: 'any' | 'today' | 'week' | 'month' | 'year';
  fileTypes: string[];
  languages: string[];
  sortBy: 'relevance' | 'date_desc' | 'date_asc' | 'score_desc';
  minScore?: number;
  includeArchived?: boolean;
}

interface AdvancedSidebarProps {
  filters: AdvancedSearchFilters;
  onFiltersChange: (filters: AdvancedSearchFilters) => void;
  laneCounts?: Record<OneSearchLaneId, number>;
  isOpen?: boolean;
  onClose?: () => void;
  showClientFilterNote?: boolean;
  className?: string;
}

export function AdvancedSidebar({
  filters,
  onFiltersChange,
  laneCounts,
  isOpen = true,
  onClose,
  showClientFilterNote = false,
  className,
}: AdvancedSidebarProps) {
  const { t } = useTranslation();
  const visibleLaneIds = getOneSearchVisibleLaneIds();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['lanes', 'date', 'fileTypes', 'sort'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) newSet.delete(section);
      else newSet.add(section);
      return newSet;
    });
  };

  const handleLaneToggle = (lane: OneSearchLaneId) => {
    const newLanes = filters.lanes.includes(lane)
      ? filters.lanes.filter((l) => l !== lane)
      : [...filters.lanes, lane];
    onFiltersChange({ ...filters, lanes: newLanes });
  };

  const handleFileTypeToggle = (ft: string) => {
    const newTypes = filters.fileTypes.includes(ft)
      ? filters.fileTypes.filter((t) => t !== ft)
      : [...filters.fileTypes, ft];
    onFiltersChange({ ...filters, fileTypes: newTypes });
  };

  const handleLanguageToggle = (lang: string) => {
    const newLangs = filters.languages.includes(lang)
      ? filters.languages.filter((l) => l !== lang)
      : [...filters.languages, lang];
    onFiltersChange({ ...filters, languages: newLangs });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      lanes: [],
      dateRange: 'any',
      fileTypes: [],
      languages: [],
      sortBy: 'relevance',
      minScore: undefined,
      includeArchived: false,
    });
  };

  const hasActiveFilters =
    filters.lanes.length > 0 ||
    filters.dateRange !== 'any' ||
    filters.fileTypes.length > 0 ||
    filters.languages.length > 0 ||
    filters.sortBy !== 'relevance' ||
    filters.minScore !== undefined ||
    filters.includeArchived;

  const activeCount = [
    filters.lanes.length > 0,
    filters.dateRange !== 'any',
    filters.fileTypes.length > 0,
    filters.languages.length > 0,
    filters.sortBy !== 'relevance',
    filters.minScore !== undefined,
    filters.includeArchived,
  ].filter(Boolean).length;

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'w-72 shrink-0 overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-muted px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <PiFunnelDuotone className="h-4 w-4 text-primary" />
          <Title as="h5" className="text-xs font-semibold text-gray-900 dark:text-gray-700">
            {t('searchHub.filters.advancedFilters')}
          </Title>
          {activeCount > 0 && (
            <span className="inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-200/20"
              title={t('searchHub.filters.clearAll')}
            >
              <PiXBold className="h-3.5 w-3.5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-200/20 dark:hover:text-gray-300"
            >
              <PiCaretDownBold className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {showClientFilterNote && (
        <Text className="border-b border-muted px-3.5 py-2 text-[10px] leading-snug text-amber-800 dark:text-amber-200">
          {t('searchHub.advancedFiltersClientOnlyNote')}
        </Text>
      )}

      {/* Scrollable Body */}
      <div className="max-h-[calc(100vh-240px)] overflow-y-auto p-3">
        <div className="space-y-2.5">
          {/* --- Categories / Lanes --- */}
          <FilterSection
            title={t('searchHub.filters.categories')}
            icon={<PiFolderDuotone className="h-4 w-4 text-primary" />}
            isExpanded={expandedSections.has('lanes')}
            onToggle={() => toggleSection('lanes')}
          >
            <div className="space-y-1.5">
              {visibleLaneIds.map((laneId) => {
                const cfg = LANE_CONFIG[laneId];
                const count = laneCounts?.[laneId] || 0;
                const isChecked = filters.lanes.includes(laneId);
                return (
                  <label
                    key={laneId}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-md border p-2 transition-colors',
                      isChecked
                        ? 'border-primary/30 bg-primary/[0.06] dark:border-primary/20 dark:bg-primary/10'
                        : 'border-muted hover:bg-gray-100 dark:hover:bg-gray-200/20'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={isChecked} onChange={() => handleLaneToggle(laneId)} />
                      {cfg.icon}
                      <LaneLabel laneId={laneId} />
                    </div>
                    <Text className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{count}</Text>
                  </label>
                );
              })}
            </div>
          </FilterSection>

          {/* --- Date Range --- */}
          <FilterSection
            title={t('searchHub.filters.dateRange')}
            icon={<PiCalendarDuotone className="h-4 w-4 text-primary" />}
            isExpanded={expandedSections.has('date')}
            onToggle={() => toggleSection('date')}
          >
            <div className="space-y-1">
              {DATE_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                    filters.dateRange === opt
                      ? 'bg-primary/[0.08] font-medium text-primary dark:bg-primary/15'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
                  )}
                >
                  <input
                    type="radio"
                    name="dateRange"
                    checked={filters.dateRange === opt}
                    onChange={() => onFiltersChange({ ...filters, dateRange: opt })}
                    className="sr-only"
                  />
                  <span>{t(`searchHub.filters.${DATE_LABEL_MAP[opt]}`)}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* --- File Types --- */}
          <FilterSection
            title={t('searchHub.filters.fileTypes')}
            icon={<PiFileDocDuotone className="h-4 w-4 text-primary" />}
            isExpanded={expandedSections.has('fileTypes')}
            onToggle={() => toggleSection('fileTypes')}
          >
            <div className="space-y-1.5">
              {FILE_TYPE_OPTIONS.map((ft) => {
                const isChecked = filters.fileTypes.includes(ft.value);
                return (
                  <label
                    key={ft.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors',
                      isChecked
                        ? 'border-primary/30 bg-primary/[0.06] dark:border-primary/20 dark:bg-primary/10'
                        : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-200/20'
                    )}
                  >
                    <Checkbox checked={isChecked} onChange={() => handleFileTypeToggle(ft.value)} />
                    <span className="text-gray-700 dark:text-gray-400">{ft.label}</span>
                  </label>
                );
              })}
            </div>
          </FilterSection>

          {/* --- Language --- */}
          <FilterSection
            title={t('searchHub.filters.language')}
            icon={<PiGlobeDuotone className="h-4 w-4 text-primary" />}
            isExpanded={expandedSections.has('language')}
            onToggle={() => toggleSection('language')}
          >
            <div className="space-y-1.5">
              {LANGUAGE_OPTIONS.map((lang) => {
                const isChecked = filters.languages.includes(lang.value);
                return (
                  <label
                    key={lang.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors',
                      isChecked
                        ? 'border-primary/30 bg-primary/[0.06] dark:border-primary/20 dark:bg-primary/10'
                        : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-200/20'
                    )}
                  >
                    <Checkbox checked={isChecked} onChange={() => handleLanguageToggle(lang.value)} />
                    <span className="text-gray-700 dark:text-gray-400">{lang.label}</span>
                  </label>
                );
              })}
            </div>
          </FilterSection>

          {/* --- Sort By --- */}
          <FilterSection
            title={t('searchHub.filters.sortBy')}
            icon={<PiSortAscendingBold className="h-4 w-4 text-primary" />}
            isExpanded={expandedSections.has('sort')}
            onToggle={() => toggleSection('sort')}
          >
            <div className="space-y-1">
              {SORT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                    filters.sortBy === opt.value
                      ? 'bg-primary/[0.08] font-medium text-primary dark:bg-primary/15'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/20'
                  )}
                >
                  <input
                    type="radio"
                    name="sortBy"
                    checked={filters.sortBy === opt.value}
                    onChange={() => onFiltersChange({ ...filters, sortBy: opt.value })}
                    className="sr-only"
                  />
                  <span>{t(`searchHub.filters.${opt.labelKey}`)}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* --- Min Score --- */}
          <FilterSection
            title={t('searchHub.filters.minScore')}
            icon={<PiStarDuotone className="h-4 w-4 text-primary" />}
            isExpanded={expandedSections.has('score')}
            onToggle={() => toggleSection('score')}
          >
            <Input
              type="number"
              size="sm"
              min={0}
              max={1}
              step={0.1}
              placeholder="0.0 – 1.0"
              value={filters.minScore ?? ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  minScore: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              className="[&_input]:text-xs"
            />
          </FilterSection>

          {/* --- Include Archived --- */}
          <FilterSection
            title={t('searchHub.filters.other')}
            icon={<PiArchiveDuotone className="h-4 w-4 text-primary" />}
            isExpanded={expandedSections.has('other')}
            onToggle={() => toggleSection('other')}
          >
            <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs text-gray-700 dark:text-gray-400">
              <Checkbox
                checked={filters.includeArchived || false}
                onChange={() =>
                  onFiltersChange({ ...filters, includeArchived: !filters.includeArchived })
                }
              />
              <span>{t('searchHub.filters.includeArchived')}</span>
            </label>
          </FilterSection>
        </div>
      </div>
    </div>
  );
}

function LaneLabel({ laneId }: { laneId: OneSearchLaneId }) {
  const { t } = useTranslation();
  return (
    <Text className="text-xs font-medium text-gray-700 dark:text-gray-400">
      {t(`searchHub.lanes.${laneId}`)}
    </Text>
  );
}

function FilterSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-muted">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-t-md px-2.5 py-2 text-start transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
      >
        <div className="flex items-center gap-1.5">
          {icon}
          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-600">{title}</Text>
        </div>
        {isExpanded ? (
          <PiCaretUpBold className="h-3 w-3 text-gray-400" />
        ) : (
          <PiCaretDownBold className="h-3 w-3 text-gray-400" />
        )}
      </button>
      {isExpanded && <div className="border-t border-muted p-2.5">{children}</div>}
    </div>
  );
}

const LANE_CONFIG: Record<OneSearchLaneId, { icon: React.ReactNode }> = {
  chat: {
    icon: <PiChatCenteredDotsDuotone className="h-4 w-4 text-primary" />,
  },
  cases: {
    icon: <PiFolderOpenDuotone className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
  },
  files: {
    icon: <PiFolderDuotone className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
  },
  storage: {
    icon: <PiHardDrivesDuotone className="h-4 w-4 text-teal-600 dark:text-teal-400" />,
  },
  users: {
    icon: <PiUserCircleDuotone className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" />,
  },
  graph: {
    icon: <PiGraphDuotone className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
  },
  projects_tasks: {
    icon: <PiListChecksDuotone className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />,
  },
};

const DATE_OPTIONS: AdvancedSearchFilters['dateRange'][] = ['any', 'today', 'week', 'month', 'year'];

const DATE_LABEL_MAP: Record<string, string> = {
  any: 'anytime',
  today: 'today',
  week: 'lastWeek',
  month: 'lastMonth',
  year: 'lastYear',
};

const FILE_TYPE_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'pptx', label: 'PowerPoint (.pptx)' },
  { value: 'txt', label: 'Text (.txt)' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
];

const LANGUAGE_OPTIONS = [
  { value: 'fa', label: 'فارسی' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

const SORT_OPTIONS: { value: AdvancedSearchFilters['sortBy']; labelKey: string }[] = [
  { value: 'relevance', labelKey: 'sortRelevance' },
  { value: 'date_desc', labelKey: 'sortNewest' },
  { value: 'date_asc', labelKey: 'sortOldest' },
  { value: 'score_desc', labelKey: 'sortScore' },
];
