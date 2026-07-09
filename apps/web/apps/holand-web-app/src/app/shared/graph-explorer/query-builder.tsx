// ============================================
// QueryBuilder — Visual query builder for graph filtering
// Provides AND/OR/NOT logic groups, nested conditions,
// and query save/load/copy functionality
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, useCallback, useMemo } from 'react';
import { Button, Text, Title, Input, Badge, ActionIcon } from 'rizzui';
import {
  PiPlusBold,
  PiTrashBold,
  PiPlayBold,
  PiXBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiBracketsCurlyBold,
  PiQuestionBold,
  PiCopyBold,
  PiFloppyDiskBold,
  PiFolderOpenBold,
  PiInfoBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

import type { GraphData, GraphNode, GraphLink } from '@/types/graph-explorer.types';

// ==========================================
// Types
// ==========================================

type LogicalOperator = 'AND' | 'OR' | 'NOT';
type ComparisonOperator =
  | 'equals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'exists'
  | 'regex';
type FieldType = 'node' | 'link';

interface QueryCondition {
  id: string;
  fieldType: FieldType;
  field: string;
  operator: ComparisonOperator;
  value: string;
}

interface QueryGroup {
  id: string;
  logicalOperator: LogicalOperator;
  conditions: (QueryCondition | QueryGroup)[];
}

interface SavedQuery {
  id: string;
  name: string;
  query: QueryGroup;
  createdAt: string;
}

// ==========================================
// Field Options
// ==========================================

const NODE_FIELDS = [
  { value: 'label', label: 'Label' },
  { value: 'type', label: 'Type' },
  { value: 'community_id', label: 'Community/Cluster' },
  { value: 'description', label: 'Description' },
  { value: 'connectionCount', label: 'Connection Count' },
];

const LINK_FIELDS = [
  { value: 'relation', label: 'Relation Type' },
  { value: 'strength', label: 'Strength' },
  { value: 'source_label', label: 'Source Label' },
  { value: 'target_label', label: 'Target Label' },
];

const COMPARISON_OPERATORS: { value: ComparisonOperator; label: string; description: string }[] = [
  { value: 'equals', label: '=', description: 'Exactly matches' },
  { value: 'contains', label: 'contains', description: 'Contains text' },
  { value: 'startsWith', label: 'starts with', description: 'Starts with text' },
  { value: 'endsWith', label: 'ends with', description: 'Ends with text' },
  { value: 'gt', label: '>', description: 'Greater than' },
  { value: 'lt', label: '<', description: 'Less than' },
  { value: 'gte', label: '>=', description: 'Greater or equal' },
  { value: 'lte', label: '<=', description: 'Less or equal' },
  { value: 'in', label: 'in', description: 'In list (comma separated)' },
  { value: 'notIn', label: 'not in', description: 'Not in list' },
  { value: 'exists', label: 'exists', description: 'Field exists' },
  { value: 'regex', label: 'regex', description: 'Matches regex pattern' },
];

// ==========================================
// Helper Functions
// ==========================================

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function createEmptyCondition(): QueryCondition {
  return {
    id: generateId(),
    fieldType: 'node',
    field: 'label',
    operator: 'contains',
    value: '',
  };
}

function createEmptyGroup(): QueryGroup {
  return {
    id: generateId(),
    logicalOperator: 'AND',
    conditions: [createEmptyCondition()],
  };
}

// ==========================================
// Query Execution
// ==========================================

/**
 * Evaluate a single condition against a node/link.
 */
function evaluateCondition(
  condition: QueryCondition,
  node: GraphNode,
  link: GraphLink | null,
  graphData: GraphData
): boolean {
  let fieldValue: unknown;

  if (condition.fieldType === 'node') {
    fieldValue = (node as unknown as Record<string, unknown>)[condition.field];
  } else if (link) {
    if (condition.field === 'source_label') {
      const srcId = typeof link.source === 'string' ? link.source : link.source.id;
      const srcNode = graphData.nodes.find((n) => n.id === srcId);
      fieldValue = srcNode?.label;
    } else if (condition.field === 'target_label') {
      const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
      const tgtNode = graphData.nodes.find((n) => n.id === tgtId);
      fieldValue = tgtNode?.label;
    } else {
      fieldValue = (link as unknown as Record<string, unknown>)[condition.field];
    }
  }

  const strValue = String(fieldValue ?? '').toLowerCase();
  const compareValue = condition.value.toLowerCase();
  const numValue = parseFloat(String(fieldValue));
  const numCompare = parseFloat(condition.value);

  switch (condition.operator) {
    case 'equals':
      return strValue === compareValue;
    case 'contains':
      return strValue.includes(compareValue);
    case 'startsWith':
      return strValue.startsWith(compareValue);
    case 'endsWith':
      return strValue.endsWith(compareValue);
    case 'gt':
      return !isNaN(numValue) && !isNaN(numCompare) && numValue > numCompare;
    case 'lt':
      return !isNaN(numValue) && !isNaN(numCompare) && numValue < numCompare;
    case 'gte':
      return !isNaN(numValue) && !isNaN(numCompare) && numValue >= numCompare;
    case 'lte':
      return !isNaN(numValue) && !isNaN(numCompare) && numValue <= numCompare;
    case 'in': {
      const inList = condition.value.split(',').map((v) => v.trim().toLowerCase());
      return inList.includes(strValue);
    }
    case 'notIn': {
      const notInList = condition.value.split(',').map((v) => v.trim().toLowerCase());
      return !notInList.includes(strValue);
    }
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'regex':
      try {
        const regex = new RegExp(condition.value, 'i');
        return regex.test(strValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Evaluate a query group (recursive) against a node/link.
 */
function evaluateGroup(
  group: QueryGroup,
  node: GraphNode,
  link: GraphLink | null,
  graphData: GraphData
): boolean {
  const results = group.conditions.map((cond) => {
    if ('logicalOperator' in cond) {
      return evaluateGroup(cond, node, link, graphData);
    } else {
      return evaluateCondition(cond, node, link, graphData);
    }
  });

  if (group.logicalOperator === 'AND') {
    return results.every((r) => r);
  } else if (group.logicalOperator === 'OR') {
    return results.some((r) => r);
  } else if (group.logicalOperator === 'NOT') {
    return !results[0];
  }

  return false;
}

// ==========================================
// ConditionRow Sub-component
// ==========================================

/**
 * A single filter condition row with field type, field, operator, and value.
 */
function ConditionRow({
  condition,
  onChange,
  onRemove,
  canRemove,
  allEntityTypes,
  allRelationTypes,
}: {
  condition: QueryCondition;
  onChange: (condition: QueryCondition) => void;
  onRemove: () => void;
  canRemove: boolean;
  allEntityTypes: string[];
  allRelationTypes: string[];
}) {
  const fields = condition.fieldType === 'node' ? NODE_FIELDS : LINK_FIELDS;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-muted bg-gray-50 dark:bg-gray-100 p-2">
      {/* Field type: Node or Link */}
      <select
        value={condition.fieldType}
        onChange={(e) =>
          onChange({
            ...condition,
            fieldType: e.target.value as FieldType,
            field: e.target.value === 'node' ? 'label' : 'relation',
          })
        }
        className="h-7 rounded-md border border-muted bg-gray-0 dark:bg-gray-50 px-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-colors"
      >
        <option value="node">Node</option>
        <option value="link">Link</option>
      </select>

      {/* Field selector */}
      <select
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value })}
        className="h-7 w-28 rounded-md border border-muted bg-gray-0 dark:bg-gray-50 px-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-colors"
      >
        {fields.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as ComparisonOperator })}
        className="h-7 w-28 rounded-md border border-muted bg-gray-0 dark:bg-gray-50 px-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-colors"
      >
        {COMPARISON_OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value input */}
      {condition.operator !== 'exists' && (
        <>
          {condition.field === 'type' ? (
            <select
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              className="h-7 flex-1 min-w-[100px] rounded-md border border-muted bg-gray-0 dark:bg-gray-50 px-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-colors"
            >
              <option value="">Select type...</option>
              {allEntityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : condition.field === 'relation' ? (
            <select
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              className="h-7 flex-1 min-w-[100px] rounded-md border border-muted bg-gray-0 dark:bg-gray-50 px-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-colors"
            >
              <option value="">Select relation...</option>
              {allRelationTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={condition.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...condition, value: e.target.value })}
              placeholder="Value..."
              size="sm"
              className="flex-1 min-w-[100px] [&_input]:h-7 [&_input]:text-xs"
            />
          )}
        </>
      )}

      {/* Remove button */}
      {canRemove && (
        <ActionIcon
          variant="text"
          size="sm"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500"
        >
          <PiTrashBold className="h-3 w-3" />
        </ActionIcon>
      )}
    </div>
  );
}

