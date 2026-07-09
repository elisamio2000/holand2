'use client';

import { useMemo, useState } from 'react';
import { Input, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { PiCaretDownBold } from 'react-icons/pi';
import type { TopologyEntityKind } from '../helpers/topology-board-types';
import { ENTITY_REGISTRY, PALETTE_CATEGORIES } from '../helpers/entity-registry';
import { useTopologyBoardStore } from '../store/topology-board-store';
import type { EntityCatalogEntry } from '../helpers/topology-catalog';
import type { AddEntityModalConfig } from './add-entity-modal';
import { matchesCatalogFilter } from '../helpers/display-filter';
import { useTopologyDisplayFilterStore } from '../store/topology-display-filter-store';
import {
  SEMANTIC_GROUPS,
  groupCatalogBySemantic,
  resolveCatalogSemanticGroup,
} from '../helpers/semantic-groups';

interface Props {
  onRequestAdd: (config: AddEntityModalConfig, position?: { x: number; y: number }) => void;
}

function PaletteItemRow({
  item,
  disabled,
  onDragStart,
  onRequestAdd,
  pipelineData,
}: {
  item: EntityCatalogEntry;
  disabled: boolean;
  onDragStart: (e: React.DragEvent, kind: TopologyEntityKind, id: string, label: string) => void;
  onRequestAdd: Props['onRequestAdd'];
  pipelineData: ReturnType<typeof useTopologyBoardStore.getState>['pipelineData'];
}) {
  const { t } = useTranslation();
  const meta = ENTITY_REGISTRY[item.kind];
  const semantic = resolveCatalogSemanticGroup(item);
  const semanticMeta = SEMANTIC_GROUPS.find((g) => g.id === semantic);

  const showNeeds =
    item.kind === 'tool' || item.kind === 'plugin' || item.kind === 'service'
      ? !pipelineData ||
        (item.kind === 'tool'
          ? !pipelineData.bindings[item.entityId]?.model
          : item.kind === 'plugin'
            ? !pipelineData.pluginBindings[item.entityId]?.model
            : !pipelineData.serviceBindings.find(
                (s) => `${s.service}/${s.purpose}` === item.entityId
              )?.model_name)
      : false;

  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      onDragStart={(e) => onDragStart(e, item.kind, item.entityId, item.label)}
      onClick={() =>
        !disabled && onRequestAdd({ kind: item.kind, entityId: item.entityId, label: item.label })
      }
      className={cn(
        'mb-0.5 flex w-full items-center gap-1.5 rounded border-l-2 bg-white px-1.5 py-1.5 text-left dark:bg-gray-0',
        meta.borderColor.replace('border-', 'border-l-'),
        disabled
          ? 'cursor-not-allowed opacity-40'
          : 'cursor-grab hover:bg-gray-50 dark:hover:bg-gray-100/50'
      )}
    >
      <span className={cn('shrink-0 text-[8px] font-semibold uppercase', meta.color)}>
        {t(meta.i18nKey, meta.label).slice(0, 4)}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[10px]">{item.label}</span>
      {semanticMeta && item.kind === 'tool' && (
        <span
          className={cn('size-1.5 shrink-0 rounded-full', semanticMeta.color)}
          title={t(semanticMeta.labelKey, semanticMeta.fallback)}
        />
      )}
      {item.sub && (
        <span className="max-w-[4rem] shrink-0 truncate text-[8px] text-gray-400">{item.sub}</span>
      )}
      {showNeeds && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
    </button>
  );
}

export default function TopologyEntityPaletteContent({ onRequestAdd }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const catalog = useTopologyBoardStore((s) => s.catalog);
  const placedNodeIds = useTopologyBoardStore((s) => s.placedNodeIds);
  const pipelineData = useTopologyBoardStore((s) => s.pipelineData);
  const displayFilter = useTopologyDisplayFilterStore();
  const placed = useMemo(() => new Set(placedNodeIds), [placedNodeIds]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: {
      catId: string;
      catLabel: string;
      subGroups?: Array<{ groupId: string; groupLabel: string; items: EntityCatalogEntry[] }>;
      items: EntityCatalogEntry[];
    }[] = [];

    PALETTE_CATEGORIES.forEach((cat) => {
      const items = catalog
        .filter((item) => cat.kinds.includes(item.kind))
        .filter((item) => matchesCatalogFilter(item, displayFilter, placed, pipelineData))
        .filter(
          (item) =>
            !q ||
            item.label.toLowerCase().includes(q) ||
            (item.sub?.toLowerCase().includes(q) ?? false) ||
            (item.category?.toLowerCase().includes(q) ?? false)
        );
      if (items.length === 0) return;

      const hasTools = items.some((i) => i.kind === 'tool');
      if (hasTools && cat.id === 'actions') {
        const subGroups = groupCatalogBySemantic(items.filter((i) => i.kind === 'tool')).map(
          (g) => ({
            groupId: g.groupId,
            groupLabel: t(
              SEMANTIC_GROUPS.find((s) => s.id === g.groupId)?.labelKey ?? '',
              SEMANTIC_GROUPS.find((s) => s.id === g.groupId)?.fallback ?? g.groupId
            ),
            items: g.items,
          })
        );
        const nonTools = items.filter((i) => i.kind !== 'tool');
        rows.push({
          catId: cat.id,
          catLabel: t(cat.labelKey, cat.id),
          subGroups,
          items: nonTools,
        });
      } else {
        rows.push({
          catId: cat.id,
          catLabel: t(cat.labelKey, cat.id),
          items,
        });
      }
    });
    return rows;
  }, [catalog, query, displayFilter, placed, pipelineData, t]);

  const totalVisible = filteredItems.reduce(
    (n, r) =>
      n +
      r.items.length +
      (r.subGroups?.reduce((sn, sg) => sn + sg.items.length, 0) ?? 0),
    0
  );

  const onDragStart = (
    e: React.DragEvent,
    kind: TopologyEntityKind,
    id: string,
    label: string
  ) => {
    e.dataTransfer.setData('application/topology-entity-kind', kind);
    e.dataTransfer.setData('application/topology-entity-id', id);
    e.dataTransfer.setData('application/topology-entity-label', label);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-tour="topology-palette">
      <div className="border-b border-muted px-2 py-1.5">
        <Input
          size="sm"
          className="w-full text-xs"
          placeholder={t('pipeline.topology.board.searchNodes', 'Search…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filteredItems.map(({ catId, catLabel, subGroups, items }) => {
          const collapsed = collapsedCats[catId];
          const count =
            items.length + (subGroups?.reduce((n, sg) => n + sg.items.length, 0) ?? 0);
          return (
            <div key={catId} className="mb-2">
              <button
                type="button"
                className="mb-1 flex w-full items-center gap-1 text-[10px] font-semibold uppercase text-gray-500"
                onClick={() => setCollapsedCats((p) => ({ ...p, [catId]: !p[catId] }))}
              >
                <PiCaretDownBold
                  className={cn('size-3 transition', collapsed && '-rotate-90')}
                />
                {catLabel}
                <span className="ms-auto rounded bg-gray-100 px-1 text-[9px] dark:bg-gray-200/20">
                  {count}
                </span>
              </button>
              {!collapsed && (
                <>
                  {subGroups?.map((sg) => {
                    const sgKey = `${catId}:${sg.groupId}`;
                    const sgCollapsed = collapsedCats[sgKey];
                    return (
                      <div key={sgKey} className="mb-1 ms-2">
                        <button
                          type="button"
                          className="mb-0.5 flex w-full items-center gap-1 text-[9px] font-medium text-gray-400"
                          onClick={() =>
                            setCollapsedCats((p) => ({ ...p, [sgKey]: !p[sgKey] }))
                          }
                        >
                          <PiCaretDownBold
                            className={cn('size-2.5 transition', sgCollapsed && '-rotate-90')}
                          />
                          {sg.groupLabel}
                          <span className="ms-auto text-[8px]">{sg.items.length}</span>
                        </button>
                        {!sgCollapsed &&
                          sg.items.map((item) => (
                            <PaletteItemRow
                              key={item.nodeId}
                              item={item}
                              disabled={placed.has(item.nodeId)}
                              onDragStart={onDragStart}
                              onRequestAdd={onRequestAdd}
                              pipelineData={pipelineData}
                            />
                          ))}
                      </div>
                    );
                  })}
                  {items.map((item) => (
                    <PaletteItemRow
                      key={item.nodeId}
                      item={item}
                      disabled={placed.has(item.nodeId)}
                      onDragStart={onDragStart}
                      onRequestAdd={onRequestAdd}
                      pipelineData={pipelineData}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
        {totalVisible === 0 && (
          <Text className="p-4 text-center text-xs text-gray-400">
            {t('pipeline.topology.board.paletteEmpty', 'No entities match your filter.')}
          </Text>
        )}
      </div>
    </div>
  );
}
