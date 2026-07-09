'use client';

/**
 * FilterSidebar — Left panel for filtering graph data.
 *
 * Provides search, entity type toggles, relation type toggles,
 * community filters, strength range, and display options.
 *
 * @requires rizzui — Input, Badge, Switch, Text, Title, ActionIcon
 * @requires react-icons/pi — Phosphor icons
 *
 * @example
 * ```tsx
 * <FilterSidebar filter={filter} onFilterChange={setFilter} data={graphData} />
 * ```
 */

import { IconTooltip, Tooltip } from '@/components/tooltip';
import { useCallback, useMemo, useState } from 'react';
import { Input, Badge, Switch, Text, Title, ActionIcon } from 'rizzui';
import {
  PiMagnifyingGlassBold,
  PiXBold,
  PiFunnelBold,
  PiArrowCounterClockwiseBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiInfoBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import {
  getEntityConfig,
  getRelationConfig,
  getCommunityColor,
  ENTITY_TYPE_CONFIG,
  RELATION_TYPE_CONFIG,
} from '@/config/graph-config';

import type {
  GraphData,
  GraphFilter,
  EntityType,
  RelationType,
} from '@/types/graph-explorer.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterSidebarProps {
  filter: GraphFilter;
  onFilterChange: (filter: GraphFilter) => void;
  data: GraphData;
  className?: string;
  /** Extra entity type labels from plugin_graph_explorer_schema (union with graph data). */
  schemaEntityTypes?: string[];
}

// ─── ToggleChip subcomponent ──────────────────────────────────────────────────