// ==========================================
// QueryGroupComponent Sub-component
// ==========================================

/**
 * A recursive query group with logical operator (AND/OR/NOT) and nested conditions or groups.
 */
function QueryGroupComponent({
  group,
  onChange,
  onRemove,
  depth,
  allEntityTypes,
  allRelationTypes,
}: {
  group: QueryGroup;
  onChange: (group: QueryGroup) => void;
  onRemove?: () => void;
  depth: number;
  allEntityTypes: string[];
  allRelationTypes: string[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  const addCondition = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, createEmptyCondition()],
    });
  };

  const addGroup = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, createEmptyGroup()],
    });
  };

  const updateCondition = (index: number, updated: QueryCondition | QueryGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onChange({ ...group, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onChange({
      ...group,
      conditions: newConditions.length > 0 ? newConditions : [createEmptyCondition()],
    });
  };

  const borderColors = [
    'border-primary/50',
    'border-blue-500/50',
    'border-green-500/50',
    'border-amber-500/50',
  ];

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-2',
        borderColors[depth % borderColors.length],
        depth > 0 && 'ml-4'
      )}
    >
      {/* Group header */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-700"
        >
          {collapsed ? (
            <PiCaretDownBold className="h-4 w-4" />
          ) : (
            <PiCaretUpBold className="h-4 w-4" />
          )}
        </button>

        {/* Logical operator */}
        <select
          value={group.logicalOperator}
          onChange={(e) =>
            onChange({ ...group, logicalOperator: e.target.value as LogicalOperator })
          }
          className="h-7 w-16 rounded-md border border-muted bg-gray-0 dark:bg-gray-50 px-1.5 text-xs font-semibold"
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
          <option value="NOT">NOT</option>
        </select>

        <Text className="text-[10px] text-gray-500">
          {group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''}
        </Text>

        <div className="flex-1" />

        {/* Add condition */}
        <Tooltip content="Add condition" placement="top">
          <ActionIcon variant="text" size="sm" onClick={addCondition}>
            <PiPlusBold className="h-3 w-3" />
          </ActionIcon>
        </Tooltip>

        {/* Add nested group (max depth 3) */}
        {depth < 3 && (
          <Tooltip content="Add nested group" placement="top">
            <ActionIcon variant="text" size="sm" onClick={addGroup}>
              <PiBracketsCurlyBold className="h-3 w-3" />
            </ActionIcon>
          </Tooltip>
        )}

        {/* Remove group */}
        {onRemove && (
          <ActionIcon
            variant="text"
            size="sm"
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500"
          >
            <PiTrashBold className="h-3 w-3" />
          </ActionIcon>
        )}
      </div>

      {/* Conditions list */}
      {!collapsed && (
        <div className="space-y-2">
          {group.conditions.map((cond, index) => (
            <div key={'logicalOperator' in cond ? cond.id : cond.id}>
              {/* Logical operator separator */}
              {index > 0 && (
                <div className="flex items-center justify-center my-1">
                  <span className="text-[10px] font-medium text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-200 rounded">
                    {group.logicalOperator}
                  </span>
                </div>
              )}

              {'logicalOperator' in cond ? (
                <QueryGroupComponent
                  group={cond}
                  onChange={(updated) => updateCondition(index, updated)}
                  onRemove={() => removeCondition(index)}
                  depth={depth + 1}
                  allEntityTypes={allEntityTypes}
                  allRelationTypes={allRelationTypes}
                />
              ) : (
                <ConditionRow
                  condition={cond}
                  onChange={(updated) => updateCondition(index, updated)}
                  onRemove={() => removeCondition(index)}
                  canRemove={group.conditions.length > 1}
                  allEntityTypes={allEntityTypes}
                  allRelationTypes={allRelationTypes}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Main QueryBuilder Component
// ==========================================

interface QueryBuilderProps {
  /** Graph data to query against */
  graphData: GraphData;
  /** Callback when query is applied — returns matched node and link IDs */
  onApplyFilter: (matchedNodeIds: Set<string>, matchedLinkIds: Set<string>) => void;
  /** Optional className */
  className?: string;
}

/**
 * QueryBuilder — Visual query builder for filtering graph nodes and links.
 *
 * Supports AND/OR/NOT logic, nested groups (up to 3 levels),
 * 12 comparison operators, and query save/load/copy.
 *
 * @param graphData - The graph data to query against
 * @param onApplyFilter - Callback with matched node and link ID sets
 *
 * @example
 * ```tsx
 * <QueryBuilder
 *   graphData={data}
 *   onApplyFilter={(nodes, links) => setFilteredIds({ nodes, links })}
 * />
 * ```
 */
export default function QueryBuilder({
  graphData,
  onApplyFilter,
  className,
}: QueryBuilderProps) {
  const [query, setQuery] = useState<QueryGroup>(createEmptyGroup());
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [queryName, setQueryName] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [resultCount, setResultCount] = useState<{ nodes: number; links: number } | null>(null);

  const allEntityTypes = useMemo(() => {
    return Array.from(new Set(graphData.nodes.map((n) => n.type)));
  }, [graphData.nodes]);

  const allRelationTypes = useMemo(() => {
    return Array.from(new Set(graphData.links.map((l) => l.relation)));
  }, [graphData.links]);

  /**
   * Execute query against graph data and return matched IDs.
   */
  const executeQuery = useCallback(() => {
    console.info('[QueryBuilder] Executing query...');
    const matchedNodeIds = new Set<string>();
    const matchedLinkIds = new Set<string>();

    // Evaluate nodes
    graphData.nodes.forEach((node) => {
      if (evaluateGroup(query, node, null, graphData)) {
        matchedNodeIds.add(node.id);
      }
    });

    // Evaluate links
    graphData.links.forEach((link) => {
      const srcId = typeof link.source === 'string' ? link.source : link.source.id;
      const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
      const srcNode = graphData.nodes.find((n) => n.id === srcId);

      // Check if link itself matches
      if (srcNode && evaluateGroup(query, srcNode, link, graphData)) {
        matchedLinkIds.add(link.id);
      }

      // Include link if both endpoint nodes are matched
      if (matchedNodeIds.has(srcId) && matchedNodeIds.has(tgtId)) {
        matchedLinkIds.add(link.id);
      }
    });

    console.info('[QueryBuilder] Query results:', {
      matchedNodes: matchedNodeIds.size,
      matchedLinks: matchedLinkIds.size,
    });

    setResultCount({ nodes: matchedNodeIds.size, links: matchedLinkIds.size });
    onApplyFilter(matchedNodeIds, matchedLinkIds);
  }, [query, graphData, onApplyFilter]);

  const saveQuery = useCallback(() => {
    if (!queryName.trim()) return;
    const newSaved: SavedQuery = {
      id: generateId(),
      name: queryName.trim(),
      query: JSON.parse(JSON.stringify(query)) as QueryGroup,
      createdAt: new Date().toISOString(),
    };
    setSavedQueries((prev) => [...prev, newSaved]);
    setQueryName('');
    console.info('[QueryBuilder] Query saved:', { name: newSaved.name });
  }, [query, queryName]);

  const loadQuery = useCallback((saved: SavedQuery) => {
    setQuery(JSON.parse(JSON.stringify(saved.query)) as QueryGroup);
    setResultCount(null);
    console.info('[QueryBuilder] Query loaded:', { name: saved.name });
  }, []);

  const copyQueryToClipboard = useCallback(() => {
    const queryString = JSON.stringify(query, null, 2);
    navigator.clipboard.writeText(queryString);
    console.info('[QueryBuilder] Query JSON copied to clipboard');
  }, [query]);

  const clearQuery = useCallback(() => {
    setQuery(createEmptyGroup());
    setResultCount(null);
    console.info('[QueryBuilder] Query cleared');
  }, []);

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-50', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-muted">
        <div className="flex items-center gap-2">
          <PiBracketsCurlyBold className="h-4 w-4 text-primary" />
          <Title as="h5" className="text-sm font-semibold">
            Query Builder
          </Title>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content="Help" placement="top">
            <ActionIcon variant="text" size="sm" onClick={() => setShowHelp(!showHelp)}>
              <PiQuestionBold className="h-3.5 w-3.5" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <PiInfoBold className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs space-y-1">
              <Text className="font-medium text-blue-700 dark:text-blue-300">How to use Query Builder:</Text>
              <ul className="space-y-0.5 text-blue-600 dark:text-blue-400 list-disc list-inside">
                <li><strong>AND</strong> — All conditions must match</li>
                <li><strong>OR</strong> — Any condition can match</li>
                <li><strong>NOT</strong> — Negates the first condition</li>
                <li>Use nested groups for complex queries</li>
                <li>Example: <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded text-[10px]">type = person AND community_id = 1</code></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Query Editor */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <QueryGroupComponent
          group={query}
          onChange={setQuery}
          depth={0}
          allEntityTypes={allEntityTypes}
          allRelationTypes={allRelationTypes}
        />
      </div>

      {/* Results */}
      {resultCount !== null && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-950/30 border-t border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>
              Found <strong>{resultCount.nodes}</strong> nodes and <strong>{resultCount.links}</strong> links
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 border-t border-muted space-y-3">
        {/* Execute & Clear */}
        <div className="flex gap-2">
          <Button onClick={executeQuery} size="sm" className="flex-1 flex items-center justify-center gap-1.5">
            <PiPlayBold className="h-3 w-3" />
            Execute Query
          </Button>
          <Button variant="outline" size="sm" onClick={clearQuery}>
            Clear
          </Button>
        </div>

        {/* Save & Copy */}
        <div className="flex gap-2">
          <Input
            value={queryName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQueryName(e.target.value)}
            placeholder="Query name..."
            className="flex-1"
            size="sm"
          />
          <Tooltip content="Save query" placement="top">
            <ActionIcon
              variant="outline"
              size="sm"
              onClick={saveQuery}
              disabled={!queryName.trim()}
            >
              <PiFloppyDiskBold className="h-3.5 w-3.5" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content="Copy query JSON" placement="top">
            <ActionIcon variant="outline" size="sm" onClick={copyQueryToClipboard}>
              <PiCopyBold className="h-3.5 w-3.5" />
            </ActionIcon>
          </Tooltip>
        </div>

        {/* Saved Queries */}
        {savedQueries.length > 0 && (
          <div className="pt-2 border-t border-muted">
            <div className="flex items-center gap-1 mb-1.5">
              <PiFolderOpenBold className="h-3 w-3 text-gray-400" />
              <Text className="text-[10px] text-gray-500">Saved Queries</Text>
            </div>
            <div className="space-y-1 max-h-24 overflow-auto">
              {savedQueries.map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => loadQuery(saved)}
                  className="w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-200 transition-colors truncate text-gray-700 dark:text-gray-300"
                >
                  {saved.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
