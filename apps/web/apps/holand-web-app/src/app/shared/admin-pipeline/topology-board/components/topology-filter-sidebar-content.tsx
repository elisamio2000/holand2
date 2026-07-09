'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Checkbox, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import type { TopologyEntityKind } from '../helpers/topology-board-types';
import { activeFilterCount } from '../helpers/display-filter';
import { useTopologyDisplayFilterStore } from '../store/topology-display-filter-store';
import { useTopologyBoardStore } from '../store/topology-board-store';
import {
  SEMANTIC_GROUPS,
  collectToolCategories,
  type SemanticGroupId,
} from '../helpers/semantic-groups';

const ENTITY_KINDS: { kind: TopologyEntityKind; labelKey: string; color: string }[] = [
  { kind: 'tool', labelKey: 'pipeline.topology.kinds.tool', color: 'bg-teal-500' },
  { kind: 'plugin', labelKey: 'pipeline.topology.kinds.plugin', color: 'bg-orange-500' },
  { kind: 'service', labelKey: 'pipeline.topology.kinds.service', color: 'bg-amber-500' },
  { kind: 'route', labelKey: 'pipeline.topology.kinds.route', color: 'bg-purple-500' },
  { kind: 'role', labelKey: 'pipeline.topology.kinds.role', color: 'bg-pink-500' },
  { kind: 'model', labelKey: 'pipeline.topology.kinds.model', color: 'bg-violet-500' },
  { kind: 'endpoint', labelKey: 'pipeline.topology.kinds.endpoint', color: 'bg-blue-500' },
  { kind: 'remoteNode', labelKey: 'pipeline.topology.kinds.remoteNode', color: 'bg-slate-500' },
];

function FilterSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-muted px-3 py-2.5 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </Text>
        {count != null && count > 0 ? (
          <Badge size="sm" variant="flat" className="text-[9px]">
            {count}
          </Badge>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function TopologyFilterSidebarContent() {
  const { t } = useTranslation();
  const filter = useTopologyDisplayFilterStore();
  const patch = useTopologyDisplayFilterStore((s) => s.patch);
  const reset = useTopologyDisplayFilterStore((s) => s.reset);
  const catalog = useTopologyBoardStore((s) => s.catalog);
  const hiddenSet = new Set(filter.hiddenKinds);
  const active = activeFilterCount(filter);

  const toolCategories = useMemo(() => collectToolCategories(catalog), [catalog]);

  const toggleKind = (kind: TopologyEntityKind) => {
    const next = new Set(hiddenSet);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    patch({ hiddenKinds: [...next] });
  };

  const toggleSemantic = (id: SemanticGroupId) => {
    const next = new Set(filter.semanticGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    patch({ semanticGroups: [...next] });
  };

  const toggleCategory = (cat: string) => {
    const next = new Set(filter.toolCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    patch({ toolCategories: [...next] });
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-tour="topology-filter-sidebar">
      <div className="flex items-center justify-between gap-2 border-b border-muted px-3 py-2">
        <div className="min-w-0">
          <Text className="text-xs font-semibold">
            {t('pipeline.topology.board.displayFilter', 'Display filter')}
          </Text>
          <Text className="text-[10px] text-gray-400">
            {t('pipeline.topology.board.filterHint', 'Palette and canvas stay in sync.')}
          </Text>
        </div>
        {active > 0 ? (
          <Button size="sm" variant="text" className="shrink-0 text-[10px]" onClick={reset}>
            {t('common.reset', 'Reset')}
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <FilterSection
          title={t('pipeline.topology.board.semanticGroups', 'Semantic groups')}
          count={filter.semanticGroups.length}
        >
          <div className="flex flex-col gap-1">
            {SEMANTIC_GROUPS.map(({ id, labelKey, fallback, color }) => {
              const on = filter.semanticGroups.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleSemantic(id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition',
                    on
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-muted text-gray-600 hover:border-primary/30 hover:bg-gray-50/80'
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', on ? 'bg-primary' : color)} />
                  {t(labelKey, fallback)}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {toolCategories.length > 0 && (
          <FilterSection
            title={t('pipeline.topology.board.toolCategories', 'Tool categories')}
            count={filter.toolCategories.length}
          >
            <div className="flex flex-wrap gap-1">
              {toolCategories.map((cat) => {
                const on = filter.toolCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      'rounded-md border px-2 py-0.5 font-mono text-[10px] transition',
                      on
                        ? 'border-primary bg-primary text-white'
                        : 'border-muted text-gray-500 hover:border-primary/40'
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </FilterSection>
        )}

        <FilterSection
          title={t('pipeline.topology.board.paletteFilterKinds', 'Entity types')}
          count={filter.hiddenKinds.length}
        >
          <div className="grid grid-cols-1 gap-1">
            {ENTITY_KINDS.map(({ kind, labelKey, color }) => {
              const visible = !hiddenSet.has(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition',
                    visible
                      ? 'border-primary/30 bg-primary/5 text-gray-800'
                      : 'border-muted bg-gray-50/50 text-gray-400 line-through dark:bg-gray-100/5'
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', color, !visible && 'opacity-30')} />
                  {t(labelKey, kind)}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection title={t('pipeline.topology.board.paletteFilterPlacement', 'Placement')}>
          <div className="flex flex-col gap-1">
            {(
              [
                ['all', t('pipeline.topology.filters.all', 'All entities')],
                ['onCanvas', t('pipeline.topology.board.onCanvas', 'On board only')],
                ['catalogOnly', t('pipeline.topology.board.catalogOnly', 'Not on board')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => patch({ placement: key })}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-left text-[11px] transition',
                  filter.placement === key
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-muted text-gray-600 hover:border-primary/30'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title={t('pipeline.topology.board.status', 'Status')}>
          <Checkbox
            label={t('pipeline.topology.board.needsBindingOnly', 'Needs binding only')}
            checked={filter.status === 'needsBinding'}
            onChange={() =>
              patch({ status: filter.status === 'needsBinding' ? 'all' : 'needsBinding' })
            }
            className="text-xs"
          />
        </FilterSection>
      </div>

      {active > 0 && (
        <div className="border-t border-muted bg-primary/5 px-3 py-2">
          <Text className="text-center text-[10px] font-medium text-primary">
            {t('pipeline.topology.board.filterActive', '{{count}} active filters', {
              count: active,
            })}
          </Text>
        </div>
      )}
    </div>
  );
}