function ToggleChip({
  label,
  color,
  active,
  count,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all border',
        active
          ? 'border-transparent text-white shadow-sm'
          : 'border-muted text-gray-500 bg-gray-0 dark:bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-200'
      )}
      style={active ? { backgroundColor: color } : undefined}
    >
      {!active && (
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      )}
      <span className="truncate max-w-[100px]">{label}</span>
      {count !== undefined && (
        <span className={cn('text-[10px] font-mono', active ? 'text-white/80' : 'text-gray-400')}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function FilterSection({
  title,
  count,
  helpText,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  helpText?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-muted pb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {title}
          {count !== undefined && (
            <span className="text-[10px] font-mono text-gray-400">({count})</span>
          )}
          {helpText && (
            <Tooltip content={helpText} placement="right">
              <span className="inline-flex items-center cursor-help">
                <PiInfoBold className="w-3 h-3 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400" />
              </span>
            </Tooltip>
          )}
        </span>
        {isOpen ? (
          <PiCaretUpBold className="w-3 h-3" />
        ) : (
          <PiCaretDownBold className="w-3 h-3" />
        )}
      </button>
      {isOpen && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FilterSidebar({
  filter,
  onFilterChange,
  data,
  className,
  schemaEntityTypes = [],
}: FilterSidebarProps) {
  // ─── Computed data ─────────────────────────────────────────────────────
  const entityTypeCounts = useMemo(() => {
    const counts = new Map<EntityType, number>();
    data.nodes.forEach((n) => {
      counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
    });
    return counts;
  }, [data.nodes]);

  const relationTypeCounts = useMemo(() => {
    const counts = new Map<RelationType, number>();
    data.links.forEach((l) => {
      counts.set(l.relation, (counts.get(l.relation) ?? 0) + 1);
    });
    return counts;
  }, [data.links]);

  const communityCounts = useMemo(() => {
    const counts = new Map<number, number>();
    data.nodes.forEach((n) => {
      if (n.community_id !== null) {
        counts.set(n.community_id, (counts.get(n.community_id) ?? 0) + 1);
      }
    });
    return counts;
  }, [data.nodes]);

  // WHY detect actual range: The slider min/max should adapt to the data's
  // actual strength values instead of using hardcoded 0-10 range.
  const strengthRange = useMemo(() => {
    const strengths = data.links
      .map((l) => l.strength)
      .filter((s) => s !== undefined && s !== null) as number[];
    if (strengths.length === 0) return { min: 0, max: 10, step: 1 };
    const min = Math.floor(Math.min(...strengths));
    const max = Math.ceil(Math.max(...strengths));
    const range = max - min;
    // WHY dynamic step: Use 0.1 for small ranges (0-1), 1 for medium, 10 for large
    const step = range <= 1 ? 0.1 : range <= 20 ? 1 : Math.ceil(range / 20);
    return { min, max, step };
  }, [data.links]);

  const availableEntityTypes = useMemo(() => {
    const types = new Set<EntityType>(entityTypeCounts.keys());
    schemaEntityTypes.forEach((label) => {
      if (label.trim()) types.add(label as EntityType);
    });
    return Array.from(types).sort();
  }, [entityTypeCounts, schemaEntityTypes]);

  const availableRelationTypes = useMemo(
    () => Array.from(relationTypeCounts.keys()).sort(),
    [relationTypeCounts]
  );

  const availableCommunities = useMemo(
    () => Array.from(communityCounts.keys()).sort((a, b) => a - b),
    [communityCounts]
  );

  // ─── Toggle helpers ────────────────────────────────────────────────────
  const toggleEntityType = useCallback(
    (type: EntityType) => {
      const types = new Set(filter.entityTypes);
      if (types.has(type)) types.delete(type);
      else types.add(type);
      onFilterChange({ ...filter, entityTypes: Array.from(types) });
    },
    [filter, onFilterChange]
  );

  const toggleRelationType = useCallback(
    (type: RelationType) => {
      const types = new Set(filter.relationTypes);
      if (types.has(type)) types.delete(type);
      else types.add(type);
      onFilterChange({ ...filter, relationTypes: Array.from(types) });
    },
    [filter, onFilterChange]
  );

  const toggleCommunity = useCallback(
    (communityId: number) => {
      const communities = new Set(filter.communities);
      if (communities.has(communityId)) communities.delete(communityId);
      else communities.add(communityId);
      onFilterChange({ ...filter, communities: Array.from(communities) });
    },
    [filter, onFilterChange]
  );

  const resetFilters = useCallback(() => {
    console.info('[FilterSidebar] Resetting all filters');
    onFilterChange({
      entityTypes: [],
      relationTypes: [],
      communities: [],
      minStrength: 0,
      maxStrength: 10,
      searchQuery: '',
      showIsolated: true,
      highlightPath: false,
      showHiddenNodes: false,
    });
  }, [onFilterChange]);

  const hasActiveFilters =
    filter.entityTypes.length > 0 ||
    filter.relationTypes.length > 0 ||
    filter.communities.length > 0 ||
    filter.searchQuery.trim() !== '' ||
    filter.minStrength > 0 ||
    filter.maxStrength < 10 ||
    !filter.showIsolated;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-gray-0 dark:bg-gray-50 border-r border-muted overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-muted">
        <div className="flex items-center gap-1.5">
          <PiFunnelBold className="w-4 h-4 text-gray-500" />
          <Title as="h6" className="text-xs font-semibold">
            Filters
          </Title>
          {hasActiveFilters && (
            <Badge color="primary" size="sm" className="text-[9px] px-1.5">
              Active
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <IconTooltip content="Reset all" preset="toolbar">
            <ActionIcon variant="text" size="sm" onClick={resetFilters} aria-label="Reset all">
              <PiArrowCounterClockwiseBold className="w-3.5 h-3.5" />
            </ActionIcon>
          </IconTooltip>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Help tip — compact single line with tooltip for details */}
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 px-0.5">
          <Tooltip
            content="Entity/Relation types: OR within section. Sections combined with AND. Empty = show all."
            placement="bottom"
          >
            <span className="flex items-center gap-1 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <PiInfoBold className="w-3 h-3" />
              Filters: OR within type, AND across sections
            </span>
          </Tooltip>
        </div>

        {/* Search */}
        <div className="relative">
          <Input
            placeholder="Search graph (nodes, links, clusters)…"
            value={filter.searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onFilterChange({ ...filter, searchQuery: e.target.value })
            }
            prefix={<PiMagnifyingGlassBold className="w-4 h-4 text-gray-400" />}
            suffix={
              filter.searchQuery ? (
                <button
                  onClick={() => onFilterChange({ ...filter, searchQuery: '' })}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <PiXBold className="w-3.5 h-3.5" />
                </button>
              ) : null
            }
            size="sm"
            className="text-xs"
          />
        </div>

        {/* Entity Types */}
        <FilterSection 
          title="Entity Types" 
          count={availableEntityTypes.length}
          helpText="Select one or more entity types to show only nodes of those types. Leave empty to show all types. Multiple selections work as OR (any selected type will be shown)."
        >
          <div className="flex flex-wrap gap-1.5">
            {availableEntityTypes.map((type) => {
              const cfg = getEntityConfig(type);
              return (
                <ToggleChip
                  key={type}
                  label={cfg.label}
                  color={cfg.color}
                  active={filter.entityTypes.includes(type)}
                  count={entityTypeCounts.get(type)}
                  onClick={() => toggleEntityType(type)}
                />
              );
            })}
          </div>
          {filter.entityTypes.length > 0 && (
            <button
              onClick={() => onFilterChange({ ...filter, entityTypes: [] })}
              className="text-[10px] text-primary mt-1.5 hover:underline"
            >
              Clear selection ({filter.entityTypes.length})
            </button>
          )}
        </FilterSection>

        {/* Relation Types */}
        <FilterSection 
          title="Relation Types" 
          count={availableRelationTypes.length} 
          defaultOpen={false}
          helpText="Select one or more relation types to show only links of those types. Leave empty to show all relations. Multiple selections work as OR (any selected relation will be shown)."
        >
          <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto">
            {availableRelationTypes.map((type) => {
              const cfg = getRelationConfig(type);
              return (
                <ToggleChip
                  key={type}
                  label={cfg.label}
                  color={cfg.color}
                  active={filter.relationTypes.includes(type)}
                  count={relationTypeCounts.get(type)}
                  onClick={() => toggleRelationType(type)}
                />
              );
            })}
          </div>
          {filter.relationTypes.length > 0 && (
            <button
              onClick={() => onFilterChange({ ...filter, relationTypes: [] })}
              className="text-[10px] text-primary mt-1.5 hover:underline"
            >
              Clear selection ({filter.relationTypes.length})
            </button>
          )}
        </FilterSection>

        {/* Communities */}
        {availableCommunities.length > 0 && (
          <FilterSection 
            title="Communities" 
            count={availableCommunities.length} 
            defaultOpen={false}
            helpText="Communities are groups of densely connected nodes detected by algorithms. Select specific clusters to focus on particular sub-networks."
          >
            <div className="flex flex-wrap gap-1.5">
              {availableCommunities.map((id) => (
                <ToggleChip
                  key={id}
                  label={`Cluster ${id}`}
                  color={getCommunityColor(id)}
                  active={filter.communities.includes(id)}
                  count={communityCounts.get(id)}
                  onClick={() => toggleCommunity(id)}
                />
              ))}
            </div>
          </FilterSection>
        )}

        {/* Strength Range */}
        <FilterSection 
          title="Strength Range" 
          defaultOpen={false}
          helpText="Filter links by their strength/weight value. Range is auto-detected from your data. Only links within this range will be shown. Adjust to focus on strong or weak relationships."
        >
          <div className="space-y-3">
            {/* Min Strength */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Text className="text-[10px] text-gray-500">Min Strength</Text>
                <Badge variant="flat" size="sm" className="text-[10px] font-mono px-1.5">
                  {filter.minStrength}
                </Badge>
              </div>
              <input
                type="range"
                min={strengthRange.min}
                max={strengthRange.max}
                step={strengthRange.step}
                value={filter.minStrength}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onFilterChange({
                    ...filter,
                    minStrength: Math.min(val, filter.maxStrength),
                  });
                }}
                className="w-full h-1.5 bg-gray-200 dark:bg-gray-300 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
            {/* Max Strength */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Text className="text-[10px] text-gray-500">Max Strength</Text>
                <Badge variant="flat" size="sm" className="text-[10px] font-mono px-1.5">
                  {filter.maxStrength}
                </Badge>
              </div>
              <input
                type="range"
                min={strengthRange.min}
                max={strengthRange.max}
                step={strengthRange.step}
                value={filter.maxStrength}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onFilterChange({
                    ...filter,
                    maxStrength: Math.max(val, filter.minStrength),
                  });
                }}
                className="w-full h-1.5 bg-gray-200 dark:bg-gray-300 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
            {/* Range summary */}
            <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-muted pt-1.5">
              <span>Data range: {strengthRange.min} – {strengthRange.max}</span>
              <span>
                {filter.minStrength === strengthRange.min && filter.maxStrength === strengthRange.max
                  ? 'All links shown'
                  : `Filtered: ${filter.minStrength} – ${filter.maxStrength}`}
              </span>
            </div>
          </div>
        </FilterSection>

        {/* Options */}
        <FilterSection 
          title="Options" 
          defaultOpen={false}
          helpText="Additional display options. Isolated nodes have no visible links. Hidden nodes are manually hidden via context menu."
        >
          <div className="space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <PiEyeBold className="w-3.5 h-3.5" />
                Show Isolated Nodes
              </span>
              <Switch
                size="sm"
                checked={filter.showIsolated}
                onChange={() =>
                  onFilterChange({ ...filter, showIsolated: !filter.showIsolated })
                }
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <PiEyeSlashBold className="w-3.5 h-3.5" />
                Show Hidden Nodes
              </span>
              <Switch
                size="sm"
                checked={filter.showHiddenNodes}
                onChange={() =>
                  onFilterChange({ ...filter, showHiddenNodes: !filter.showHiddenNodes })
                }
              />
            </label>
          </div>
        </FilterSection>


      </div>
    </div>
  );
}
