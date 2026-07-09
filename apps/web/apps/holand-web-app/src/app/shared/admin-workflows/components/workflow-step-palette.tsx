// ============================================
// WorkflowStepPalette — Collapsible draggable node palette
// Drag nodes from palette to canvas. Supports collapse/expand.
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, type DragEvent } from 'react';
import { Input, Text } from 'rizzui';
import {
  PiPlayCircleBold,
  PiGearBold,
  PiGitBranchBold,
  PiClockBold,
  PiGitMergeBold,
  PiUserCheckBold,
  PiBrainBold,
  PiWrenchBold,
  PiArrowsClockwiseBold,
  PiFlagCheckeredBold,
  PiMagnifyingGlassBold,
  PiArrowLeftBold,
  PiArrowRightBold,
  PiCaretDownBold,
  PiCaretRightBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { STEP_META, PALETTE_CATEGORIES } from '../helpers/step-meta';
import type { WorkflowStepKind } from '@/types/workflow.types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  PiPlayCircleBold,
  PiGearBold,
  PiGitBranchBold,
  PiClockBold,
  PiGitMergeBold,
  PiUserCheckBold,
  PiBrainBold,
  PiWrenchBold,
  PiArrowsClockwiseBold,
  PiFlagCheckeredBold,
};

interface WorkflowStepPaletteProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function WorkflowStepPalette({
  isCollapsed,
  onToggleCollapse,
}: WorkflowStepPaletteProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const toggleCategory = (key: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onDragStart = (event: DragEvent, kind: WorkflowStepKind) => {
    event.dataTransfer.setData('application/workflow-node-kind', kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  const matchesSearch = (kind: WorkflowStepKind) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const meta = STEP_META[kind];
    return (
      kind.toLowerCase().includes(q) ||
      t(meta.label_key).toLowerCase().includes(q) ||
      t(meta.description_key).toLowerCase().includes(q)
    );
  };

  // Collapsed state: thin sidebar with icons only
  if (isCollapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-e border-muted bg-white pt-2 dark:bg-gray-50">
        <Tooltip content={t('workflow.palette.title')} placement="right">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mb-3 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200"
          >
            <PiArrowRightBold className="h-4 w-4" />
          </button>
        </Tooltip>

        <div className="flex-1 space-y-1 overflow-auto px-1">
          {Object.entries(STEP_META).map(([kind, meta]) => {
            const Icon = ICON_MAP[meta.icon] ?? PiGearBold;
            return (
              <Tooltip key={kind} content={t(meta.label_key)} placement="right">
                <div
                  draggable
                  onDragStart={(e) => onDragStart(e, kind as WorkflowStepKind)}
                  className="flex h-8 w-8 cursor-grab items-center justify-center rounded-lg transition-all hover:bg-gray-100 active:cursor-grabbing active:shadow-md dark:hover:bg-gray-200"
                >
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-56 flex-col border-e border-muted bg-white dark:bg-gray-50 lg:w-64">
      {/* Header */}
      <div className="border-b border-muted p-3">
        <div className="mb-2 flex items-center justify-between">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('workflow.palette.title')}
          </Text>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200"
          >
            <PiArrowLeftBold className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="relative">
          <PiMagnifyingGlassBold className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            size="sm"
            placeholder={t('workflow.palette.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
            inputClassName="ps-8 text-xs"
          />
        </div>
        <Text className="mt-2 text-[10px] text-gray-400">
          {t('workflow.palette.dragHint')}
        </Text>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-auto p-2">
        {PALETTE_CATEGORIES.map((cat) => {
          const visibleKinds = cat.kinds.filter(matchesSearch);
          if (visibleKinds.length === 0) return null;
          const isCatCollapsed = collapsedCats.has(cat.key);
          return (
            <div key={cat.key} className="mb-2">
              <button
                type="button"
                onClick={() => toggleCategory(cat.key)}
                className="mb-1 flex w-full items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-600"
              >
                {isCatCollapsed ? (
                  <PiCaretRightBold className="h-2.5 w-2.5" />
                ) : (
                  <PiCaretDownBold className="h-2.5 w-2.5" />
                )}
                {t(cat.label_key)}
                <span className="ms-auto rounded-full bg-gray-100 px-1.5 py-0.5 text-[8px] text-gray-400 dark:bg-gray-200">
                  {visibleKinds.length}
                </span>
              </button>
              {!isCatCollapsed && (
                <div className="space-y-0.5">
                  {visibleKinds.map((kind) => {
                    const meta = STEP_META[kind];
                    const Icon = ICON_MAP[meta.icon] ?? PiGearBold;
                    return (
                      <div
                        key={kind}
                        draggable
                        onDragStart={(e) => onDragStart(e, kind)}
                        className={cn(
                          'flex cursor-grab items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-all',
                          'hover:border-muted hover:bg-gray-50 hover:shadow-sm',
                          'active:cursor-grabbing active:shadow-md',
                          'dark:hover:bg-gray-100'
                        )}
                      >
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: `${meta.color}15` }}
                        >
                          <Icon
                            className="h-3.5 w-3.5"
                            style={{ color: meta.color }}
                          />
                        </div>
                        <div className="min-w-0">
                          <Text className="truncate text-[11px] font-medium text-gray-700 dark:text-gray-300">
                            {t(meta.label_key)}
                          </Text>
                          <Text className="truncate text-[9px] text-gray-400">
                            {t(meta.description_key)}
                          </Text>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
