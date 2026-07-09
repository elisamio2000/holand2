// ============================================
// GraphDataProcessor — Pre-visualization processing step
// Allows users to inspect, select, filter and configure
// graph data before visualization with tabbed interface
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, useCallback, useMemo, useRef, useEffect, Fragment } from 'react';
import toast from 'react-hot-toast';
import { Button, Text, Title, Input, Badge, Checkbox, ActionIcon, Select } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  PiCheckCircleBold,
  PiWarningCircleBold,
  PiXBold,
  PiPlusBold,
  PiTrashBold,
  PiArrowRightBold,
  PiFunnelBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiGraphBold,
  PiTableBold,
  PiArrowsLeftRightBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiMagnifyingGlassBold,
  PiArrowLeftBold,
  PiInfoBold,
  PiPencilSimpleBold,
  PiCheckBold,
  PiArrowCounterClockwiseBold,
  PiTagBold,
  PiArrowsSplitBold,
  PiLightningBold,
  PiMicrophoneBold,
  PiFileTextBold,
  PiCodeBold,
  PiArrowsMergeBold,
  PiCopyBold,
  PiNotePencilBold,
  PiStarBold,
  PiStarFill,
  PiBookOpenBold,
  PiLinkSimpleBold,
  PiDatabaseBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import IndeterminateCheckbox from '@core/components/table/indeterminate-checkbox';
import { getEntityConfig, getRelationConfig, ENTITY_TYPE_CONFIG } from '@/config/graph-config';
import { loadProcessorDraft, saveProcessorDraft, clearProcessorDraft } from './graph-session';
import type { GraphData, GraphNode, GraphLink, EntityType, RelationType } from '@/types/graph-explorer.types';

// ==========================================
// Types
// ==========================================

export type ProcessorTab = 'entities' | 'relationships' | 'filters' | 'transform';
type ClassificationMode = 'authentic' | 'typed';

type FilterTarget = 'nodes' | 'links';

type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'regex'
  | 'greater_than'
  | 'less_than'
  | 'exists'
  | 'not_exists';

interface FilterRule {
  id: string;
  target: FilterTarget;
  field: string;
  operator: FilterOperator;
  value: string;
  enabled: boolean;
}

// ─── Transform Rules ────────────────────────────────────────────────────────

type TransformRuleType = 'retype' | 'replace_label' | 'split';
type PreviewSectionKey = 'summary' | 'changes' | 'sample';

/**
 * A data transformation rule applied to rawData before manual editing.
 * Enables bulk pattern-based mutations (retype, rename, split).
 */
interface TransformRule {
  id: string;
  type: TransformRuleType;
  enabled: boolean;
  /** Regex/text pattern for matching entity labels */
  pattern?: string;
  /** Regex flags for pattern matching (default: 'gi') */
  patternFlags?: string;
  /** For retype: the new entity type to assign */
  newType?: string;
  /** For replace_label: text or regex pattern to find */
  findText?: string;
  /** For replace_label: replacement string (empty = delete) */
  replaceText?: string;
  /** For replace_label: treat findText as regex */
  useRegex?: boolean;
  /** For split: delimiter string (e.g., '.', ',') */
  delimiter?: string;
}

// ─── Portable preprocessing recipe (replay on any case graph) ────────────────

export const PREPROCESS_RECIPE_KIND = 'graphExplorer.preprocessRecipe' as const;

export const PREPROCESS_SNAPSHOT_KIND = 'graphExplorer.preprocessSnapshot' as const;

export type PreprocessRecipeStep =
  | { type: 'clear_exclusions' }
  | { type: 'set_exclude_isolated'; value: boolean }
  | { type: 'exclude_entity_types'; types: string[] }
  | { type: 'include_entity_types'; types: string[] }
  | { type: 'exclude_relation_types'; relations: string[] }
  | { type: 'include_relation_types'; relations: string[] }
  | { type: 'set_filter_rules'; rules: FilterRule[] }
  | { type: 'set_transform_rules'; rules: TransformRule[] };

/** Apply a semantic recipe starting from zero exclusions/rules (recommended for portability). */
function applyPreprocessRecipeSteps(
  steps: PreprocessRecipeStep[],
  nodes: GraphNode[],
  links: GraphLink[],
  resolveNodeType: (n: GraphNode) => string,
  resolveRelationType: (l: GraphLink) => string
): {
  excludedNodeIds: Set<string>;
  excludedLinkIds: Set<string>;
  excludeIsolatedNodes: boolean;
  filterRules: FilterRule[];
  transformRules: TransformRule[];
} {
  const excludedNodeIds = new Set<string>();
  const excludedLinkIds = new Set<string>();
  let excludeIsolatedNodes = false;
  let filterRules: FilterRule[] = [];
  let transformRules: TransformRule[] = [];

  for (const step of steps) {
    switch (step.type) {
      case 'clear_exclusions':
        excludedNodeIds.clear();
        excludedLinkIds.clear();
        break;
      case 'set_exclude_isolated':
        excludeIsolatedNodes = Boolean(step.value);
        break;
      case 'exclude_entity_types':
        for (const n of nodes) {
          if (step.types.includes(resolveNodeType(n))) excludedNodeIds.add(n.id);
        }
        break;
      case 'include_entity_types':
        for (const n of nodes) {
          if (step.types.includes(resolveNodeType(n))) excludedNodeIds.delete(n.id);
        }
        break;
      case 'exclude_relation_types':
        for (const l of links) {
          if (step.relations.includes(resolveRelationType(l))) excludedLinkIds.add(l.id);
        }
        break;
      case 'include_relation_types':
        for (const l of links) {
          if (step.relations.includes(resolveRelationType(l))) excludedLinkIds.delete(l.id);
        }
        break;
      case 'set_filter_rules':
        filterRules = step.rules.map((r) => ({ ...r }));
        break;
      case 'set_transform_rules':
        transformRules = step.rules.map((r) => ({ ...r }));
        break;
      default:
        break;
    }
  }

  return {
    excludedNodeIds,
    excludedLinkIds,
    excludeIsolatedNodes,
    filterRules,
    transformRules,
  };
}

/** Overrides applied to a node's fields before visualization */
interface NodeOverride {
  label?: string;
  type?: string;
  description?: string;
}

/** Overrides applied to a link's fields before visualization */
interface LinkOverride {
  relation?: string;
  label?: string;
}

// ─── Annotation ─────────────────────────────────────────────────────────────

/** Custom annotation attached to a node by the user (tags, notes, importance) */
interface NodeAnnotation {
  tags: string[];
  /** Importance level: 0 = unset, 1–5 stars */
  importance: number;
  notes: string;
}

/** A detected pair of potentially-duplicate entities (based on label similarity) */
interface DuplicatePair {
  nodeAId: string;
  nodeBId: string;
  /** Jaccard bigram similarity score: 0.0–1.0 */
  similarity: number;
  reason: string;
}

/** State shape for the Add-Relation form in the Relationships tab */
interface AddRelationForm {
  sourceId: string;
  targetId: string;
  relation: string;
  description: string;
  strength: number;
}

const ENTITY_TYPE_ALIAS_MAP: Record<string, string> = {
  emailaddress: 'email',
  email_address: 'email',
  phonenumber: 'phone_number',
  phone_number: 'phone_number',
  financialentity: 'financial_entity',
  financial_entity: 'financial_entity',
  organisation: 'organization',
  company: 'organization',
};

function normalizeTypedEntityType(value: unknown): string {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!raw) return 'unknown';
  return ENTITY_TYPE_ALIAS_MAP[raw] ?? raw;
}

function normalizeTypedRelation(value: unknown): string {
  const raw = String(value ?? '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
  return raw || 'UNSPECIFIED';
}

// ==========================================
// Constants
// ==========================================

/** All supported entity types with display labels, derived from config */
const ENTITY_TYPE_OPTIONS: { value: string; label: string }[] = Object.entries(
  ENTITY_TYPE_CONFIG
).map(([value, cfg]) => ({ value, label: cfg.label }));

/** Relation type options for edit dropdown — { value, label } format */
const RELATION_TYPE_OPTIONS = [
  'KNOWS', 'WORKS_WITH', 'WORKS_AT', 'FIRED', 'OWNS', 'LOCATED_AT',
  'RELATED_TO', 'TRANSACTION', 'COMMUNICATED_WITH', 'MEMBER_OF', 'CONTROLS',
  'FOUNDER_OF', 'MENTORS', 'MANAGES', 'PRODUCES', 'HAS_CONTACT', 'HAS_PHONE',
  'HAS_EMAIL', 'LEADS', 'LED_BY', 'PARTICIPATES_IN', 'INVESTED_IN',
  'RECEIVED', 'PARTNERED_WITH', 'SIGNED', 'PROVIDES', 'ATTENDS',
  'SPEAKS_AT', 'HOSTS', 'RAISED', 'COLLABORATES_WITH', 'INTERESTED_IN',
].map((v) => ({
  value: v,
  label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

// ==========================================
// Props
// ==========================================

interface GraphDataProcessorProps {
  /** Raw graph data from source */
  rawData: GraphData;
  /** Callback when processed data is ready */
  onProcessed: (data: GraphData) => void;
  /** Callback to go back to data source selection */
  onBack: () => void;
  /** Source label for display */
  sourceLabel: string;
  /** Optional className */
  className?: string;
  /** Pre-select a tab on first render */
  defaultTab?: ProcessorTab;
  /** Called when the user switches tabs (used for URL-based navigation) */
  onTabChange?: (tab: ProcessorTab) => void;
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Apply a single filter rule to a record.
 */
function applyFilter(record: Record<string, unknown>, rule: FilterRule): boolean {
  if (!rule.enabled) return true;
  const fieldValue = record[rule.field];
  const ruleValue = rule.value;

  switch (rule.operator) {
    case 'equals':
      return String(fieldValue) === ruleValue;
    case 'not_equals':
      return String(fieldValue) !== ruleValue;
    case 'contains':
      return String(fieldValue).toLowerCase().includes(ruleValue.toLowerCase());
    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(ruleValue.toLowerCase());
    case 'regex':
      try {
        return new RegExp(ruleValue, 'i').test(String(fieldValue));
      } catch {
        return false;
      }
    case 'greater_than':
      return Number(fieldValue) > Number(ruleValue);
    case 'less_than':
      return Number(fieldValue) < Number(ruleValue);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'not_exists':
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
    default:
      return true;
  }
}

function collectPropertyKeyStats(items: Array<Record<string, unknown>>): Array<[string, number]> {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    Object.keys(item).forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
    const props = item.properties;
    if (props && typeof props === 'object' && !Array.isArray(props)) {
      Object.keys(props as Record<string, unknown>).forEach((k) =>
        counts.set(`properties.${k}`, (counts.get(`properties.${k}`) ?? 0) + 1)
      );
    }
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

// ==========================================
// Transform Engine
// ==========================================

/**
 * Apply a list of transform rules to raw graph nodes and links.
 * Rules are applied sequentially in the order they appear.
 * Split rules can create new nodes and redistribute their links.
 *
 * @param data - Source nodes and links
 * @param rules - Transform rules (only enabled ones are applied)
 * @returns New nodes and links array after all transformations
 */
function applyTransformRules(
  data: { nodes: GraphNode[]; links: GraphLink[] },
  rules: TransformRule[]
): { nodes: GraphNode[]; links: GraphLink[] } {
  let nodes = [...data.nodes];
  let links = [...data.links];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case 'retype': {
        if (!rule.pattern || !rule.newType) break;
        try {
          const re = new RegExp(rule.pattern, rule.patternFlags ?? 'i');
          nodes = nodes.map((n) =>
            re.test(n.label) ? { ...n, type: rule.newType as EntityType } : n
          );
        } catch {
          // invalid regex — skip silently
        }
        break;
      }
      case 'replace_label': {
        if (!rule.findText) break;
        if (rule.useRegex) {
          try {
            const re = new RegExp(rule.findText, 'gi');
            nodes = nodes.map((n) => ({
              ...n,
              label: n.label.replace(re, rule.replaceText ?? ''),
            }));
          } catch {
            // invalid regex — skip silently
          }
        } else {
          nodes = nodes.map((n) => ({
            ...n,
            label: n.label.split(rule.findText!).join(rule.replaceText ?? ''),
          }));
        }
        break;
      }
      case 'split': {
        if (!rule.delimiter) break;
        const delim = rule.delimiter;
        const splitMap = new Map<string, string[]>();
        const newNodes: GraphNode[] = [];

        nodes.forEach((n) => {
          if (n.label.includes(delim)) {
            const parts = n.label
              .split(delim)
              .map((p) => p.trim())
              .filter(Boolean);
            if (parts.length >= 2) {
              // Replace original node with N split nodes
              const ids = parts.map((part, i) => {
                const newId = `${n.id}__s${i}`;
                newNodes.push({ ...n, id: newId, label: part });
                return newId;
              });
              splitMap.set(n.id, ids);
              return;
            }
          }
          newNodes.push(n);
        });

        // Redistribute links for split nodes — one link per combination
        const newLinks: GraphLink[] = [];
        links.forEach((l) => {
          const srcId = typeof l.source === 'string' ? l.source : l.source.id;
          const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
          const srcSplits = splitMap.get(srcId);
          const tgtSplits = splitMap.get(tgtId);

          if (!srcSplits && !tgtSplits) {
            newLinks.push(l);
          } else {
            const srcIds = srcSplits ?? [srcId];
            const tgtIds = tgtSplits ?? [tgtId];
            srcIds.forEach((s) => {
              tgtIds.forEach((t) => {
                if (s !== t) {
                  newLinks.push({
                    ...l,
                    id: `${l.id}__${s}__${t}`,
                    source: s,
                    target: t,
                  });
                }
              });
            });
          }
        });

        nodes = newNodes;
        links = newLinks;
        break;
      }
    }
  }

  return { nodes, links };
}

// ==========================================
// Sub-components
// ==========================================

/**
 * Tab button for processor sections.
 */
function TabButton({
  label,
  icon,
  active,
  badge,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: string | number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 whitespace-nowrap',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <Badge
          size="sm"
          variant={active ? 'flat' : 'outline'}
          color={active ? 'primary' : undefined}
          className="text-[10px] px-1.5 ml-0.5"
        >
          {badge}
        </Badge>
      )}
    </button>
  );
}

/**
 * Sortable column header for data table.
 */
function SortHeader({
  label,
  sortKey,
  currentSort,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: { key: string; dir: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
}) {
  const isActive = currentSort?.key === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors uppercase tracking-wider"
    >
      {label}
      {isActive &&
        (currentSort?.dir === 'asc' ? (
          <PiCaretUpBold className="w-3 h-3" />
        ) : (
          <PiCaretDownBold className="w-3 h-3" />
        ))}
    </button>
  );
}

// ==========================================
// Main Component
// ==========================================

/**
 * GraphDataProcessor — Pre-visualization data processing step.
 *
 * Provides a 3-tab interface:
 * 1. Entities — Table of all nodes with checkboxes to include/exclude
 * 2. Relationships — Table of all links with checkboxes to include/exclude
 * 3. Filters — Advanced rule-based filtering
 *
 * Users can review their data, select what to include, and apply
 * transformations before sending to the graph visualization.
 *
 * @param rawData - Original graph data from source
 * @param onProcessed - Callback with processed/filtered data
 * @param onBack - Callback to return to source selection
 * @param sourceLabel - Display label for data source
 *
 * @example
 * ```tsx
 * <GraphDataProcessor
 *   rawData={graphData}
 *   onProcessed={(filtered) => setGraphData(filtered)}
 *   onBack={() => setGraphData(null)}
 *   sourceLabel="File: data.json"
 * />
 * ```
 */
export default function GraphDataProcessor({
  rawData,
  onProcessed,
  onBack,
  sourceLabel,
  className,
  defaultTab,
  onTabChange,
}: GraphDataProcessorProps) {
  const { t } = useTranslation();
  const gt = useCallback(
    (key: string, defaultValue: string, options?: Record<string, unknown>) =>
      t(key, { defaultValue, ...(options ?? {}) }),
    [t]
  );
  // --- State ----------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<ProcessorTab>(defaultTab ?? 'entities');

  // Navigate tab + notify parent (for URL sync)
  const handleTabClick = (tab: ProcessorTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };
  const [excludedNodeIds, setExcludedNodeIds] = useState<Set<string>>(new Set());
  const [excludedLinkIds, setExcludedLinkIds] = useState<Set<string>>(new Set());
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [entitySearch, setEntitySearch] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [excludeIsolatedNodes, setExcludeIsolatedNodes] = useState(false);
  const [entitySort, setEntitySort] = useState<{
    key: string;
    dir: 'asc' | 'desc';
  } | null>(null);
  const [linkSort, setLinkSort] = useState<{
    key: string;
    dir: 'asc' | 'desc';
  } | null>(null);

  // --- Transform rules state -----------------------------------------------
  /** Data transformation rules applied before manual editing */
  const [transformRules, setTransformRules] = useState<TransformRule[]>([]);

  // --- Editing state --------------------------------------------------------
  /** Inline overrides: label, type, description for nodes */
  const [nodeOverrides, setNodeOverrides] = useState<Map<string, NodeOverride>>(new Map());
  /** Inline overrides: relation type for links */
  const [linkOverrides, setLinkOverrides] = useState<Map<string, LinkOverride>>(new Map());
  /** Currently active inline-edit cell: { id, field } */
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  /** Temp value for the currently editing cell */
  const [editingValue, setEditingValue] = useState('');
  /** Ref for the inline edit input to auto-focus */
  const editInputRef = useRef<HTMLInputElement>(null);

  // --- Layout state: split editor/preview workspace ------------------------
  const [showEditPanel, setShowEditPanel] = useState(true);
  const [showPreviewPanel, setShowPreviewPanel] = useState(true);
  const [previewWidthPercent, setPreviewWidthPercent] = useState(36);
  const [isWideLayout, setIsWideLayout] = useState(false);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // --- Preview section visibility ------------------------------------------
  const [previewSections, setPreviewSections] = useState<Record<PreviewSectionKey, boolean>>({
    summary: true,
    changes: true,
    sample: true,
  });

  // --- Transform add-rule menu state ---------------------------------------
  const [isTransformMenuOpen, setIsTransformMenuOpen] = useState(false);
  const transformMenuRef = useRef<HTMLDivElement>(null);
  const [showRegexGuide, setShowRegexGuide] = useState(false);
  const [recipeRecording, setRecipeRecording] = useState(false);
  const [showConfigDocs, setShowConfigDocs] = useState(false);
  const recipeRecordingRef = useRef(false);
  const recordedRecipeStepsRef = useRef<PreprocessRecipeStep[]>([]);
  const configFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [didRestoreDraft, setDidRestoreDraft] = useState(false);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  // --- Merge entities state ------------------------------------------------
  /** Whether merge-select mode is active in the Entities tab */
  const [mergeMode, setMergeMode] = useState(false);
  /** IDs of nodes selected for the pending merge */
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  /** Controls the merge config dialog visibility */
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  /** Config for the pending merge: final label, type, and which node ID to keep */
  const [mergeConfig, setMergeConfig] = useState<{
    targetLabel: string;
    targetType: string;
    keepNodeId: string;
  }>({ targetLabel: '', targetType: 'person', keepNodeId: '' });

  // --- Manual relations state ----------------------------------------------
  /** Links added manually by the user (not from rawData) */
  const [manualLinks, setManualLinks] = useState<GraphLink[]>([]);
  /** Whether the Add-Relation form panel is visible */
  const [showAddRelationForm, setShowAddRelationForm] = useState(false);
  /** State of the Add-Relation form inputs */
  const [newRelationForm, setNewRelationForm] = useState<AddRelationForm>({
    sourceId: '',
    targetId: '',
    relation: 'KNOWS',
    description: '',
    strength: 5,
  });

  // --- Duplicate detection state -------------------------------------------
  /** Detected pairs of potentially duplicate nodes */
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  /** Whether the duplicates panel is visible */
  const [showDuplicatesPanel, setShowDuplicatesPanel] = useState(false);

  // --- Annotations (tags, notes, importance) -------------------------------
  /** Map of nodeId → annotation data written by the user */
  const [annotations, setAnnotations] = useState<Map<string, NodeAnnotation>>(new Map());
  /** The node ID whose annotation row is currently expanded (one at a time) */
  const [expandedAnnotationId, setExpandedAnnotationId] = useState<string | null>(null);
  /** authentic: raw source classification, typed: edited/overridden classification */
  const [classificationMode, setClassificationMode] = useState<ClassificationMode>('authentic');
  const [entityTypeSearchQuery, setEntityTypeSearchQuery] = useState('');
  const [relationTypeSearchQuery, setRelationTypeSearchQuery] = useState('');
  const [nodeKeySearchQuery, setNodeKeySearchQuery] = useState('');
  const [relKeySearchQuery, setRelKeySearchQuery] = useState('');
  const [entityTypeVisibleCount, setEntityTypeVisibleCount] = useState(18);
  const [relationTypeVisibleCount, setRelationTypeVisibleCount] = useState(24);
  const [nodeKeyVisibleCount, setNodeKeyVisibleCount] = useState(16);
  const [relKeyVisibleCount, setRelKeyVisibleCount] = useState(16);
  const [showOnlyTypedChanges, setShowOnlyTypedChanges] = useState(false);

  // --- Computed: data after transform rules (before exclusions/overrides) --

  /**
   * Applies transform rules to rawData to produce the base dataset.
   * The entities table shows these nodes/links, not rawData directly.
   */
  const transformedBaseData = useMemo(
    () => applyTransformRules(rawData, transformRules),
    [rawData, transformRules]
  );
  const relationTypeOptions = useMemo(() => {
    const dynamic = transformedBaseData.links
      .map((l) => String(l.relation).trim())
      .filter(Boolean);
    const merged = [
      ...RELATION_TYPE_OPTIONS.map((o) => String(o.value)),
      ...dynamic,
    ];
    return Array.from(new Set(merged)).map((v) => ({
      value: v,
      label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  }, [transformedBaseData.links]);
  const rawSignature = useMemo(
    () => `nodes:${rawData.nodes.length}|links:${rawData.links.length}`,
    [rawData.nodes.length, rawData.links.length]
  );

  // --- Computed: display nodes (search + sort) ------------------------------

  const typedDiffDetails = useMemo(() => {
    const changedNodeIds = new Set<string>();
    const changedRelationIds = new Set<string>();
    for (const n of transformedBaseData.nodes) {
      const originType = String(n.type ?? 'unknown').trim().toLowerCase();
      const typedType = normalizeTypedEntityType(
        nodeOverrides.get(n.id)?.type ??
          n.properties?.extractedEntityType ??
          n.properties?.type ??
          n.type
      );
      if (typedType !== originType) changedNodeIds.add(n.id);
    }
    for (const l of transformedBaseData.links) {
      const originRel = String(l.relation ?? 'UNSPECIFIED')
        .trim()
        .replace(/[\s-]+/g, '_')
        .toUpperCase();
      const typedRel = normalizeTypedRelation(
        linkOverrides.get(l.id)?.relation ?? l.properties?.relation ?? l.properties?.type ?? l.relation
      );
      if (typedRel !== originRel) changedRelationIds.add(l.id);
    }
    return {
      changedNodeIds,
      changedRelationIds,
      reclassifiedNodes: changedNodeIds.size,
      reclassifiedRelations: changedRelationIds.size,
    };
  }, [transformedBaseData.nodes, transformedBaseData.links, nodeOverrides, linkOverrides]);

  const displayNodes = useMemo(() => {
    let nodes = [...transformedBaseData.nodes];
    if (entitySearch.trim()) {
      const q = entitySearch.toLowerCase();
      nodes = nodes.filter((n) => {
        const ov = nodeOverrides.get(n.id);
        const label = (ov?.label ?? n.label).toLowerCase();
        const type = (ov?.type ?? n.type).toLowerCase();
        return (
          label.includes(q) ||
          type.includes(q) ||
          n.id.toLowerCase().includes(q) ||
          (n.description && n.description.toLowerCase().includes(q))
        );
      });
    }
    if (entitySort) {
      nodes.sort((a, b) => {
        const aVal = String((a as unknown as Record<string, unknown>)[entitySort.key] ?? '');
        const bVal = String((b as unknown as Record<string, unknown>)[entitySort.key] ?? '');
        return entitySort.dir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      });
    }
    if (classificationMode === 'typed' && showOnlyTypedChanges) {
      nodes = nodes.filter((n) => typedDiffDetails.changedNodeIds.has(n.id));
    }
    return nodes;
  }, [
    transformedBaseData.nodes,
    entitySearch,
    entitySort,
    nodeOverrides,
    classificationMode,
    showOnlyTypedChanges,
    typedDiffDetails.changedNodeIds,
  ]);

  // --- Computed: display links (search + sort) ------------------------------

  const displayLinks = useMemo(() => {
    let links = [...transformedBaseData.links];
    if (linkSearch.trim()) {
      const q = linkSearch.toLowerCase();
      links = links.filter(
        (l) =>
          l.relation.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q) ||
          String(l.source).toLowerCase().includes(q) ||
          String(l.target).toLowerCase().includes(q)
      );
    }
    if (linkSort) {
      links.sort((a, b) => {
        const aVal = String((a as unknown as Record<string, unknown>)[linkSort.key] ?? '');
        const bVal = String((b as unknown as Record<string, unknown>)[linkSort.key] ?? '');
        return linkSort.dir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      });
    }
    if (classificationMode === 'typed' && showOnlyTypedChanges) {
      links = links.filter((l) => typedDiffDetails.changedRelationIds.has(l.id));
    }
    return links;
  }, [
    transformedBaseData.links,
    linkSearch,
    linkSort,
    classificationMode,
    showOnlyTypedChanges,
    typedDiffDetails.changedRelationIds,
  ]);

  // --- Computed: processed data after exclusions + filters ------------------

  const processedData = useMemo<GraphData>(() => {
    const nodeRules = filterRules.filter((r) => r.target === 'nodes' && r.enabled);
    const linkRules = filterRules.filter((r) => r.target === 'links' && r.enabled);

    // WHY: use transformedBaseData instead of rawData so transform rules
    // are applied before exclusions, filters, and manual overrides.
    let filteredNodes = transformedBaseData.nodes.filter((n) => !excludedNodeIds.has(n.id));
    if (nodeRules.length > 0) {
      filteredNodes = filteredNodes.filter((node) =>
        nodeRules.every((rule) =>
          applyFilter(node as unknown as Record<string, unknown>, rule)
        )
      );
    }

    // Apply node overrides (label, type, description edits)
    const nodesWithOverrides: GraphNode[] = filteredNodes.map((n) => {
      const ov = nodeOverrides.get(n.id);
      if (!ov) return n;
      return { ...n, ...(ov as Partial<GraphNode>) };
    });

    const validNodeIds = new Set(nodesWithOverrides.map((n) => n.id));

    const aliasToId = new Map<string, string>();
    const addAlias = (alias: unknown, id: string) => {
      if (alias == null) return;
      const s = String(alias).trim();
      if (!s) return;
      if (!aliasToId.has(s)) aliasToId.set(s, id);
    };
    nodesWithOverrides.forEach((n) => {
      addAlias(n.id, n.id);
      addAlias(n.label, n.id);
      addAlias(n.properties?.id, n.id);
      addAlias(n.properties?.name, n.id);
      addAlias(n.properties?.label, n.id);
      addAlias(n.properties?.elementKey, n.id);
      addAlias((n.properties as Record<string, unknown> | undefined)?.uuid, n.id);
    });
    const resolveEndpoint = (ep: string | GraphNode): string => {
      const raw = typeof ep === 'string' ? ep : ep.id ?? ep.label ?? '';
      if (validNodeIds.has(raw)) return raw;
      const mapped = aliasToId.get(String(raw).trim());
      return mapped && validNodeIds.has(mapped) ? mapped : raw;
    };

    const normalizedLinks = transformedBaseData.links.map((l) => {
      const resolvedSource = resolveEndpoint(l.source);
      const resolvedTarget = resolveEndpoint(l.target);
      return {
        ...l,
        source: resolvedSource,
        target: resolvedTarget,
      };
    });

    let filteredLinks = normalizedLinks.filter((l) => !excludedLinkIds.has(l.id));
    if (linkRules.length > 0) {
      filteredLinks = filteredLinks.filter((link) =>
        linkRules.every((rule) =>
          applyFilter(link as unknown as Record<string, unknown>, rule)
        )
      );
    }

    // Apply link overrides (relation type edits)
    const linksWithOverrides: GraphLink[] = filteredLinks.map((l) => {
      const ov = linkOverrides.get(l.id);
      if (!ov) return l;
      return { ...l, ...(ov as Partial<GraphLink>) };
    });

    // Include manual links whose both endpoints exist in the filtered node set
    const validManualLinks = manualLinks.filter(
      (l) =>
        !excludedLinkIds.has(l.id) &&
        validNodeIds.has(l.source as string) &&
        validNodeIds.has(l.target as string)
    );

    let finalNodes = nodesWithOverrides;
    let finalLinks = [...linksWithOverrides, ...validManualLinks];

    if (excludeIsolatedNodes) {
      const connectedNodeIds = new Set<string>();
      finalLinks.forEach((l) => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        connectedNodeIds.add(s);
        connectedNodeIds.add(t);
      });
      finalNodes = finalNodes.filter((n) => connectedNodeIds.has(n.id));
      const allowed = new Set(finalNodes.map((n) => n.id));
      finalLinks = finalLinks.filter((l) => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        return allowed.has(s) && allowed.has(t);
      });
    }

    return {
      nodes: finalNodes,
      links: finalLinks,
      communities: rawData.communities ?? [],
      community_reports: rawData.community_reports ?? [],
      stats: {
        ...rawData.stats,
        entity_count: finalNodes.length,
        relationship_count: finalLinks.length,
        community_count: rawData.communities?.length ?? rawData.stats?.community_count ?? 0,
        report_count: rawData.community_reports?.length ?? rawData.stats?.report_count ?? 0,
      },
      extraction_meta: rawData.extraction_meta,
    };
  }, [filterRules, transformedBaseData.nodes, transformedBaseData.links, manualLinks, excludeIsolatedNodes, rawData.communities, rawData.community_reports, rawData.stats, rawData.extraction_meta, excludedNodeIds, nodeOverrides, excludedLinkIds, linkOverrides]);

  useEffect(() => {
    const transformedRelationTypes = new Set(
      transformedBaseData.links.map((l) => String(l.relation || 'RELATED_TO'))
    ).size;
    const processedRelationTypes = new Set(
      processedData.links.map((l) => String(l.relation || 'RELATED_TO'))
    ).size;
    console.info('[GraphProcessor] Stage counts:', {
      transformedNodes: transformedBaseData.nodes.length,
      transformedLinks: transformedBaseData.links.length,
      transformedRelationTypes,
      processedNodes: processedData.nodes.length,
      processedLinks: processedData.links.length,
      processedRelationTypes,
      excludeIsolatedNodes,
      excludedNodeIds: excludedNodeIds.size,
      excludedLinkIds: excludedLinkIds.size,
    });
  }, [
    transformedBaseData.nodes.length,
    transformedBaseData.links,
    processedData.nodes.length,
    processedData.links,
    excludeIsolatedNodes,
    excludedNodeIds.size,
    excludedLinkIds.size,
  ]);

  // --- Computed: entity/relation classification helpers ----------------------
  const resolveNodeType = useCallback(
    (n: GraphNode): string => {
      if (classificationMode === 'typed') {
        const ov = nodeOverrides.get(n.id);
        const candidate =
          ov?.type ??
          n.properties?.extractedEntityType ??
          n.properties?.type ??
          n.type;
        return normalizeTypedEntityType(candidate);
      }
      return String(n.type ?? 'unknown');
    },
    [classificationMode, nodeOverrides]
  );

  const resolveRelationType = useCallback(
    (l: GraphLink): string => {
      if (classificationMode === 'typed') {
        const ov = linkOverrides.get(l.id);
        const candidate = ov?.relation ?? l.properties?.relation ?? l.properties?.type ?? l.relation;
        return normalizeTypedRelation(candidate);
      }
      return String(l.relation ?? 'UNSPECIFIED');
    },
    [classificationMode, linkOverrides]
  );

  useEffect(() => {
    recipeRecordingRef.current = recipeRecording;
  }, [recipeRecording]);

  const appendRecipeStep = useCallback((step: PreprocessRecipeStep) => {
    if (!recipeRecordingRef.current) return;
    recordedRecipeStepsRef.current.push(step);
  }, []);

  const pushRecipeSnapshotDedup = useCallback((step: PreprocessRecipeStep) => {
    if (!recipeRecordingRef.current) return;
    const last = recordedRecipeStepsRef.current.at(-1);
    if (last && JSON.stringify(last) === JSON.stringify(step)) return;
    recordedRecipeStepsRef.current.push(step);
  }, []);

  useEffect(() => {
    if (!recipeRecording) return undefined;
    const id = window.setTimeout(() => {
      if (!recipeRecordingRef.current) return;
      pushRecipeSnapshotDedup({
        type: 'set_filter_rules',
        rules: filterRules.map((r) => ({ ...r })),
      });
    }, 850);
    return () => window.clearTimeout(id);
  }, [filterRules, recipeRecording, pushRecipeSnapshotDedup]);

  useEffect(() => {
    if (!recipeRecording) return undefined;
    const id = window.setTimeout(() => {
      if (!recipeRecordingRef.current) return;
      pushRecipeSnapshotDedup({
        type: 'set_transform_rules',
        rules: transformRules.map((r) => ({ ...r })),
      });
    }, 850);
    return () => window.clearTimeout(id);
  }, [transformRules, recipeRecording, pushRecipeSnapshotDedup]);

  // --- Computed: entity type summary -----------------------------------------
  const entityTypeStats = useMemo(() => {
    const counts = new Map<string, { total: number; included: number }>();
    transformedBaseData.nodes.forEach((n) => {
      const effectiveType = resolveNodeType(n);
      const prev = counts.get(effectiveType) ?? { total: 0, included: 0 };
      prev.total++;
      if (!excludedNodeIds.has(n.id)) prev.included++;
      counts.set(effectiveType, prev);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [transformedBaseData.nodes, excludedNodeIds, resolveNodeType]);

  // --- Computed: relation type summary --------------------------------------

  const relationTypeStats = useMemo(() => {
    const counts = new Map<string, { total: number; included: number }>();
    transformedBaseData.links.forEach((l) => {
      const effectiveRelation = resolveRelationType(l);
      const prev = counts.get(effectiveRelation) ?? { total: 0, included: 0 };
      prev.total++;
      if (!excludedLinkIds.has(l.id)) prev.included++;
      counts.set(effectiveRelation, prev);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [transformedBaseData.links, excludedLinkIds, resolveRelationType]);

  const originDataStats = useMemo(() => {
    const rawNodeItems = rawData.nodes as unknown as Array<Record<string, unknown>>;
    const rawLinkItems = rawData.links as unknown as Array<Record<string, unknown>>;
    const nodeKeyStats = collectPropertyKeyStats(rawNodeItems);
    const linkKeyStats = collectPropertyKeyStats(rawLinkItems);
    const unspecifiedRelations = rawData.links.filter((l) => {
      const rel = String(l.relation ?? '').trim().toUpperCase();
      return !rel || rel === 'UNSPECIFIED';
    }).length;
    const unknownEntityTypes = rawData.nodes.filter((n) => {
      const t = String(n.type ?? '').trim().toLowerCase();
      return !t || t === 'unknown';
    }).length;
    return {
      nodeKeyStats,
      linkKeyStats,
      unspecifiedRelations,
      unknownEntityTypes,
      communities: rawData.communities?.length ?? 0,
      communityReports: rawData.community_reports?.length ?? 0,
      extractionModel: rawData.extraction_meta?.model ?? '',
      extractionSource: rawData.extraction_meta?.classification_source ?? '',
    };
  }, [rawData]);

  const filteredEntityTypeStats = useMemo(() => {
    const q = entityTypeSearchQuery.trim().toLowerCase();
    if (!q) return entityTypeStats;
    return entityTypeStats.filter(([type]) => {
      const cfg = getEntityConfig(type);
      return type.toLowerCase().includes(q) || cfg.label.toLowerCase().includes(q);
    });
  }, [entityTypeStats, entityTypeSearchQuery]);

  const filteredRelationTypeStats = useMemo(() => {
    const q = relationTypeSearchQuery.trim().toLowerCase();
    if (!q) return relationTypeStats;
    return relationTypeStats.filter(([rel]) => {
      const cfg = getRelationConfig(rel);
      return rel.toLowerCase().includes(q) || cfg.label.toLowerCase().includes(q);
    });
  }, [relationTypeStats, relationTypeSearchQuery]);

  const filteredNodeKeyStats = useMemo(() => {
    const q = nodeKeySearchQuery.trim().toLowerCase();
    if (!q) return originDataStats.nodeKeyStats;
    return originDataStats.nodeKeyStats.filter(([k]) => k.toLowerCase().includes(q));
  }, [originDataStats.nodeKeyStats, nodeKeySearchQuery]);

  const filteredRelKeyStats = useMemo(() => {
    const q = relKeySearchQuery.trim().toLowerCase();
    if (!q) return originDataStats.linkKeyStats;
    return originDataStats.linkKeyStats.filter(([k]) => k.toLowerCase().includes(q));
  }, [originDataStats.linkKeyStats, relKeySearchQuery]);

  const typedDiffStats = typedDiffDetails;

  const applyTypedInference = useCallback(() => {
    let changedNodes = 0;
    let changedLinks = 0;

    setNodeOverrides((prev) => {
      const next = new Map(prev);
      transformedBaseData.nodes.forEach((n) => {
        const inferred = normalizeTypedEntityType(
          n.properties?.extractedEntityType ?? n.properties?.type ?? n.type
        );
        const current = normalizeTypedEntityType(next.get(n.id)?.type ?? n.type);
        if (inferred !== current) {
          next.set(n.id, { ...(next.get(n.id) ?? {}), type: inferred });
          changedNodes += 1;
        }
      });
      return next;
    });

    setLinkOverrides((prev) => {
      const next = new Map(prev);
      transformedBaseData.links.forEach((l) => {
        const inferred = normalizeTypedRelation(
          l.properties?.relation ?? l.properties?.type ?? l.relation
        );
        const current = normalizeTypedRelation(next.get(l.id)?.relation ?? l.relation);
        if (inferred !== current) {
          next.set(l.id, { ...(next.get(l.id) ?? {}), relation: inferred });
          changedLinks += 1;
        }
      });
      return next;
    });

    toast.success(
      gt(
        'graphExplorer.processor.toast.typedInferenceApplied',
        'Typed inference applied: {{nodes}} nodes, {{relations}} relations',
        { nodes: changedNodes, relations: changedLinks }
      )
    );
  }, [gt, transformedBaseData.nodes, transformedBaseData.links]);

  // --- Helpers: resolve node label from ID ----------------------------------

  const getNodeLabel = useCallback(
    (idOrObj: string | GraphNode): string => {
      const id = typeof idOrObj === 'string' ? idOrObj : idOrObj.id;
      const node = transformedBaseData.nodes.find((n) => n.id === id);
      // Also check override label
      const ov = nodeOverrides.get(id);
      return ov?.label ?? node?.label ?? id;
    },
    [transformedBaseData.nodes, nodeOverrides]
  );

  // --- Callbacks: inline editing -------------------------------------------

  /**
   * Start inline editing for a specific cell.
   * Stops row-level click propagation (toggleNodeExclusion).
   */
  const startEdit = useCallback(
    (e: React.MouseEvent, id: string, field: string, currentValue: string) => {
      e.stopPropagation();
      setEditingCell({ id, field });
      setEditingValue(currentValue);
      // Auto-focus handled via the input's autoFocus prop
    },
    []
  );

  /**
   * Commit the current edit value to node or link overrides.
   */
  const commitEdit = useCallback(
    (isNode: boolean) => {
      if (!editingCell) return;
      const value = editingValue.trim();
      if (isNode) {
        setNodeOverrides((prev) => {
          const next = new Map(prev);
          const existing = next.get(editingCell.id) ?? {};
          next.set(editingCell.id, { ...existing, [editingCell.field]: value });
          return next;
        });
      } else {
        setLinkOverrides((prev) => {
          const next = new Map(prev);
          const existing = next.get(editingCell.id) ?? {};
          next.set(editingCell.id, { ...existing, [editingCell.field]: value });
          return next;
        });
      }
      setEditingCell(null);
      setEditingValue('');
    },
    [editingCell, editingValue]
  );

  /** Cancel editing without saving */
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditingValue('');
  }, []);

  /** Remove all overrides for a specific node */
  const resetNodeOverride = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setNodeOverrides((prev) => {
      const next = new Map(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  /** Remove all overrides for a specific link */
  const resetLinkOverride = useCallback((e: React.MouseEvent, linkId: string) => {
    e.stopPropagation();
    setLinkOverrides((prev) => {
      const next = new Map(prev);
      next.delete(linkId);
      return next;
    });
  }, []);

  // --- Merge entities callbacks --------------------------------------------

  /**
   * Toggle a node's selection in merge-select mode.
   *
   * @param nodeId - The node to toggle in/out of selectedForMerge
   */
  const toggleMergeSelection = useCallback((nodeId: string) => {
    setSelectedForMerge((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  /**
   * Open the merge config dialog after selecting 2+ nodes.
   * Pre-fills label/type from the first selected node.
   */
  const openMergeDialog = useCallback(() => {
    if (selectedForMerge.size < 2) {
      toast.error(gt('graphExplorer.processor.toast.selectAtLeastTwoToMerge', 'Select at least 2 entities to merge'));
      return;
    }
    const firstId = Array.from(selectedForMerge)[0];
    const firstNode = transformedBaseData.nodes.find((n) => n.id === firstId);
    const firstOv = nodeOverrides.get(firstId);
    setMergeConfig({
      targetLabel: firstOv?.label ?? firstNode?.label ?? '',
      targetType: firstOv?.type ?? firstNode?.type ?? 'person',
      keepNodeId: firstId,
    });
    setShowMergeDialog(true);
  }, [selectedForMerge, transformedBaseData.nodes, nodeOverrides, gt]);

  /**
   * Execute merge: collapse all selectedForMerge nodes into the keepNodeId.
   * Redirects existing links from eliminated nodes to the kept node via manualLinks,
   * then excludes the eliminated nodes.
   *
   * @endpoint N/A — purely local operation
   */
  const handleMergeEntities = useCallback(() => {
    if (selectedForMerge.size < 2) return;
    console.info('[GraphDataProcessor] Merging entities:', {
      selected: Array.from(selectedForMerge),
      keepId: mergeConfig.keepNodeId,
      label: mergeConfig.targetLabel,
    });

    const keepId = mergeConfig.keepNodeId || Array.from(selectedForMerge)[0];
    const eliminatedIds = new Set(Array.from(selectedForMerge).filter((id) => id !== keepId));

    // Apply final label/type to the kept node
    setNodeOverrides((prev) => {
      const next = new Map(prev);
      next.set(keepId, {
        ...(next.get(keepId) ?? {}),
        label: mergeConfig.targetLabel,
        type: mergeConfig.targetType,
      });
      return next;
    });

    // Redirect links from eliminated nodes to the kept node
    // WHY: we add redirect copies via manualLinks rather than mutating rawData
    const redirected: GraphLink[] = [];
    eliminatedIds.forEach((elimId) => {
      transformedBaseData.links.forEach((l) => {
        const src = typeof l.source === 'string' ? l.source : l.source.id;
        const tgt = typeof l.target === 'string' ? l.target : l.target.id;
        if (src === elimId || tgt === elimId) {
          const newSrc = src === elimId ? keepId : src;
          const newTgt = tgt === elimId ? keepId : tgt;
          if (newSrc !== newTgt) {
            redirected.push({
              ...l,
              id: `${l.id}_merge_${keepId}`,
              source: newSrc,
              target: newTgt,
            });
          }
        }
      });
    });
    if (redirected.length > 0) {
      setManualLinks((prev) => [...prev, ...redirected]);
    }

    // Exclude the eliminated nodes
    setExcludedNodeIds((prev) => {
      const next = new Set(prev);
      eliminatedIds.forEach((id) => next.add(id));
      return next;
    });

    setShowMergeDialog(false);
    setMergeMode(false);
    setSelectedForMerge(new Set());
    toast.success(
      `Merged ${selectedForMerge.size} entities into "${mergeConfig.targetLabel}"`
    );
    console.info('[GraphDataProcessor] Merge complete:', {
      keepId,
      eliminated: Array.from(eliminatedIds),
      redirectedLinks: redirected.length,
    });
  }, [selectedForMerge, mergeConfig, transformedBaseData.links]);

  // --- Manual relation callbacks -------------------------------------------

  /**
   * Submit the Add-Relation form: validates inputs and creates a new manual GraphLink.
   *
   * @endpoint N/A — local operation, appended to manualLinks
   */
  const handleAddManualLink = useCallback(() => {
    const { sourceId, targetId, relation, description, strength } = newRelationForm;
    if (!sourceId || !targetId) {
      toast.error(gt('graphExplorer.processor.toast.selectSourceAndTarget', 'Please select both source and target entities'));
      return;
    }
    if (sourceId === targetId) {
      toast.error(gt('graphExplorer.processor.toast.sourceTargetDifferent', 'Source and target must be different entities'));
      return;
    }
    console.info('[GraphDataProcessor] Adding manual link:', { sourceId, targetId, relation });
    const newLink: GraphLink = {
      id: `manual_${Date.now()}`,
      source: sourceId,
      target: targetId,
      relation: relation as RelationType,
      description: description || '',
      strength,
      case_id: '',
      artifact_id: '',
      origin: 'manual',
    };
    setManualLinks((prev) => [...prev, newLink]);
    setNewRelationForm({ sourceId: '', targetId: '', relation: 'KNOWS', description: '', strength: 5 });
    setShowAddRelationForm(false);
    toast.success(gt('graphExplorer.processor.toast.manualRelationshipAdded', 'Manual relationship added'));
  }, [gt, newRelationForm]);

  /**
   * Remove a manually-added link by its ID.
   *
   * @param linkId - The id of the manual link to remove
   */
  const handleRemoveManualLink = useCallback((linkId: string) => {
    console.info('[GraphDataProcessor] Removing manual link:', { linkId });
    setManualLinks((prev) => prev.filter((l) => l.id !== linkId));
    toast.success(gt('graphExplorer.processor.toast.manualRelationshipRemoved', 'Manual relationship removed'));
  }, [gt]);

  // --- Duplicate detection callbacks ---------------------------------------

  /**
   * Scan all nodes for likely duplicates using Jaccard bigram similarity on labels.
   * Only compares nodes of the same type. Threshold: ≥ 0.6 similarity.
   *
   * @endpoint N/A — local computation only
   */
  const detectDuplicates = useCallback(() => {
    console.info('[GraphDataProcessor] Running duplicate detection...');
    const nodes = transformedBaseData.nodes;

    const bigrams = (s: string): Set<string> => {
      const lower = s.toLowerCase().replace(/\s+/g, ' ').trim();
      const bg = new Set<string>();
      for (let i = 0; i < lower.length - 1; i++) bg.add(lower.slice(i, i + 2));
      return bg;
    };
    const jaccardSimilarity = (a: Set<string>, b: Set<string>): number => {
      if (a.size === 0 && b.size === 0) return 1;
      let inter = 0;
      a.forEach((v) => { if (b.has(v)) inter++; });
      return inter / (a.size + b.size - inter);
    };

    const found: DuplicatePair[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const ovA = nodeOverrides.get(a.id);
        const ovB = nodeOverrides.get(b.id);
        const labelA = ovA?.label ?? a.label;
        const labelB = ovB?.label ?? b.label;
        const typeA = ovA?.type ?? a.type;
        const typeB = ovB?.type ?? b.type;
        // Only compare nodes of the same type to reduce false positives
        if (typeA !== typeB) continue;
        const sim = jaccardSimilarity(bigrams(labelA), bigrams(labelB));
        if (sim >= 0.6) {
          found.push({
            nodeAId: a.id,
            nodeBId: b.id,
            similarity: Math.round(sim * 100) / 100,
            reason: sim >= 0.9 ? 'Nearly identical labels' : 'Similar labels',
          });
        }
      }
    }

    setDuplicates(found);
    setShowDuplicatesPanel(true);
    console.info('[GraphDataProcessor] Duplicate detection complete:', { count: found.length });
    if (found.length === 0) toast.success(gt('graphExplorer.processor.toast.noDuplicatesDetected', 'No duplicates detected'));
    else
      toast(
        gt('graphExplorer.processor.toast.duplicatesFound', 'Found {{count}} potential duplicate(s)', {
          count: found.length,
        }),
        { icon: '⚠️' }
      );
  }, [transformedBaseData.nodes, gt, nodeOverrides]);

  /** Dismiss a duplicate pair from the detection results */
  const dismissDuplicate = useCallback((nodeAId: string, nodeBId: string) => {
    setDuplicates((prev) =>
      prev.filter((d) => !(d.nodeAId === nodeAId && d.nodeBId === nodeBId))
    );
  }, []);

  /**
   * Quick-merge a duplicate pair: keep nodeA, eliminate nodeB,
   * redirect nodeB's links to nodeA via manualLinks.
   *
   * @param pair - The DuplicatePair to merge
   */
  const mergeDuplicatePair = useCallback(
    (pair: DuplicatePair) => {
      const keepId = pair.nodeAId;
      const elimId = pair.nodeBId;
      const keepNode = transformedBaseData.nodes.find((n) => n.id === keepId);
      const keepOv = nodeOverrides.get(keepId);
      const redirected: GraphLink[] = [];
      transformedBaseData.links.forEach((l) => {
        const src = typeof l.source === 'string' ? l.source : l.source.id;
        const tgt = typeof l.target === 'string' ? l.target : l.target.id;
        if (src === elimId || tgt === elimId) {
          const newSrc = src === elimId ? keepId : src;
          const newTgt = tgt === elimId ? keepId : tgt;
          if (newSrc !== newTgt) {
            redirected.push({ ...l, id: `${l.id}_dup_${keepId}`, source: newSrc, target: newTgt });
          }
        }
      });
      if (redirected.length > 0) setManualLinks((prev) => [...prev, ...redirected]);
      setExcludedNodeIds((prev) => { const next = new Set(prev); next.add(elimId); return next; });
      dismissDuplicate(pair.nodeAId, pair.nodeBId);
      const label = keepOv?.label ?? keepNode?.label ?? keepId;
      toast.success(
        gt('graphExplorer.processor.toast.mergedDuplicateInto', 'Merged duplicate into "{{label}}"', {
          label,
        })
      );
      console.info('[GraphDataProcessor] Duplicate pair merged:', { keepId, elimId });
    },
   [transformedBaseData.nodes, transformedBaseData.links, nodeOverrides, dismissDuplicate, gt]
  );

  // --- Annotation callbacks ------------------------------------------------

  /**
   * Update or create annotation data (tags, importance, notes) for a node.
   *
   * @param nodeId - Target node's ID
   * @param patch  - Partial annotation fields to apply
   */
  const updateAnnotation = useCallback((nodeId: string, patch: Partial<NodeAnnotation>) => {
    setAnnotations((prev) => {
      const next = new Map(prev);
      const existing = next.get(nodeId) ?? { tags: [], importance: 0, notes: '' };
      next.set(nodeId, { ...existing, ...patch });
      return next;
    });
  }, []);

  /** Toggle the annotation expansion row for a specific node */
  const toggleAnnotationRow = useCallback((nodeId: string) => {
    setExpandedAnnotationId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  /**
   * Bulk-change entity type for all currently visible (non-excluded) nodes.
   * Useful when user filtered to 'unknown' type and wants to reclassify.
   */
  const bulkChangeType = useCallback(
    (newType: string) => {
      if (!newType) return;
      const targets = displayNodes.filter((n) => !excludedNodeIds.has(n.id));
      setNodeOverrides((prev) => {
        const next = new Map(prev);
        targets.forEach((n) => {
          next.set(n.id, { ...(next.get(n.id) ?? {}), type: newType });
        });
        return next;
      });
      console.info('[GraphProcessor] Bulk type change:', {
        type: newType,
        count: targets.length,
      });
      toast.success(
        gt(
          'graphExplorer.processor.toast.changedTypeForEntities',
          'Changed type to "{{type}}" for {{count}} entities',
          { type: newType, count: targets.length }
        )
      );
    },
   [displayNodes, excludedNodeIds, gt]
  );

  /** Total number of pending overrides (for display in header badge) */
  const totalOverrides = nodeOverrides.size + linkOverrides.size;

  // --- Callbacks: entity selection ------------------------------------------

  const toggleNodeExclusion = useCallback((nodeId: string) => {
    setExcludedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  /** Header “select all” — if all visible are included → exclude them; otherwise include all visible (fixes mixed-selection UX). */
  const toggleAllNodes = useCallback(
    (displayed: GraphNode[]) => {
      if (displayed.length === 0) return;
      const allIncluded = displayed.every((n) => !excludedNodeIds.has(n.id));
      setExcludedNodeIds((prev) => {
        const next = new Set(prev);
        if (allIncluded) {
          displayed.forEach((n) => next.add(n.id));
        } else {
          displayed.forEach((n) => next.delete(n.id));
        }
        return next;
      });
    },
    [excludedNodeIds]
  );

  const includeAllDisplayedNodes = useCallback((displayed: GraphNode[]) => {
    if (displayed.length === 0) return;
    setExcludedNodeIds((prev) => {
      const next = new Set(prev);
      displayed.forEach((n) => next.delete(n.id));
      return next;
    });
  }, []);

  const excludeAllDisplayedNodes = useCallback((displayed: GraphNode[]) => {
    if (displayed.length === 0) return;
    setExcludedNodeIds((prev) => {
      const next = new Set(prev);
      displayed.forEach((n) => next.add(n.id));
      return next;
    });
  }, []);

  const excludeByType = useCallback(
    (type: string) => {
      setExcludedNodeIds((prev) => {
        const next = new Set(prev);
        transformedBaseData.nodes.filter((n) => {
          return resolveNodeType(n) === type;
        }).forEach((n) => next.add(n.id));
        return next;
      });
      appendRecipeStep({ type: 'exclude_entity_types', types: [type] });
    },
    [transformedBaseData.nodes, resolveNodeType, appendRecipeStep]
  );

  const includeByType = useCallback(
    (type: string) => {
      setExcludedNodeIds((prev) => {
        const next = new Set(prev);
        transformedBaseData.nodes.filter((n) => {
          return resolveNodeType(n) === type;
        }).forEach((n) => next.delete(n.id));
        return next;
      });
      appendRecipeStep({ type: 'include_entity_types', types: [type] });
    },
    [transformedBaseData.nodes, resolveNodeType, appendRecipeStep]
  );

  // --- Callbacks: link selection --------------------------------------------

  const toggleLinkExclusion = useCallback((linkId: string) => {
    setExcludedLinkIds((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) next.delete(linkId);
      else next.add(linkId);
      return next;
    });
  }, []);

  const toggleAllLinks = useCallback(
    (displayed: GraphLink[]) => {
      if (displayed.length === 0) return;
      const allIncluded = displayed.every((l) => !excludedLinkIds.has(l.id));
      setExcludedLinkIds((prev) => {
        const next = new Set(prev);
        if (allIncluded) {
          displayed.forEach((l) => next.add(l.id));
        } else {
          displayed.forEach((l) => next.delete(l.id));
        }
        return next;
      });
    },
    [excludedLinkIds]
  );

  const includeAllDisplayedLinks = useCallback((displayed: GraphLink[]) => {
    if (displayed.length === 0) return;
    setExcludedLinkIds((prev) => {
      const next = new Set(prev);
      displayed.forEach((l) => next.delete(l.id));
      return next;
    });
  }, []);

  const excludeAllDisplayedLinks = useCallback((displayed: GraphLink[]) => {
    if (displayed.length === 0) return;
    setExcludedLinkIds((prev) => {
      const next = new Set(prev);
      displayed.forEach((l) => next.add(l.id));
      return next;
    });
  }, []);

  const excludeByRelation = useCallback(
    (relation: string) => {
      setExcludedLinkIds((prev) => {
        const next = new Set(prev);
        transformedBaseData.links
          .filter((l) => resolveRelationType(l) === relation)
          .forEach((l) => next.add(l.id));
        return next;
      });
      appendRecipeStep({ type: 'exclude_relation_types', relations: [relation] });
    },
    [transformedBaseData.links, resolveRelationType, appendRecipeStep]
  );

  const includeByRelation = useCallback(
    (relation: string) => {
      setExcludedLinkIds((prev) => {
        const next = new Set(prev);
        transformedBaseData.links
          .filter((l) => resolveRelationType(l) === relation)
          .forEach((l) => next.delete(l.id));
        return next;
      });
      appendRecipeStep({ type: 'include_relation_types', relations: [relation] });
    },
    [transformedBaseData.links, resolveRelationType, appendRecipeStep]
  );

  /** Every distinct entity type in the current dataset → include all matching nodes (same as toggling every chip on). */
  const includeAllEntityTypeChips = useCallback(() => {
    if (transformedBaseData.nodes.length === 0) return;
    setExcludedNodeIds((prev) => {
      const next = new Set(prev);
      transformedBaseData.nodes.forEach((n) => next.delete(n.id));
      return next;
    });
    const types = Array.from(
      new Set(transformedBaseData.nodes.map((n) => resolveNodeType(n)))
    );
    if (types.length > 0) appendRecipeStep({ type: 'include_entity_types', types });
  }, [transformedBaseData.nodes, resolveNodeType, appendRecipeStep]);

  const excludeAllEntityTypeChips = useCallback(() => {
    if (transformedBaseData.nodes.length === 0) return;
    setExcludedNodeIds((prev) => {
      const next = new Set(prev);
      transformedBaseData.nodes.forEach((n) => next.add(n.id));
      return next;
    });
    const types = Array.from(
      new Set(transformedBaseData.nodes.map((n) => resolveNodeType(n)))
    );
    if (types.length > 0) appendRecipeStep({ type: 'exclude_entity_types', types });
  }, [transformedBaseData.nodes, resolveNodeType, appendRecipeStep]);

  const includeAllRelationTypeChips = useCallback(() => {
    if (transformedBaseData.links.length === 0) return;
    setExcludedLinkIds((prev) => {
      const next = new Set(prev);
      transformedBaseData.links.forEach((l) => next.delete(l.id));
      return next;
    });
    const relations = Array.from(
      new Set(transformedBaseData.links.map((l) => resolveRelationType(l)))
    );
    if (relations.length > 0) {
      appendRecipeStep({ type: 'include_relation_types', relations });
    }
  }, [transformedBaseData.links, resolveRelationType, appendRecipeStep]);

  const excludeAllRelationTypeChips = useCallback(() => {
    if (transformedBaseData.links.length === 0) return;
    setExcludedLinkIds((prev) => {
      const next = new Set(prev);
      transformedBaseData.links.forEach((l) => next.add(l.id));
      return next;
    });
    const relations = Array.from(
      new Set(transformedBaseData.links.map((l) => resolveRelationType(l)))
    );
    if (relations.length > 0) {
      appendRecipeStep({ type: 'exclude_relation_types', relations });
    }
  }, [transformedBaseData.links, resolveRelationType, appendRecipeStep]);

  // --- Callbacks: sort ------------------------------------------------------

  const handleEntitySort = useCallback((key: string) => {
    setEntitySort((prev) => {
      if (prev?.key === key) {
        return prev.dir === 'asc' ? { key, dir: 'desc' } : null;
      }
      return { key, dir: 'asc' };
    });
  }, []);

  const handleLinkSort = useCallback((key: string) => {
    setLinkSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === 'asc' ? { key, dir: 'desc' } : null;
      }
      return { key, dir: 'asc' };
    });
  }, []);

  // --- Callbacks: transform rules ------------------------------------------

  /** Add a new transform rule of the given type */
  const handleAddTransformRule = useCallback((type: TransformRuleType) => {
    console.info('[GraphProcessor] Adding transform rule:', { type });
    setTransformRules((prev) => [
      ...prev,
      { id: `tr_${Date.now()}`, type, enabled: true },
    ]);
  }, []);

  /** Remove a transform rule by ID */
  const handleRemoveTransformRule = useCallback((id: string) => {
    setTransformRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /** Update a single field on a transform rule */
  const handleUpdateTransformRule = useCallback(
    (id: string, field: keyof TransformRule, value: string | boolean) => {
      setTransformRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  // --- Callbacks: filter rules ----------------------------------------------

  const handleAddRule = useCallback((target: FilterTarget) => {
    const newRule: FilterRule = {
      id: `rule_${Date.now()}`,
      target,
      field: target === 'nodes' ? 'type' : 'relation',
      operator: 'contains',
      value: '',
      enabled: true,
    };
    setFilterRules((prev) => [...prev, newRule]);
  }, []);

  const handleRemoveRule = useCallback((ruleId: string) => {
    setFilterRules((prev) => prev.filter((r) => r.id !== ruleId));
  }, []);

  const handleUpdateRule = useCallback(
    (ruleId: string, field: keyof FilterRule, value: string | boolean) => {
      setFilterRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  // --- Callback: apply processed data ---------------------------------------

  const handleApply = useCallback(() => {
    console.info('[GraphProcessor] Applying processed data:', {
      nodes: processedData.nodes.length,
      links: processedData.links.length,
      excludedNodes: excludedNodeIds.size,
      excludedLinks: excludedLinkIds.size,
      filterRules: filterRules.filter((r) => r.enabled).length,
    });
    onProcessed(processedData);
    toast.success(
      gt(
        'graphExplorer.processor.toast.graphReadyPreview',
        'Graph prepared: {{nodes}} nodes, {{links}} links',
        {
          nodes: processedData.nodes.length,
          links: processedData.links.length,
        }
      )
    );
  }, [processedData, onProcessed, excludedNodeIds, excludedLinkIds, filterRules, gt]);

  // --- Derived values -------------------------------------------------------

  const includedNodes = transformedBaseData.nodes.length - excludedNodeIds.size;
  const includedLinks = transformedBaseData.links.length - excludedLinkIds.size;
  const hasExclusions = excludedNodeIds.size > 0 || excludedLinkIds.size > 0;
  const hasActiveFilters = filterRules.filter((r) => r.enabled).length > 0 || excludeIsolatedNodes;
  const activeTransformRules = transformRules.filter((r) => r.enabled).length;

  const togglePreviewSection = useCallback((key: PreviewSectionKey) => {
    setPreviewSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleEditPanel = useCallback(() => {
    setShowEditPanel((prev) => (prev && !showPreviewPanel ? prev : !prev));
  }, [showPreviewPanel]);

  const togglePreviewPanel = useCallback(() => {
    setShowPreviewPanel((prev) => (prev && !showEditPanel ? prev : !prev));
  }, [showEditPanel]);

  const openEditOnly = useCallback(() => {
    setShowEditPanel(true);
    setShowPreviewPanel(false);
  }, []);

  const openPreviewOnly = useCallback(() => {
    setShowEditPanel(false);
    setShowPreviewPanel(true);
  }, []);

  const startPreviewResize = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isWideLayout || !showEditPanel || !showPreviewPanel) return;
      event.preventDefault();
      const container = splitContainerRef.current;
      if (!container) return;

      setIsResizingPreview(true);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const onMouseMove = (moveEvent: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        if (!rect.width) return;
        const pointerX = Math.min(Math.max(moveEvent.clientX - rect.left, 0), rect.width);
        const nextPreviewPercent = ((rect.width - pointerX) / rect.width) * 100;
        const clamped = Math.min(60, Math.max(24, nextPreviewPercent));
        setPreviewWidthPercent(clamped);
      };

      const onMouseUp = () => {
        setIsResizingPreview(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [isWideLayout, showEditPanel, showPreviewPanel]
  );

  useEffect(() => {
    const checkWideLayout = () => {
      setIsWideLayout(window.innerWidth >= 1280);
    };
    checkWideLayout();
    window.addEventListener('resize', checkWideLayout);
    return () => window.removeEventListener('resize', checkWideLayout);
  }, []);

  useEffect(() => {
    if (!isTransformMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!transformMenuRef.current?.contains(target)) {
        setIsTransformMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isTransformMenuOpen]);

  useEffect(() => {
    const draft = loadProcessorDraft();
    if (!draft || draft.sourceLabel !== sourceLabel) {
      setDidRestoreDraft(false);
      setIsDraftHydrated(true);
      return;
    }
    if (draft.rawSignature && draft.rawSignature !== rawSignature) {
      console.info('[GraphProcessor] Skipping stale draft due to raw signature mismatch:', {
        draftRawSignature: draft.rawSignature,
        currentRawSignature: rawSignature,
      });
      clearProcessorDraft();
      setDidRestoreDraft(false);
      setIsDraftHydrated(true);
      return;
    }

    console.info('[GraphProcessor] Restoring processor draft:', {
      sourceLabel,
      filters: draft.filterRules.length,
      transforms: draft.transformRules.length,
    });

    setExcludedNodeIds(new Set(draft.excludedNodeIds));
    setExcludedLinkIds(new Set(draft.excludedLinkIds));
    setFilterRules(draft.filterRules as unknown as FilterRule[]);
    setTransformRules(draft.transformRules as unknown as TransformRule[]);
    setNodeOverrides(new Map(Object.entries(draft.nodeOverrides as Record<string, NodeOverride>)));
    setLinkOverrides(new Map(Object.entries(draft.linkOverrides as Record<string, LinkOverride>)));
    setEntitySearch(draft.entitySearch ?? '');
    setLinkSearch(draft.linkSearch ?? '');
    setEntitySort(draft.entitySort ?? null);
    setLinkSort(draft.linkSort ?? null);
    setShowEditPanel(draft.showEditPanel ?? true);
    setShowPreviewPanel(draft.showPreviewPanel ?? true);
    setPreviewWidthPercent(draft.previewWidthPercent ?? 36);
    setExcludeIsolatedNodes(Boolean(draft.excludeIsolatedNodes));
    setPreviewSections((draft.previewSections as Record<PreviewSectionKey, boolean>) ?? {
      summary: true,
      changes: true,
      sample: true,
    });
    // Restore new fields if present
    if (draft.manualLinks) {
      setManualLinks(draft.manualLinks as unknown as GraphLink[]);
    }
    if (draft.annotations) {
      setAnnotations(
        new Map(Object.entries(draft.annotations as unknown as Record<string, NodeAnnotation>))
      );
    }
    setDidRestoreDraft(true);
    setIsDraftHydrated(true);
  }, [sourceLabel, rawSignature]);

  useEffect(() => {
    if (!isDraftHydrated || didRestoreDraft || defaultsApplied) return;
    // Data authenticity first: never auto-hide links/nodes on first load.
    setExcludeIsolatedNodes(false);
    setExcludedLinkIds(new Set());
    setDefaultsApplied(true);
  }, [isDraftHydrated, didRestoreDraft, defaultsApplied]);

  useEffect(() => {
    if (!isDraftHydrated) return;
    saveProcessorDraft({
      sourceLabel,
      rawSignature,
      excludeIsolatedNodes,
      excludedNodeIds: Array.from(excludedNodeIds),
      excludedLinkIds: Array.from(excludedLinkIds),
      filterRules: filterRules as unknown as Array<Record<string, unknown>>,
      transformRules: transformRules as unknown as Array<Record<string, unknown>>,
      nodeOverrides: Object.fromEntries(nodeOverrides) as unknown as Record<string, Record<string, unknown>>,
      linkOverrides: Object.fromEntries(linkOverrides) as unknown as Record<string, Record<string, unknown>>,
      entitySearch,
      linkSearch,
      entitySort,
      linkSort,
      showEditPanel,
      showPreviewPanel,
      previewWidthPercent,
      previewSections,
      manualLinks: manualLinks as unknown as Array<Record<string, unknown>>,
      annotations: Object.fromEntries(annotations) as unknown as Record<string, Record<string, unknown>>,
    });
  }, [
    sourceLabel,
    rawSignature,
    excludeIsolatedNodes,
    excludedNodeIds,
    excludedLinkIds,
    filterRules,
    transformRules,
    nodeOverrides,
    linkOverrides,
    entitySearch,
    linkSearch,
    entitySort,
    linkSort,
    showEditPanel,
    showPreviewPanel,
    previewWidthPercent,
    previewSections,
    manualLinks,
    annotations,
    isDraftHydrated,
  ]);

  const handleExportConfig = useCallback(() => {
    const payload = {
      schemaVersion: 2,
      kind: PREPROCESS_SNAPSHOT_KIND,
      sourceLabel,
      exportedAt: new Date().toISOString(),
      draft: {
        sourceLabel,
        excludedNodeIds: Array.from(excludedNodeIds),
        excludedLinkIds: Array.from(excludedLinkIds),
        filterRules,
        transformRules,
        nodeOverrides: Object.fromEntries(nodeOverrides),
        linkOverrides: Object.fromEntries(linkOverrides),
        entitySearch,
        linkSearch,
        entitySort,
        linkSort,
        excludeIsolatedNodes,
        showEditPanel,
        showPreviewPanel,
        previewWidthPercent,
        previewSections,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `graph-preprocess-config-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(gt('graphExplorer.processor.toast.processingConfigExported', 'Processing config exported'));
  }, [
    gt,
    sourceLabel,
    excludedNodeIds,
    excludedLinkIds,
    filterRules,
    transformRules,
    nodeOverrides,
    linkOverrides,
    entitySearch,
    linkSearch,
    entitySort,
    linkSort,
    excludeIsolatedNodes,
    showEditPanel,
    showPreviewPanel,
    previewWidthPercent,
    previewSections,
  ]);

  const handleExportRecipe = useCallback(() => {
    const steps = recordedRecipeStepsRef.current;
    if (steps.length === 0) {
      toast.error(gt('graphExplorer.processor.toast.recipeEmpty', 'Nothing recorded yet. Turn Record on and use type chips / filters.'));
      return;
    }
    const payload = {
      schemaVersion: 2,
      kind: PREPROCESS_RECIPE_KIND,
      exportedAt: new Date().toISOString(),
      steps,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `graph-preprocess-recipe-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(
      gt('graphExplorer.processor.toast.recipeExported', '{{count}} steps exported', {
        count: steps.length,
      })
    );
  }, [gt]);

  const applyDraft = useCallback((draft: Record<string, unknown>) => {
    setExcludedNodeIds(new Set((draft.excludedNodeIds as string[]) ?? []));
    setExcludedLinkIds(new Set((draft.excludedLinkIds as string[]) ?? []));
    setFilterRules((draft.filterRules as FilterRule[]) ?? []);
    setTransformRules((draft.transformRules as TransformRule[]) ?? []);
    setNodeOverrides(
      new Map(Object.entries((draft.nodeOverrides as Record<string, NodeOverride>) ?? {}))
    );
    setLinkOverrides(
      new Map(Object.entries((draft.linkOverrides as Record<string, LinkOverride>) ?? {}))
    );
    setEntitySearch((draft.entitySearch as string) ?? '');
    setLinkSearch((draft.linkSearch as string) ?? '');
    setEntitySort((draft.entitySort as { key: string; dir: 'asc' | 'desc' } | null) ?? null);
    setLinkSort((draft.linkSort as { key: string; dir: 'asc' | 'desc' } | null) ?? null);
    setShowEditPanel((draft.showEditPanel as boolean) ?? true);
    setShowPreviewPanel((draft.showPreviewPanel as boolean) ?? true);
    setPreviewWidthPercent((draft.previewWidthPercent as number) ?? 36);
    setExcludeIsolatedNodes(Boolean(draft.excludeIsolatedNodes));
    setPreviewSections(
      (draft.previewSections as Record<PreviewSectionKey, boolean>) ?? {
        summary: true,
        changes: true,
        sample: true,
      }
    );
  }, []);

  const handleImportConfig = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as Record<string, unknown>;
          if (
            parsed.kind === PREPROCESS_RECIPE_KIND &&
            Array.isArray(parsed.steps)
          ) {
            const result = applyPreprocessRecipeSteps(
              parsed.steps as PreprocessRecipeStep[],
              transformedBaseData.nodes,
              transformedBaseData.links,
              resolveNodeType,
              resolveRelationType
            );
            setExcludedNodeIds(result.excludedNodeIds);
            setExcludedLinkIds(result.excludedLinkIds);
            setExcludeIsolatedNodes(result.excludeIsolatedNodes);
            setFilterRules(result.filterRules);
            setTransformRules(result.transformRules);
            toast.success(
              gt('graphExplorer.processor.toast.recipeImported', 'Recipe applied ({{count}} steps)', {
                count: (parsed.steps as unknown[]).length,
              })
            );
            return;
          }
          const draft = parsed.draft as Record<string, unknown> | undefined;
          if (draft && typeof draft === 'object') {
            applyDraft(draft);
            toast.success(gt('graphExplorer.processor.toast.processingConfigImported', 'Processing config imported'));
            return;
          }
          toast.error(gt('graphExplorer.processor.toast.invalidConfigFile', 'Invalid config file'));
        } catch (error) {
          console.error('[GraphProcessor] Failed to import config:', error);
          toast.error(gt('graphExplorer.processor.toast.failedToParseConfigFile', 'Failed to parse config file'));
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    [applyDraft, gt, resolveNodeType, resolveRelationType, transformedBaseData.links, transformedBaseData.nodes]
  );

  const resetProcessingDraft = useCallback(() => {
    setExcludedNodeIds(new Set());
    setExcludedLinkIds(new Set());
    setFilterRules([]);
    setTransformRules([]);
    setNodeOverrides(new Map());
    setLinkOverrides(new Map());
    setEntitySearch('');
    setLinkSearch('');
    setEntitySort(null);
    setLinkSort(null);
    setExcludeIsolatedNodes(false);
    setShowEditPanel(true);
    setShowPreviewPanel(true);
    setPreviewWidthPercent(36);
    setPreviewSections({ summary: true, changes: true, sample: true });
    clearProcessorDraft();
    toast.success(gt('graphExplorer.processor.toast.processingStateReset', 'Temporary processing state reset'));
  }, [gt]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className={cn('flex flex-col', className)}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-1.5"
          >
            <PiArrowLeftBold className="h-3.5 w-3.5" />
            {gt('common.back', 'Back')}
          </Button>
          <div>
            <Title as="h3" className="text-lg font-semibold">
              {gt('graphExplorer.processor.title', 'Pre-processing')}
            </Title>
            <div className="flex items-center gap-2 mt-0.5">
              <Text className="text-xs text-gray-500">{gt('graphExplorer.processor.source', 'Source:')}</Text>
              <Badge variant="flat" color="info" size="sm">
                {sourceLabel}
              </Badge>
            </div>
          </div>
        </div>

        {/* Summary stats in header */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <span>
              <strong className="text-gray-900 dark:text-gray-100">
                {processedData.nodes.length}
              </strong>
              <span className="text-gray-400"> / {rawData.nodes.length}</span>{' '}
              {gt('graphExplorer.stats.nodes', 'nodes')}
            </span>
            <span>
              <strong className="text-gray-900 dark:text-gray-100">
                {processedData.links.length}
              </strong>
              <span className="text-gray-400"> / {rawData.links.length}</span>{' '}
              {gt('graphExplorer.stats.edges', 'links')}
            </span>
          </div>
          <Button onClick={handleApply} className="flex items-center gap-2">
            <PiGraphBold className="h-4 w-4" />
            {gt('graphExplorer.processor.visualize', 'Visualize')}
            <PiArrowRightBold className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Quick type selectors ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="w-full flex items-center justify-end gap-2">
          <Badge variant="flat" className="text-[10px]">
            reclassified nodes: {typedDiffStats.reclassifiedNodes}
          </Badge>
          <Badge variant="flat" className="text-[10px]">
            reclassified relations: {typedDiffStats.reclassifiedRelations}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={applyTypedInference}
            className="h-7 text-[11px]"
          >
            {gt('graphExplorer.processor.applyTypedInference', 'Apply Typed Inference')}
          </Button>
          {classificationMode === 'typed' && (
            <Button
              size="sm"
              variant={showOnlyTypedChanges ? 'solid' : 'outline'}
              onClick={() => setShowOnlyTypedChanges((v) => !v)}
              className="h-7 text-[11px]"
            >
              {showOnlyTypedChanges
                ? gt('common.showAll', 'Show All')
                : gt('graphExplorer.processor.showTypedDeltaOnly', 'Show Typed Delta Only')}
            </Button>
          )}
          <Text className="text-[10px] uppercase tracking-wider text-gray-500">{gt('graphExplorer.processor.classification', 'Classification')}</Text>
          <div className="inline-flex rounded-md border border-muted p-0.5">
            <button
              type="button"
              onClick={() => setClassificationMode('authentic')}
              className={cn(
                'px-2.5 py-1 text-[11px] rounded',
                classificationMode === 'authentic'
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'text-gray-500'
              )}
            >
              {gt('graphExplorer.processor.dataOrigin', 'Data Origin')}
            </button>
            <button
              type="button"
              onClick={() => setClassificationMode('typed')}
              className={cn(
                'px-2.5 py-1 text-[11px] rounded',
                classificationMode === 'typed'
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'text-gray-500'
              )}
            >
              {gt('graphExplorer.processor.typedView', 'Typed View')}
            </button>
          </div>
        </div>
        {/* Entity types */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <Text className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {gt('graphExplorer.filter.entityTypes', 'Entity Types')}
            </Text>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={transformedBaseData.nodes.length === 0}
                onClick={includeAllEntityTypeChips}
              >
                {gt('graphExplorer.processor.typeChipsIncludeAll', 'Include all')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={transformedBaseData.nodes.length === 0}
                onClick={excludeAllEntityTypeChips}
              >
                {gt('graphExplorer.processor.typeChipsExcludeAll', 'Exclude all')}
              </Button>
            </div>
          </div>
          <Input
            size="sm"
            value={entityTypeSearchQuery}
            onChange={(e) => {
              setEntityTypeSearchQuery(e.target.value);
              setEntityTypeVisibleCount(18);
            }}
            placeholder={gt('graphExplorer.processor.searchEntityType', 'Search entity type...')}
            className="mb-2 text-xs"
          />
          <div className="max-h-44 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-1.5">
            {filteredEntityTypeStats.slice(0, entityTypeVisibleCount).map(([type, { total, included }]) => {
              const cfg = getEntityConfig(type);
              const allIncluded = included === total;
              const noneIncluded = included === 0;
              return (
                <button
                  key={type}
                  onClick={() =>
                    allIncluded ? excludeByType(type) : includeByType(type)
                  }
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                    noneIncluded
                      ? 'border-gray-200 dark:border-gray-700 text-gray-400 bg-gray-50 dark:bg-gray-100 line-through'
                      : 'border-transparent text-white shadow-sm'
                  )}
                  style={
                    !noneIncluded ? { backgroundColor: cfg.color } : undefined
                  }
                >
                  <span className="truncate max-w-[90px]">{cfg.label}</span>
                  <span
                    className={cn(
                      'text-[10px] font-mono',
                      noneIncluded ? 'text-gray-400' : 'text-white/70'
                    )}
                  >
                    {included}/{total}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
          {filteredEntityTypeStats.length > entityTypeVisibleCount && (
            <button
              type="button"
              onClick={() => setEntityTypeVisibleCount((v) => v + 18)}
              className="mt-2 text-xs text-primary hover:underline"
            >
                {gt('common.loadMore', 'Load more')} ({filteredEntityTypeStats.length - entityTypeVisibleCount} {gt('graphExplorer.processor.left', 'left')})
            </button>
          )}
        </div>

        {/* Relation types */}
        {relationTypeStats.length > 0 && (
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <Text className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {gt('graphExplorer.filter.relationTypes', 'Relation Types')}
              </Text>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={transformedBaseData.links.length === 0}
                  onClick={includeAllRelationTypeChips}
                >
                  {gt('graphExplorer.processor.typeChipsIncludeAll', 'Include all')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={transformedBaseData.links.length === 0}
                  onClick={excludeAllRelationTypeChips}
                >
                  {gt('graphExplorer.processor.typeChipsExcludeAll', 'Exclude all')}
                </Button>
              </div>
            </div>
            <Input
              size="sm"
              value={relationTypeSearchQuery}
              onChange={(e) => {
                setRelationTypeSearchQuery(e.target.value);
                setRelationTypeVisibleCount(24);
              }}
              placeholder={gt('graphExplorer.processor.searchRelationType', 'Search relation type...')}
              className="mb-2 text-xs"
            />
            <div className="max-h-44 overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-1.5">
              {filteredRelationTypeStats.slice(0, relationTypeVisibleCount).map(([rel, { total, included }]) => {
                const cfg = getRelationConfig(rel);
                const allIncluded = included === total;
                const noneIncluded = included === 0;
                return (
                  <button
                    key={rel}
                    onClick={() =>
                      allIncluded
                        ? excludeByRelation(rel)
                        : includeByRelation(rel)
                    }
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                      noneIncluded
                        ? 'border-gray-200 dark:border-gray-700 text-gray-400 bg-gray-50 dark:bg-gray-100 line-through'
                        : 'border-transparent text-white shadow-sm'
                    )}
                    style={
                      !noneIncluded ? { backgroundColor: cfg.color } : undefined
                    }
                  >
                    <span className="truncate max-w-[90px]">{cfg.label}</span>
                    <span
                      className={cn(
                        'text-[10px] font-mono',
                        noneIncluded ? 'text-gray-400' : 'text-white/70'
                      )}
                    >
                      {included}/{total}
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
            {filteredRelationTypeStats.length > relationTypeVisibleCount && (
              <button
                type="button"
                onClick={() => setRelationTypeVisibleCount((v) => v + 24)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                {gt('common.loadMore', 'Load more')} ({filteredRelationTypeStats.length - relationTypeVisibleCount} {gt('graphExplorer.processor.left', 'left')})
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Data Integrity / Origin summary ─────────────────────────── */}
      <div className="mb-4 rounded-lg border border-muted bg-gray-50/70 dark:bg-gray-100/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <PiDatabaseBold className="h-4 w-4 text-gray-500" />
          <Text className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
            {gt('graphExplorer.processor.dataIntegrityOrigin', 'Data Integrity / Origin')}
          </Text>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded border border-muted bg-gray-0 dark:bg-gray-50 p-2">
            <Text className="text-[10px] text-gray-500 uppercase tracking-wider">{gt('graphExplorer.processor.topology', 'Topology')}</Text>
            <Text className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              {rawData.nodes.length} nodes, {rawData.links.length} relationships
            </Text>
            <Text className="text-[11px] text-gray-500">
              View: {processedData.nodes.length} / {processedData.links.length}
            </Text>
          </div>
          <div className="rounded border border-muted bg-gray-0 dark:bg-gray-50 p-2">
            <Text className="text-[10px] text-gray-500 uppercase tracking-wider">{gt('graphExplorer.stats.communities', 'Communities')}</Text>
            <Text className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              {originDataStats.communities} clusters, {originDataStats.communityReports} reports
            </Text>
            <Text className="text-[11px] text-gray-500">
              Source: {classificationMode === 'authentic' ? 'Data Origin' : 'Typed View'}
            </Text>
          </div>
          <div className="rounded border border-muted bg-gray-0 dark:bg-gray-50 p-2">
            <Text className="text-[10px] text-gray-500 uppercase tracking-wider">{gt('graphExplorer.processor.typeCoverage', 'Type Coverage')}</Text>
            <Text className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              unspecified relations: {originDataStats.unspecifiedRelations}
            </Text>
            <Text className="text-[11px] text-gray-500">
              unknown entity types: {originDataStats.unknownEntityTypes}
            </Text>
          </div>
          <div className="rounded border border-muted bg-gray-0 dark:bg-gray-50 p-2">
            <Text className="text-[10px] text-gray-500 uppercase tracking-wider">{gt('graphExplorer.processor.extractionMeta', 'Extraction Meta')}</Text>
            <Text className="mt-1 truncate text-[11px] text-gray-700 dark:text-gray-300">
              model: {originDataStats.extractionModel || 'n/a'}
            </Text>
            <Text className="truncate text-[11px] text-gray-500">
              source: {originDataStats.extractionSource || 'n/a'}
            </Text>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded border border-muted bg-gray-0 dark:bg-gray-50 p-2">
            <Text className="text-[10px] text-gray-500 uppercase tracking-wider">{gt('graphExplorer.processor.topNodePropertyKeys', 'Top Node Property Keys')}</Text>
            <Input
              size="sm"
              value={nodeKeySearchQuery}
              onChange={(e) => {
                setNodeKeySearchQuery(e.target.value);
                setNodeKeyVisibleCount(16);
              }}
              placeholder={gt('graphExplorer.processor.searchNodeKeys', 'Search node keys...')}
              className="mt-2 text-xs"
            />
            <div className="mt-2 max-h-32 overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-1">
              {filteredNodeKeyStats.slice(0, nodeKeyVisibleCount).map(([k, c]) => (
                <Badge key={`nk-${k}`} variant="flat" className="text-[10px] font-mono">
                  {k} {c}
                </Badge>
              ))}
              </div>
            </div>
            {filteredNodeKeyStats.length > nodeKeyVisibleCount && (
              <button
                type="button"
                onClick={() => setNodeKeyVisibleCount((v) => v + 16)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                {gt('common.loadMore', 'Load more')} ({filteredNodeKeyStats.length - nodeKeyVisibleCount} {gt('graphExplorer.processor.left', 'left')})
              </button>
            )}
          </div>
          <div className="rounded border border-muted bg-gray-0 dark:bg-gray-50 p-2">
            <Text className="text-[10px] text-gray-500 uppercase tracking-wider">{gt('graphExplorer.processor.topRelationshipPropertyKeys', 'Top Relationship Property Keys')}</Text>
            <Input
              size="sm"
              value={relKeySearchQuery}
              onChange={(e) => {
                setRelKeySearchQuery(e.target.value);
                setRelKeyVisibleCount(16);
              }}
              placeholder={gt('graphExplorer.processor.searchRelationshipKeys', 'Search relationship keys...')}
              className="mt-2 text-xs"
            />
            <div className="mt-2 max-h-32 overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-1">
              {filteredRelKeyStats.slice(0, relKeyVisibleCount).map(([k, c]) => (
                <Badge key={`lk-${k}`} variant="flat" className="text-[10px] font-mono">
                  {k} {c}
                </Badge>
              ))}
              </div>
            </div>
            {filteredRelKeyStats.length > relKeyVisibleCount && (
              <button
                type="button"
                onClick={() => setRelKeyVisibleCount((v) => v + 16)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                {gt('common.loadMore', 'Load more')} ({filteredRelKeyStats.length - relKeyVisibleCount} {gt('graphExplorer.processor.left', 'left')})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Exclusion warning bar ───────────────────────────────────── */}
      {(hasExclusions || hasActiveFilters) && (
        <div className="flex items-center gap-3 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5">
          <PiWarningCircleBold className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <Text className="text-xs text-amber-700 dark:text-amber-300 flex-1">
            {excludedNodeIds.size > 0 && (
              <span>
                <strong>{excludedNodeIds.size}</strong> nodes excluded.{' '}
              </span>
            )}
            {excludedLinkIds.size > 0 && (
              <span>
                <strong>{excludedLinkIds.size}</strong> links excluded.{' '}
              </span>
            )}
            {hasActiveFilters && (
              <span>
                <strong>
                  {filterRules.filter((r) => r.enabled).length}
                </strong>{' '}
                filter rules active.{' '}
              </span>
            )}
            {excludeIsolatedNodes && (
              <span>
                <strong>Isolated nodes removed.</strong>{' '}
              </span>
            )}
            Final: <strong>{processedData.nodes.length}</strong> nodes,{' '}
            <strong>{processedData.links.length}</strong> links.
          </Text>
          <Button
            variant="text"
            size="sm"
            onClick={() => {
              setExcludedNodeIds(new Set());
              setExcludedLinkIds(new Set());
              setFilterRules([]);
              setExcludeIsolatedNodes(false);
              toast.success(gt('graphExplorer.processor.toast.allExclusionsCleared', 'All exclusions and filters cleared'));
            }}
            className="text-amber-700 dark:text-amber-300 flex-shrink-0"
          >
            {gt('common.reset', 'Reset All')}
          </Button>
        </div>
      )}

      {classificationMode === 'typed' && typedDiffStats.reclassifiedNodes + typedDiffStats.reclassifiedRelations === 0 && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          {gt(
            'graphExplorer.processor.noTypedDiff',
            'Typed View has no inferred differences from Data Origin for this dataset yet. Use edit actions or Apply Typed Inference to create visible typed deltas.'
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Text className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {gt('graphExplorer.processor.workspaceLayout', 'Workspace Layout')}
        </Text>
        <Button
          size="sm"
          variant={showEditPanel ? 'solid' : 'outline'}
          onClick={toggleEditPanel}
          className="h-7 px-2.5 text-[11px]"
        >
          {showEditPanel ? <PiEyeBold className="w-3.5 h-3.5 mr-1" /> : <PiEyeSlashBold className="w-3.5 h-3.5 mr-1" />}
          {gt('graphExplorer.processor.editPanel', 'Edit Panel')}
        </Button>
        <Button
          size="sm"
          variant={showPreviewPanel ? 'solid' : 'outline'}
          onClick={togglePreviewPanel}
          className="h-7 px-2.5 text-[11px]"
        >
          {showPreviewPanel ? <PiEyeBold className="w-3.5 h-3.5 mr-1" /> : <PiEyeSlashBold className="w-3.5 h-3.5 mr-1" />}
          {gt('graphExplorer.processor.livePreview', 'Live Preview')}
        </Button>
        {showEditPanel && showPreviewPanel && (
          <Text className="text-[10px] text-gray-400 ml-1">
            Resize available{isWideLayout ? ' (drag divider)' : ' on wide screens'}
          </Text>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400 mr-2">
            <Checkbox
              checked={excludeIsolatedNodes}
              onChange={(e) => {
                const checked = e.target.checked;
                setExcludeIsolatedNodes(checked);
                appendRecipeStep({ type: 'set_exclude_isolated', value: checked });
              }}
            />
            {gt('graphExplorer.processor.excludeIsolatedNodes', 'Exclude isolated nodes')}
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportConfig}
            className="h-7 px-2.5 text-[11px]"
          >
            {gt('graphExplorer.processor.saveConfig', 'Save Config')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => configFileInputRef.current?.click()}
            className="h-7 px-2.5 text-[11px]"
          >
            {gt('graphExplorer.processor.loadConfig', 'Load Config')}
          </Button>
          <Tooltip
            content={gt(
              'graphExplorer.processor.recordActionsHint',
              'Records semantic steps (types, relations, isolated toggle, filters, transforms). Use type chips above for portability across cases. Row bulk include/exclude is not recorded.'
            )}
            placement="bottom"
          >
            <Button
              type="button"
              size="sm"
              variant={recipeRecording ? 'solid' : 'outline'}
              onClick={() =>
                setRecipeRecording((prev) => {
                  const next = !prev;
                  if (next) {
                    recordedRecipeStepsRef.current = [];
                    toast.success(
                      gt('graphExplorer.processor.recordingStarted', 'Recording started — captures your next preprocess actions.')
                    );
                  } else {
                    toast(
                      gt('graphExplorer.processor.recordingPaused', '{{count}} step(s) recorded. Export Recipe to save.', {
                        count: recordedRecipeStepsRef.current.length,
                      })
                    );
                  }
                  return next;
                })
              }
              className={cn(
                'h-7 px-2.5 text-[11px] shrink-0',
                recipeRecording && 'shadow-sm bg-red hover:bg-red-dark text-white border-transparent'
              )}
            >
              <PiMicrophoneBold className={cn('w-3.5 h-3.5 inline mr-1 align-text-bottom', recipeRecording && 'opacity-95')} />
              {recipeRecording
                ? gt('graphExplorer.processor.recordingOn', 'Recording')
                : gt('graphExplorer.processor.recordActions', 'Record')}
            </Button>
          </Tooltip>
          <Tooltip
            content={gt(
              'graphExplorer.processor.exportRecipeHint',
              'Download semantic recipe JSON (`graphExplorer.preprocessRecipe`). Load it via Load Config on another case.'
            )}
            placement="bottom"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExportRecipe}
              className="h-7 px-2.5 text-[11px] shrink-0"
            >
              <PiFileTextBold className="w-3.5 h-3.5 inline mr-1 align-text-bottom" />
              {gt('graphExplorer.processor.exportRecipe', 'Export recipe')}
            </Button>
          </Tooltip>
          <Button
            type="button"
            size="sm"
            variant="text"
            onClick={() => setShowConfigDocs((v) => !v)}
            className="h-7 px-2 text-[11px]"
          >
            {showConfigDocs
              ? gt('graphExplorer.processor.hideConfigDocs', 'Hide format')
              : gt('graphExplorer.processor.showConfigDocs', 'Format help')}
          </Button>
          <Button
            size="sm"
            variant="text"
            onClick={resetProcessingDraft}
            className="h-7 px-2 text-[11px] text-red-500"
          >
            {gt('graphExplorer.processor.resetDraft', 'Reset Draft')}
          </Button>
          <input
            ref={configFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportConfig}
            className="hidden"
          />
        </div>
      </div>

      {showConfigDocs && (
        <div className="mb-4 rounded-lg border border-muted bg-gray-50/90 dark:bg-gray-100/20 p-4 text-[11px] text-gray-600 dark:text-gray-300 space-y-4 leading-relaxed">
          <Title as="h4" className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {gt(
              'graphExplorer.processor.configDocsTitle',
              'Config & recipe files (JSON)'
            )}
          </Title>
          <div className="space-y-2">
            <Text className="font-medium text-gray-800 dark:text-gray-200">
              {gt(
                'graphExplorer.processor.configDocsSnapshotHeading',
                '1) Snapshot — same graph/session (exact excluded IDs & UI state)'
              )}
            </Text>
            <Text>
              {gt(
                'graphExplorer.processor.configDocsSnapshotBody',
                'Exported by Save Config. Top-level keys: schemaVersion (2), kind `graphExplorer.preprocessSnapshot`, `draft` with excludedNodeIds, excludedLinkIds, filterRules, transformRules, overrides, searches, workspace flags. Legacy files only have `draft` or `version: 1`; they still load.'
              )}
            </Text>
          </div>
          <div className="space-y-2">
            <Text className="font-medium text-gray-800 dark:text-gray-200">
              {gt(
                'graphExplorer.processor.configDocsRecipeHeading',
                '2) Recipe — different cases (semantic steps by type/relation/rules)'
              )}
            </Text>
            <Text>
              {gt(
                'graphExplorer.processor.configDocsRecipeBody',
                'kind must be `graphExplorer.preprocessRecipe`, with a `steps` array. Supported step types include clear_exclusions, set_exclude_isolated, exclude_entity_types / include_entity_types, exclude_relation_types / include_relation_types, set_filter_rules, set_transform_rules. Import with Load Config; it replaces exclusions/filters/transforms/isolated toggle from a clean slate for the current dataset.'
              )}
            </Text>
          </div>
          <details className="rounded-md border border-muted bg-gray-0 dark:bg-gray-50 px-3 py-2">
            <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-200">
              {gt('graphExplorer.processor.configDocsExampleToggle', 'Example recipe JSON')}
            </summary>
            <pre className="mt-2 overflow-x-auto font-mono text-[10px] text-gray-500 dark:text-gray-400 whitespace-pre">{`{
  "schemaVersion": 2,
  "kind": "graphExplorer.preprocessRecipe",
  "exportedAt": "2026-05-06T12:00:00.000Z",
  "steps": [
    { "type": "exclude_entity_types", "types": ["document"] },
    { "type": "exclude_relation_types", "relations": ["MENTIONS"] },
    { "type": "set_exclude_isolated", "value": true }
  ]
}`}</pre>
          </details>
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-muted mb-0">
        <TabButton
          label={gt('graphExplorer.processor.entitiesTab', 'Entities')}
          icon={<PiTableBold className="w-4 h-4" />}
          active={activeTab === 'entities'}
          badge={`${includedNodes}/${rawData.nodes.length}`}
          onClick={() => handleTabClick('entities')}
        />
        <TabButton
          label={gt('graphExplorer.processor.relationshipsTab', 'Relationships')}
          icon={<PiArrowsLeftRightBold className="w-4 h-4" />}
          active={activeTab === 'relationships'}
          badge={`${includedLinks}/${rawData.links.length}`}
          onClick={() => handleTabClick('relationships')}
        />
        <TabButton
          label={gt('common.filters', 'Filters')}
          icon={<PiFunnelBold className="w-4 h-4" />}
          active={activeTab === 'filters'}
          badge={
            filterRules.length > 0
              ? filterRules.filter((r) => r.enabled).length
              : undefined
          }
          onClick={() => handleTabClick('filters')}
        />
        <TabButton
          label={gt('graphExplorer.processor.transformTab', 'Transform')}
          icon={<PiArrowsSplitBold className="w-4 h-4" />}
          active={activeTab === 'transform'}
          badge={transformRules.length > 0 ? activeTransformRules : undefined}
          onClick={() => handleTabClick('transform')}
        />
        {totalOverrides > 0 && (
          <div className="ml-auto mr-2 flex items-center gap-1.5">
            <Badge
              variant="flat"
              color="warning"
              size="sm"
              className="text-[10px] flex items-center gap-1"
            >
              <PiPencilSimpleBold className="w-2.5 h-2.5" />
              {totalOverrides} edited
            </Badge>
            <Tooltip content="Reset all edits (label, type, description, relation)">
              <button
                onClick={() => {
                  setNodeOverrides(new Map());
                  setLinkOverrides(new Map());
                  toast('All edits reset', { icon: '↩' });
                }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <PiArrowCounterClockwiseBold className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* ── Tab content + live preview workspace ─────────────────────── */}
      <div
        ref={splitContainerRef}
        className={cn(
          'rounded-b-lg border border-t-0 border-muted bg-gray-0 dark:bg-gray-50 min-h-[560px]',
          'flex flex-col xl:flex-row overflow-hidden'
        )}
      >
        {showEditPanel && (
          <div
            className={cn('min-w-0 h-full min-h-[560px]', showPreviewPanel && 'border-b xl:border-b-0 xl:border-r border-muted')}
            style={
              showPreviewPanel && isWideLayout
                ? { width: `${100 - previewWidthPercent}%` }
                : { width: '100%' }
            }
          >
        {/* --- Entities Tab ----------------------------------------------- */}
        {activeTab === 'entities' && (
          <div className="flex flex-col h-full">
            {/* Search & bulk actions */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-muted bg-gray-50/50 dark:bg-gray-100/50">
              <Input
                placeholder={gt('graphExplorer.processor.searchEntities', 'Search entities by label, type, ID...')}
                value={entitySearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEntitySearch(e.target.value)
                }
                prefix={
                  <PiMagnifyingGlassBold className="w-3.5 h-3.5 text-gray-400" />
                }
                suffix={
                  entitySearch ? (
                    <button
                      onClick={() => setEntitySearch('')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <PiXBold className="w-3 h-3" />
                    </button>
                  ) : null
                }
                size="sm"
                className="flex-1 max-w-sm"
              />
              {/* Bulk: change type for all visible non-excluded entities */}
              <Tooltip
                content={gt(
                  'graphExplorer.processor.bulkChangeTypeHint',
                  'Apply an entity type to every visible row that is not excluded from the graph.'
                )}
                placement="top"
              >
                <div className="flex items-center gap-1.5 min-w-[200px] max-w-[280px] flex-shrink-0">
                  <PiTagBold className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden />
                  <Select
                    size="sm"
                    value={null}
                    options={ENTITY_TYPE_OPTIONS}
                    placeholder={gt('graphExplorer.processor.bulkChangeType', 'Bulk change type…')}
                    onChange={(option: { value?: string } | null) => {
                      if (option?.value) bulkChangeType(option.value);
                    }}
                    inPortal={false}
                    className="min-w-0 flex-1 !border-none !shadow-none !ring-0 !bg-transparent !p-0"
                    selectClassName={cn(
                      'text-[11px] min-h-8 !shadow-none w-full',
                      'bg-gray-0 dark:bg-gray-50',
                      'border border-muted rounded-md px-3',
                      'hover:border-primary focus-visible:border-primary',
                      'transition-colors'
                    )}
                    dropdownClassName="!z-20"
                  />
                </div>
              </Tooltip>
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-[10px]"
                  disabled={displayNodes.length === 0}
                  onClick={() => includeAllDisplayedNodes(displayNodes)}
                >
                  {gt('graphExplorer.processor.includeAllShown', 'Include all')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-[10px]"
                  disabled={displayNodes.length === 0}
                  onClick={() => excludeAllDisplayedNodes(displayNodes)}
                >
                  {gt('graphExplorer.processor.excludeAllShown', 'Exclude all')}
                </Button>
                <Text className="text-[10px] text-gray-400">
                  {displayNodes.length} {gt('graphExplorer.processor.shown', 'shown')}
                </Text>
              </div>
            </div>

            {/* Merge mode toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-muted bg-gray-0 dark:bg-gray-50">
              <Button
                variant={mergeMode ? 'solid' : 'outline'}
                size="sm"
                onClick={() => {
                  setMergeMode((v) => !v);
                  setSelectedForMerge(new Set());
                }}
                className={cn('flex items-center gap-1.5 h-7', mergeMode && 'text-white')}
              >
                <PiArrowsMergeBold className="w-3.5 h-3.5" />
                {mergeMode
                  ? gt('graphExplorer.processor.cancelMerge', 'Cancel Merge')
                  : gt('graphExplorer.processor.mergeEntities', 'Merge Entities')}
              </Button>
              {mergeMode && selectedForMerge.size >= 2 && (
                <Button
                  size="sm"
                  onClick={openMergeDialog}
                  className="flex items-center gap-1.5 h-7 bg-amber-500 hover:bg-amber-600 text-white border-0"
                >
                  <PiArrowsMergeBold className="w-3.5 h-3.5" />
                  {gt('graphExplorer.processor.mergeSelected', 'Merge {{count}} selected', {
                    count: selectedForMerge.size,
                  })}
                </Button>
              )}
              {mergeMode && (
                <Text className="text-[11px] text-gray-500">
                  {selectedForMerge.size === 0
                    ? gt('graphExplorer.processor.clickRowsToMerge', 'Click rows to select entities to merge')
                    : gt('graphExplorer.processor.selectedCount', '{{count}} selected', {
                        count: selectedForMerge.size,
                      })}
                </Text>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Tooltip content="Scan for potential duplicate entities (by label similarity)" placement="top">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={detectDuplicates}
                    className="flex items-center gap-1.5 h-7"
                  >
                    <PiCopyBold className="w-3.5 h-3.5" />
                    {gt('graphExplorer.processor.scanDuplicates', 'Scan Duplicates')}
                  </Button>
                </Tooltip>
                {duplicates.length > 0 && (
                  <button
                    onClick={() => setShowDuplicatesPanel((v) => !v)}
                    className="flex items-center gap-1 text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    <PiWarningCircleBold className="w-3.5 h-3.5" />
                    {gt('graphExplorer.processor.duplicatesFound', '{{count}} duplicate(s) found', {
                      count: duplicates.length,
                    })}
                    {showDuplicatesPanel ? (
                      <PiCaretUpBold className="w-2.5 h-2.5" />
                    ) : (
                      <PiCaretDownBold className="w-2.5 h-2.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Duplicates panel */}
            {showDuplicatesPanel && duplicates.length > 0 && (
              <div className="border-b border-orange-200 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-900/20 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <Text className="text-xs font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                    <PiWarningCircleBold className="w-4 h-4" />
                    {gt('graphExplorer.processor.potentialDuplicates', 'Potential Duplicates ({{count}})', {
                      count: duplicates.length,
                    })}
                  </Text>
                  <button
                    onClick={() => setShowDuplicatesPanel(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <PiXBold className="w-3.5 h-3.5" />
                  </button>
                </div>
                {duplicates.map((pair) => {
                  const nodeA = transformedBaseData.nodes.find((n) => n.id === pair.nodeAId);
                  const nodeB = transformedBaseData.nodes.find((n) => n.id === pair.nodeBId);
                  const ovA = nodeOverrides.get(pair.nodeAId);
                  const ovB = nodeOverrides.get(pair.nodeBId);
                  const labelA = ovA?.label ?? nodeA?.label ?? pair.nodeAId;
                  const labelB = ovB?.label ?? nodeB?.label ?? pair.nodeBId;
                  return (
                    <div
                      key={`${pair.nodeAId}-${pair.nodeBId}`}
                      className="flex items-center gap-3 rounded-md border border-orange-200 dark:border-orange-800 bg-gray-0 dark:bg-gray-50 px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <Text className="text-xs font-medium truncate">
                          <span className="text-gray-800 dark:text-gray-200">{labelA}</span>
                          <span className="text-gray-400 mx-1">↔</span>
                          <span className="text-gray-800 dark:text-gray-200">{labelB}</span>
                        </Text>
                        <Text className="text-[10px] text-orange-500">
                          {pair.reason} — {Math.round(pair.similarity * 100)}% similar
                        </Text>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Tooltip content={`Keep "${labelA}", exclude "${labelB}"`} placement="top">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] border-orange-300 text-orange-700 hover:bg-orange-50"
                            onClick={() => mergeDuplicatePair(pair)}
                          >
                            {gt('graphExplorer.processor.merge', 'Merge')}
                          </Button>
                        </Tooltip>
                        <Tooltip content="Dismiss this pair (not a duplicate)" placement="top">
                          <ActionIcon
                            variant="text"
                            size="sm"
                            onClick={() => dismissDuplicate(pair.nodeAId, pair.nodeBId)}
                            className="text-gray-400 hover:text-gray-600 h-6 w-6"
                          >
                            <PiXBold className="w-3 h-3" />
                          </ActionIcon>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Table */}
            <div className="overflow-auto max-h-[calc(100vh-430px)] min-h-[420px]">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-100 z-10">
                  <tr className="border-b border-muted">
                    <th className="w-10 px-4 py-2.5 text-left">
                      <IndeterminateCheckbox
                        aria-label={gt(
                          'graphExplorer.processor.toggleAllEntitiesInView',
                          'Include or exclude all entities in current view'
                        )}
                        checked={
                          displayNodes.length > 0 &&
                          displayNodes.every((n) => !excludedNodeIds.has(n.id))
                        }
                        indeterminate={
                          displayNodes.length > 0 &&
                          displayNodes.some((n) => !excludedNodeIds.has(n.id)) &&
                          !displayNodes.every((n) => !excludedNodeIds.has(n.id))
                        }
                        onChange={() => toggleAllNodes(displayNodes)}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left">
                      <SortHeader
                        label={gt('graphExplorer.processor.label', 'Label')}
                        sortKey="label"
                        currentSort={entitySort}
                        onSort={handleEntitySort}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left">
                      <SortHeader
                        label={gt('common.type', 'Type')}
                        sortKey="type"
                        currentSort={entitySort}
                        onSort={handleEntitySort}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left hidden lg:table-cell">
                      <SortHeader
                        label={gt('graphExplorer.filter.communities', 'Community')}
                        sortKey="community_id"
                        currentSort={entitySort}
                        onSort={handleEntitySort}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left hidden xl:table-cell">
                      <SortHeader
                        label={gt('graphExplorer.inspector.connections', 'Connections')}
                        sortKey="connectionCount"
                        currentSort={entitySort}
                        onSort={handleEntitySort}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left hidden xl:table-cell">
                      <Text className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        {gt('common.description', 'Description')}
                      </Text>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayNodes.map((node) => {
                    const isExcluded = excludedNodeIds.has(node.id);
                    const ov = nodeOverrides.get(node.id);
                    const effectiveLabel = ov?.label ?? node.label;
                    const effectiveType = (ov?.type ?? node.type) as string;
                    const effectiveDesc = ov?.description ?? node.description;
                    const cfg = getEntityConfig(effectiveType);
                    const isModified = !!ov;
                    const isEditingThisNode = editingCell?.id === node.id;
                    const isMergeSelected = selectedForMerge.has(node.id);
                    const annotation = annotations.get(node.id);
                    const isAnnotationExpanded = expandedAnnotationId === node.id;
                    return (
                      <Fragment key={node.id}>
                        {/* Main row */}
                        <tr
                          onClick={() => {
                            if (isEditingThisNode) return;
                            if (mergeMode) {
                              if (!isExcluded) toggleMergeSelection(node.id);
                              return;
                            }
                            toggleNodeExclusion(node.id);
                          }}
                          className={cn(
                            'border-b border-muted/50 cursor-pointer transition-colors group',
                            isExcluded
                              ? 'bg-gray-50/80 dark:bg-gray-100/50 opacity-50'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-100/70',
                            isModified && !isExcluded && 'bg-amber-50/40 dark:bg-amber-900/10',
                            isEditingThisNode && 'bg-primary/5 dark:bg-primary/10 border-b-0',
                            isMergeSelected && !isExcluded && 'bg-blue-50/60 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700'
                          )}
                        >
                          <td className="w-10 px-4 py-2">
                            {mergeMode ? (
                              <Checkbox
                                checked={isMergeSelected}
                                disabled={isExcluded}
                                onChange={() => !isExcluded && toggleMergeSelection(node.id)}
                              />
                            ) : (
                              <Checkbox
                                checked={!isExcluded}
                                onChange={() => toggleNodeExclusion(node.id)}
                              />
                            )}
                          </td>

                          {/* Label — click pencil to open edit panel */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2 group/label">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cfg.color }}
                              />
                              <Text
                                className={cn(
                                  'text-xs font-medium',
                                  isExcluded && 'line-through',
                                  ov?.label && 'text-amber-700 dark:text-amber-400'
                                )}
                              >
                                {effectiveLabel}
                              </Text>
                              {!isExcluded && !isEditingThisNode && (
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-primary ml-auto flex-shrink-0"
                                  onClick={(e) => startEdit(e, node.id, 'label', effectiveLabel)}
                                  title="Edit label"
                                >
                                  <PiPencilSimpleBold className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {!isExcluded && !isEditingThisNode && (
                                <button
                                  className={cn(
                                    'opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0',
                                    isAnnotationExpanded || annotation
                                      ? 'opacity-100 text-primary'
                                      : 'text-gray-400 hover:text-primary'
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAnnotationRow(node.id);
                                  }}
                                  title={isAnnotationExpanded ? 'Close annotation' : 'Add tags / notes'}
                                >
                                  <PiNotePencilBold className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isEditingThisNode && editingCell.field === 'label' && (
                                <span className="text-[10px] text-primary ml-auto font-medium">editing…</span>
                              )}
                            </div>
                          </td>

                          {/* Type — inline select when editing */}
                          <td className="px-3 py-2">
                            {isEditingThisNode && editingCell.field === 'type' ? (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Select
                                  size="sm"
                                  value={editingValue}
                                  options={ENTITY_TYPE_OPTIONS}
                                  onChange={(option: { value?: string } | null) => {
                                    if (!option?.value) return;
                                    setEditingValue(option.value);
                                    setTimeout(() => commitEdit(true), 0);
                                  }}
                                  inPortal={false}
                                  className="min-w-[170px]"
                                  selectClassName="h-7 text-[11px]"
                                  dropdownClassName="!z-20"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group/type">
                                <Badge
                                  variant="flat"
                                  size="sm"
                                  className="text-[10px] font-medium cursor-pointer select-none"
                                  style={{
                                    backgroundColor: `${cfg.color}15`,
                                    color: cfg.color,
                                  }}
                                  onClick={(e: React.MouseEvent) => {
                                    if (!isExcluded) startEdit(e, node.id, 'type', effectiveType);
                                  }}
                                  title="Click to change type"
                                >
                                  {cfg.label}
                                  {!isExcluded && (
                                    <PiPencilSimpleBold className="w-2.5 h-2.5 ml-1 opacity-0 group-hover/type:opacity-70" />
                                  )}
                                </Badge>
                                {ov?.type && (
                                  <span className="text-[9px] text-amber-500 font-mono">modified</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-2 hidden lg:table-cell">
                            <Text className="text-[11px] text-gray-500">
                              {node.community_id !== null ? `Cluster ${node.community_id}` : '\u2014'}
                            </Text>
                          </td>
                          <td className="px-3 py-2 hidden xl:table-cell">
                            <Text className="text-[11px] text-gray-500 font-mono">
                              {node.connectionCount ?? 0}
                            </Text>
                          </td>

                          {/* Description — click pencil to open edit panel */}
                          <td className="px-3 py-2 hidden xl:table-cell">
                            <div className="flex items-center gap-1.5 group/desc">
                              <Text
                                className={cn(
                                  'text-[11px] text-gray-500 truncate max-w-[180px]',
                                  ov?.description && 'text-amber-600 dark:text-amber-400'
                                )}
                              >
                                {effectiveDesc ?? '—'}
                              </Text>
                              {!isExcluded && !isEditingThisNode && (
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-primary flex-shrink-0"
                                  onClick={(e) =>
                                    startEdit(e, node.id, 'description', effectiveDesc ?? '')
                                  }
                                  title="Edit description"
                                >
                                  <PiPencilSimpleBold className="w-3 h-3" />
                                </button>
                              )}
                              {isEditingThisNode && editingCell.field === 'description' && (
                                <span className="text-[10px] text-primary ml-1 font-medium">editing…</span>
                              )}
                            </div>
                          </td>

                          {/* Reset overrides button */}
                          {isModified && !isExcluded && (
                            <td className="px-2 py-2 w-8">
                              <Tooltip content="Reset all edits for this entity">
                                <button
                                  className="text-amber-400 hover:text-amber-600 transition-colors"
                                  onClick={(e) => resetNodeOverride(e, node.id)}
                                >
                                  <PiArrowCounterClockwiseBold className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                            </td>
                          )}
                        </tr>

                        {/* Edit expansion row — appears below row when editing label or description */}
                        {isEditingThisNode && editingCell.field !== 'type' && (
                          <tr className="bg-primary/5 dark:bg-primary/10">
                            <td colSpan={7} className="px-4 py-3 border-b border-primary/20">                              <div className="rounded-lg border border-primary/30 bg-gray-0 dark:bg-gray-50 shadow-sm p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize">
                                    Edit{' '}
                                    <span className="text-primary">{editingCell.field}</span>
                                    <span className="text-gray-400 font-normal ml-2 normal-case">
                                      — {node.label}
                                    </span>
                                  </Text>
                                  <button
                                    onClick={cancelEdit}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <PiXBold className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <textarea
                                  autoFocus
                                  rows={editingCell.field === 'label' ? 3 : 2}
                                  className="w-full text-sm rounded-md border border-muted focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none px-3 py-2 bg-gray-0 dark:bg-gray-50 resize-none transition-colors font-sans"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                      e.preventDefault();
                                      commitEdit(true);
                                    }
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                                <div className="flex items-center justify-between mt-2">
                                  <Text className="text-[10px] text-gray-400">
                                    ⌃ Enter to save • Esc to cancel •{' '}
                                    {editingValue.length} chars
                                  </Text>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={cancelEdit}
                                      className="text-xs h-7"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => commitEdit(true)}
                                      className="text-xs h-7 flex items-center gap-1"
                                    >
                                      <PiCheckBold className="w-3.5 h-3.5" />
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Annotation expansion row — tags, importance, notes, evidence */}
                        {isAnnotationExpanded && !isExcluded && (
                          <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                            <td colSpan={7} className="px-4 py-3 border-b border-blue-200/60 dark:border-blue-800/60">
                              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-gray-0 dark:bg-gray-50 shadow-sm p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <PiNotePencilBold className="w-3.5 h-3.5 text-blue-500" />
                                    Annotation — <span className="text-primary font-medium">{effectiveLabel}</span>
                                  </Text>
                                  <button
                                    onClick={() => toggleAnnotationRow(node.id)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <PiXBold className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Tags */}
                                <div>
                                  <label className="flex text-[10px] text-gray-500 mb-1 uppercase tracking-wider items-center gap-1">
                                    <PiTagBold className="w-3 h-3" /> Tags (comma-separated)
                                  </label>
                                  <Input
                                    size="sm"
                                    value={(annotation?.tags ?? []).join(', ')}
                                    placeholder="e.g. suspect, key-witness, reviewed"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                      const tags = e.target.value
                                        .split(',')
                                        .map((t) => t.trim())
                                        .filter(Boolean);
                                      updateAnnotation(node.id, { tags });
                                    }}
                                    className="w-full"
                                  />
                                  {(annotation?.tags ?? []).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {annotation!.tags.map((tag) => (
                                        <Badge
                                          key={tag}
                                          variant="flat"
                                          color="info"
                                          size="sm"
                                          className="text-[10px]"
                                        >
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Importance */}
                                <div>
                                  <label className="flex text-[10px] text-gray-500 mb-1 uppercase tracking-wider items-center gap-1">
                                    <PiStarBold className="w-3 h-3" /> Importance
                                  </label>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => {
                                      const filled = (annotation?.importance ?? 0) >= star;
                                      return (
                                        <button
                                          key={star}
                                          onClick={() =>
                                            updateAnnotation(node.id, {
                                              importance:
                                                annotation?.importance === star ? 0 : star,
                                            })
                                          }
                                          className="transition-colors"
                                          title={`${star} star${star > 1 ? 's' : ''}`}
                                        >
                                          {filled ? (
                                            <PiStarFill className="w-4 h-4 text-amber-400" />
                                          ) : (
                                            <PiStarBold className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                                          )}
                                        </button>
                                      );
                                    })}
                                    {(annotation?.importance ?? 0) > 0 && (
                                      <Text className="text-[10px] text-gray-400 ml-1">
                                        {annotation!.importance}/5
                                      </Text>
                                    )}
                                  </div>
                                </div>

                                {/* Notes */}
                                <div>
                                  <label className="flex text-[10px] text-gray-500 mb-1 uppercase tracking-wider items-center gap-1">
                                    <PiBookOpenBold className="w-3 h-3" /> Notes
                                  </label>
                                  <textarea
                                    rows={2}
                                    className="w-full text-xs rounded-md border border-muted focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none px-3 py-2 bg-gray-0 dark:bg-gray-50 resize-none transition-colors font-sans"
                                    placeholder="Free-form notes about this entity…"
                                    value={annotation?.notes ?? ''}
                                    onChange={(e) =>
                                      updateAnnotation(node.id, { notes: e.target.value })
                                    }
                                  />
                                </div>

                                {/* Evidence — direct connections */}
                                {(() => {
                                  const connections = transformedBaseData.links.filter((l) => {
                                    const src =
                                      typeof l.source === 'string' ? l.source : l.source.id;
                                    const tgt =
                                      typeof l.target === 'string' ? l.target : l.target.id;
                                    return src === node.id || tgt === node.id;
                                  });
                                  if (connections.length === 0) return null;
                                  return (
                                    <div>
                                      <label className="flex text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider items-center gap-1">
                                        <PiLinkSimpleBold className="w-3 h-3" /> Evidence ({connections.length} connection{connections.length > 1 ? 's' : ''})
                                      </label>
                                      <div className="space-y-1 max-h-32 overflow-auto pr-1">
                                        {connections.slice(0, 10).map((l) => {
                                          const src =
                                            typeof l.source === 'string' ? l.source : l.source.id;
                                          const isSource = src === node.id;
                                          const otherId = isSource
                                            ? (typeof l.target === 'string' ? l.target : l.target.id)
                                            : src;
                                          const otherLabel = getNodeLabel(otherId);
                                          const relCfg = getRelationConfig(l.relation);
                                          return (
                                            <div
                                              key={l.id}
                                              className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-400"
                                            >
                                              {isSource ? (
                                                <PiArrowRightBold className="w-3 h-3 text-primary flex-shrink-0" />
                                              ) : (
                                                <PiArrowRightBold className="w-3 h-3 text-gray-400 flex-shrink-0 rotate-180" />
                                              )}
                                              <Badge
                                                variant="flat"
                                                size="sm"
                                                style={{
                                                  backgroundColor: `${relCfg.color}20`,
                                                  color: relCfg.color,
                                                  fontSize: '9px',
                                                }}
                                              >
                                                {relCfg.label}
                                              </Badge>
                                              <span className="font-medium truncate">{otherLabel}</span>
                                            </div>
                                          );
                                        })}
                                        {connections.length > 10 && (
                                          <Text className="text-[10px] text-gray-400">
                                            +{connections.length - 10} more connections
                                          </Text>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>

              {displayNodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <PiTableBold className="h-8 w-8 mb-2" />
                  <Text className="text-sm">{gt('graphExplorer.processor.noEntitiesMatch', 'No entities match your search')}</Text>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Relationships Tab ------------------------------------------ */}
        {activeTab === 'relationships' && (
          <div className="flex flex-col h-full">
            {/* Search & bulk actions */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-muted bg-gray-50/50 dark:bg-gray-100/50">
              <Input
                placeholder={gt('graphExplorer.processor.searchRelationships', 'Search by relation type, source, target...')}
                value={linkSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLinkSearch(e.target.value)
                }
                prefix={
                  <PiMagnifyingGlassBold className="w-3.5 h-3.5 text-gray-400" />
                }
                suffix={
                  linkSearch ? (
                    <button
                      onClick={() => setLinkSearch('')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <PiXBold className="w-3 h-3" />
                    </button>
                  ) : null
                }
                size="sm"
                className="flex-1 max-w-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-[10px]"
                  disabled={displayLinks.length === 0}
                  onClick={() => includeAllDisplayedLinks(displayLinks)}
                >
                  {gt('graphExplorer.processor.includeAllShown', 'Include all')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-[10px]"
                  disabled={displayLinks.length === 0}
                  onClick={() => excludeAllDisplayedLinks(displayLinks)}
                >
                  {gt('graphExplorer.processor.excludeAllShown', 'Exclude all')}
                </Button>
                <Text className="text-[10px] text-gray-400">
                  {displayLinks.length} {gt('graphExplorer.processor.shown', 'shown')}
                </Text>
                <Button
                  size="sm"
                  variant={showAddRelationForm ? 'solid' : 'outline'}
                  onClick={() => setShowAddRelationForm((v) => !v)}
                  className={cn('flex items-center gap-1.5 h-7 ml-2', showAddRelationForm && 'text-white')}
                >
                  <PiPlusBold className="w-3.5 h-3.5" />
                  {gt('graphExplorer.processor.addRelation', 'Add Relation')}
                </Button>
              </div>
            </div>

            {/* Add Relation form */}
            {showAddRelationForm && (
              <div className="border-b border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/20 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <PiLinkSimpleBold className="w-3.5 h-3.5 text-blue-500" />
                    {gt('graphExplorer.processor.addManualRelationship', 'Add Manual Relationship')}
                  </Text>
                  <button
                    onClick={() => setShowAddRelationForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <PiXBold className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">{gt('graphExplorer.processor.sourceEntityRequired', 'Source Entity *')}</label>
                    <Select
                      size="sm"
                      value={newRelationForm.sourceId || null}
                      options={processedData.nodes.map((n) => ({ value: n.id, label: n.label }))}
                      placeholder={gt('graphExplorer.processor.selectSource', 'Select source…')}
                      onChange={(opt: { value?: string } | null) =>
                        setNewRelationForm((f) => ({ ...f, sourceId: opt?.value ?? '' }))
                      }
                      inPortal={false}
                      selectClassName="h-8 text-xs"
                      dropdownClassName="!z-20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">{gt('graphExplorer.processor.relationTypeRequired', 'Relation Type *')}</label>
                    <Select
                      size="sm"
                      value={newRelationForm.relation || null}
                      options={relationTypeOptions}
                      placeholder={gt('graphExplorer.processor.selectType', 'Select type…')}
                      onChange={(opt: { value?: string } | null) =>
                        setNewRelationForm((f) => ({ ...f, relation: opt?.value ?? 'KNOWS' }))
                      }
                      inPortal={false}
                      selectClassName="h-8 text-xs"
                      dropdownClassName="!z-20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">{gt('graphExplorer.processor.targetEntityRequired', 'Target Entity *')}</label>
                    <Select
                      size="sm"
                      value={newRelationForm.targetId || null}
                      options={processedData.nodes
                        .filter((n) => n.id !== newRelationForm.sourceId)
                        .map((n) => ({ value: n.id, label: n.label }))}
                      placeholder={gt('graphExplorer.processor.selectTarget', 'Select target…')}
                      onChange={(opt: { value?: string } | null) =>
                        setNewRelationForm((f) => ({ ...f, targetId: opt?.value ?? '' }))
                      }
                      inPortal={false}
                      selectClassName="h-8 text-xs"
                      dropdownClassName="!z-20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">{gt('graphExplorer.processor.strengthRange', 'Strength (1–10)')}</label>
                    <Input
                      type="number"
                      size="sm"
                      min={1}
                      max={10}
                      value={newRelationForm.strength}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewRelationForm((f) => ({
                          ...f,
                          strength: Math.min(10, Math.max(1, Number(e.target.value))),
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      size="sm"
                      placeholder={gt('graphExplorer.processor.descriptionOptional', 'Description (optional)')}
                      value={newRelationForm.description}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewRelationForm((f) => ({ ...f, description: e.target.value }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddManualLink}
                    className="flex items-center gap-1.5 h-8"
                    disabled={!newRelationForm.sourceId || !newRelationForm.targetId}
                  >
                    <PiCheckBold className="w-3.5 h-3.5" />
                    {gt('common.create', 'Add')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddRelationForm(false)}
                    className="h-8"
                  >
                    {gt('common.cancel', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-auto max-h-[calc(100vh-430px)] min-h-[420px]">
              {rawData.links.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <PiArrowsLeftRightBold className="h-10 w-10 mb-3" />
                  <Title
                    as="h5"
                    className="text-sm font-medium text-gray-500 mb-1"
                  >
                    {gt('graphExplorer.processor.noRelationshipsFound', 'No Relationships Found')}
                  </Title>
                  <Text className="text-xs text-gray-400 text-center max-w-xs">
                    {gt(
                      'graphExplorer.processor.noRelationshipsHint',
                      'Your data does not contain any relationships yet. Relationships define how entities are connected in the graph.'
                    )}
                  </Text>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-100 z-10">
                    <tr className="border-b border-muted">
                      <th className="w-10 px-4 py-2.5 text-left">
                        <IndeterminateCheckbox
                          aria-label={gt(
                            'graphExplorer.processor.toggleAllRelationshipsInView',
                            'Include or exclude all relationships in current view'
                          )}
                          checked={
                            displayLinks.length > 0 &&
                            displayLinks.every((l) => !excludedLinkIds.has(l.id))
                          }
                          indeterminate={
                            displayLinks.length > 0 &&
                            displayLinks.some((l) => !excludedLinkIds.has(l.id)) &&
                            !displayLinks.every((l) => !excludedLinkIds.has(l.id))
                          }
                          onChange={() => toggleAllLinks(displayLinks)}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left">
                        <SortHeader
                          label={gt('graphExplorer.processor.linkSourceColumn', 'Source')}
                          sortKey="source"
                          currentSort={linkSort}
                          onSort={handleLinkSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left">
                        <SortHeader
                          label={gt('graphExplorer.processor.linkRelationColumn', 'Relation')}
                          sortKey="relation"
                          currentSort={linkSort}
                          onSort={handleLinkSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left">
                        <SortHeader
                          label={gt('graphExplorer.processor.linkTargetColumn', 'Target')}
                          sortKey="target"
                          currentSort={linkSort}
                          onSort={handleLinkSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left hidden lg:table-cell">
                        <SortHeader
                          label={gt('graphExplorer.processor.linkStrengthColumn', 'Strength')}
                          sortKey="strength"
                          currentSort={linkSort}
                          onSort={handleLinkSort}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayLinks.map((link) => {
                      const isExcluded = excludedLinkIds.has(link.id);
                      const lov = linkOverrides.get(link.id);
                      const effectiveRelation = lov?.relation ?? link.relation;
                      const cfg = getRelationConfig(effectiveRelation);
                      const srcLabel = getNodeLabel(link.source);
                      const tgtLabel = getNodeLabel(link.target);
                      const isModifiedLink = !!lov;
                      // WHY: manual links have an 'origin' field set to 'manual'
                      const isManualLink = (link as GraphLink & { origin?: string }).origin === 'manual' || link.id.startsWith('manual_') || link.id.includes('_merge_') || link.id.includes('_dup_');
                      return (
                        <tr
                          key={link.id}
                          onClick={() => {
                            if (editingCell?.id === link.id) return;
                            if (isManualLink) return; // manual links use delete button, not checkbox toggle
                            toggleLinkExclusion(link.id);
                          }}
                          className={cn(
                            'border-b border-muted/50 cursor-pointer transition-colors group',
                            isExcluded
                              ? 'bg-gray-50/80 dark:bg-gray-100/50 opacity-50'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-100/70',
                            isModifiedLink && !isExcluded && 'bg-amber-50/40 dark:bg-amber-900/10',
                            isManualLink && !isExcluded && 'bg-green-50/40 dark:bg-green-900/10'
                          )}
                        >
                          <td className="w-10 px-4 py-2">
                            {isManualLink ? (
                              <Tooltip content="Remove this manually-added relationship">
                                <ActionIcon
                                  variant="text"
                                  size="sm"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleRemoveManualLink(link.id);
                                  }}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <PiTrashBold className="w-3.5 h-3.5" />
                                </ActionIcon>
                              </Tooltip>
                            ) : (
                              <Checkbox
                                checked={!isExcluded}
                                onChange={() => toggleLinkExclusion(link.id)}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              {isManualLink && (
                                <Badge variant="flat" color="success" size="sm" className="text-[9px] px-1 flex-shrink-0">
                                  manual
                                </Badge>
                              )}
                              <Text
                                className={cn(
                                  'text-xs font-medium',
                                  isExcluded && 'line-through'
                                )}
                              >
                                {srcLabel}
                              </Text>
                            </div>
                          </td>

                          {/* Relation — editable via select */}
                          <td className="px-3 py-2">
                            {editingCell?.id === link.id && editingCell.field === 'relation' ? (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Select
                                  size="sm"
                                  value={editingValue}
                                  options={relationTypeOptions}
                                  onChange={(option: { value?: string } | null) => {
                                    if (!option?.value) return;
                                    setEditingValue(option.value);
                                    setTimeout(() => commitEdit(false), 0);
                                  }}
                                  inPortal={false}
                                  className="min-w-[180px]"
                                  selectClassName="h-7 text-[11px]"
                                  dropdownClassName="!z-20"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group/rel">
                                <Badge
                                  variant="flat"
                                  size="sm"
                                  className="text-[10px] font-medium cursor-pointer"
                                  style={{
                                    backgroundColor: `${cfg.color}15`,
                                    color: cfg.color,
                                  }}
                                  onClick={(e: React.MouseEvent) =>
                                    !isExcluded && startEdit(e, link.id, 'relation', effectiveRelation)
                                  }
                                  title="Click to change relation type"
                                >
                                  {cfg.label}
                                  {!isExcluded && (
                                    <PiPencilSimpleBold className="w-2.5 h-2.5 ml-1 opacity-0 group-hover/rel:opacity-70" />
                                  )}
                                </Badge>
                                {isModifiedLink && lov?.relation && (
                                  <Tooltip content="Reset relation edit">
                                    <button
                                      className="text-amber-400 hover:text-amber-600 transition-colors"
                                      onClick={(e) => resetLinkOverride(e, link.id)}
                                    >
                                      <PiArrowCounterClockwiseBold className="w-3 h-3" />
                                    </button>
                                  </Tooltip>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-2">
                            <Text
                              className={cn(
                                'text-xs font-medium',
                                isExcluded && 'line-through'
                              )}
                            >
                              {tgtLabel}
                            </Text>
                          </td>
                          <td className="px-3 py-2 hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-300 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{
                                    width: `${Math.min((link.strength / 10) * 100, 100)}%`,
                                  }}
                                />
                              </div>
                              <Text className="text-[10px] text-gray-500 font-mono">
                                {link.strength}
                              </Text>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {rawData.links.length > 0 && displayLinks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <PiArrowsLeftRightBold className="h-8 w-8 mb-2" />
                  <Text className="text-sm">
                    {gt('graphExplorer.processor.noRelationshipsMatch', 'No relationships match your search')}
                  </Text>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Filters Tab ------------------------------------------------ */}
        {activeTab === 'filters' && (
          <div className="p-4 h-full min-h-[560px] overflow-auto">
            {/* Filter header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PiFunnelBold className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <Title as="h5" className="text-sm font-semibold">
                  {gt('graphExplorer.processor.advancedFilterRules', 'Advanced Filter Rules')}
                </Title>
                {filterRules.length > 0 && (
                  <Badge variant="flat" color="secondary" size="sm">
                    {filterRules.filter((r) => r.enabled).length} active
                  </Badge>
                )}
                <Tooltip
                  content="Add rules to filter nodes and links by field values. Rules are combined with AND logic."
                  placement="right"
                >
                  <PiInfoBold className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRule('nodes')}
                  className="flex items-center gap-1.5"
                >
                  <PiPlusBold className="h-3 w-3" />
                  {gt('graphExplorer.processor.nodeFilter', 'Node Filter')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddRule('links')}
                  className="flex items-center gap-1.5"
                >
                  <PiPlusBold className="h-3 w-3" />
                  {gt('graphExplorer.processor.linkFilter', 'Link Filter')}
                </Button>
                {filterRules.length > 0 && (
                  <Button
                    variant="text"
                    size="sm"
                    onClick={() => {
                      setFilterRules([]);
                      toast.success(gt('graphExplorer.processor.toast.filtersCleared', 'Filters cleared'));
                    }}
                    className="text-red-500"
                  >
                    <PiTrashBold className="h-3 w-3 mr-1" />
                    {gt('common.clear', 'Clear')}
                  </Button>
                )}
              </div>
            </div>

            {/* Filter rules list */}
            {filterRules.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
                <PiFunnelBold className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                <Title
                  as="h5"
                  className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  {gt('graphExplorer.processor.noFilterRules', 'No Filter Rules')}
                </Title>
                <Text className="text-xs text-gray-400 mb-4">
                  {gt(
                    'graphExplorer.processor.addFilterRulesHint',
                    'Add filter rules to programmatically include/exclude nodes and links'
                  )}
                </Text>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddRule('nodes')}
                  >
                    <PiPlusBold className="h-3 w-3 mr-1" /> {gt('graphExplorer.processor.addNodeFilter', 'Add Node Filter')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddRule('links')}
                  >
                    <PiPlusBold className="h-3 w-3 mr-1" /> {gt('graphExplorer.processor.addLinkFilter', 'Add Link Filter')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filterRules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className={cn(
                      'flex flex-wrap items-center gap-2 rounded-lg border p-3 transition-all',
                      rule.enabled
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-0 dark:bg-gray-50'
                        : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-100 opacity-60'
                    )}
                  >
                    {/* Row number + checkbox */}
                    <div className="flex items-center gap-2">
                      <Text className="text-[10px] text-gray-400 font-mono w-4">
                        {index + 1}
                      </Text>
                      <Checkbox
                        checked={rule.enabled}
                        onChange={() =>
                          handleUpdateRule(rule.id, 'enabled', !rule.enabled)
                        }
                      />
                    </div>

                    {/* Target badge */}
                    <Badge
                      variant="flat"
                      color={rule.target === 'nodes' ? 'info' : 'warning'}
                      size="sm"
                      className="flex-shrink-0"
                    >
                      {rule.target === 'nodes' ? 'Node' : 'Link'}
                    </Badge>

                    {/* Field */}
                    <Input
                      value={rule.field}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleUpdateRule(rule.id, 'field', e.target.value)
                      }
                      placeholder={
                        rule.target === 'nodes'
                          ? 'type, label, id...'
                          : 'relation, strength...'
                      }
                      className="w-32 flex-shrink-0"
                      size="sm"
                    />

                    {/* Operator */}
                    <Select
                      size="sm"
                      value={rule.operator}
                      options={[
                        { value: 'equals', label: 'Equals (=)' },
                        { value: 'not_equals', label: 'Not Equals (!=)' },
                        { value: 'contains', label: 'Contains' },
                        { value: 'not_contains', label: 'Not Contains' },
                        { value: 'regex', label: 'Regex' },
                        { value: 'greater_than', label: 'Greater Than (>)' },
                        { value: 'less_than', label: 'Less Than (<)' },
                        { value: 'exists', label: 'Exists' },
                        { value: 'not_exists', label: 'Not Exists' },
                      ]}
                      onChange={(option: { value?: string } | null) => {
                        if (!option?.value) return;
                        handleUpdateRule(rule.id, 'operator', option.value as FilterOperator);
                      }}
                      inPortal={false}
                      className="min-w-[170px]"
                      selectClassName="h-8 text-xs"
                      dropdownClassName="!z-20"
                    />

                    {/* Value */}
                    {!['exists', 'not_exists'].includes(rule.operator) && (
                      <Input
                        value={rule.value}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateRule(rule.id, 'value', e.target.value)
                        }
                        placeholder="Value..."
                        className="flex-1 min-w-[120px]"
                        size="sm"
                      />
                    )}

                    {/* Remove */}
                    <ActionIcon
                      variant="text"
                      size="sm"
                      onClick={() => handleRemoveRule(rule.id)}
                      className="flex-shrink-0 text-gray-400 hover:text-red-500"
                    >
                      <PiTrashBold className="h-3.5 w-3.5" />
                    </ActionIcon>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- Transform Tab ---------------------------------------------- */}
        {activeTab === 'transform' && (
          <div className="p-4 h-full min-h-[560px] overflow-auto space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <PiArrowsSplitBold className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <Title as="h5" className="text-sm font-semibold">
                    {gt('graphExplorer.processor.dataTransformationRules', 'Data Transformation Rules')}
                  </Title>
                  {activeTransformRules > 0 && (
                    <Badge variant="flat" color="warning" size="sm">
                      {activeTransformRules} active
                    </Badge>
                  )}
                </div>
                <Text className="text-[11px] text-gray-500 max-w-2xl">
                  Apply pattern-based rules to modify entity labels, change types, or split
                  entities before visualization. Rules are applied in order to the raw data
                  — before any manual edits or exclusions.
                </Text>
              </div>
              {/* Add rule dropdown */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1.5"
                  onClick={() => setShowRegexGuide((prev) => !prev)}
                >
                  <PiInfoBold className="h-3 w-3" />
                  {gt('graphExplorer.processor.regexGuide', 'Regex Guide')}
                  {showRegexGuide ? (
                    <PiCaretUpBold className="h-2.5 w-2.5" />
                  ) : (
                    <PiCaretDownBold className="h-2.5 w-2.5" />
                  )}
                </Button>
                <div className="relative" ref={transformMenuRef}>
                  <Button
                    size="sm"
                    className="flex items-center gap-1.5"
                    onClick={() => setIsTransformMenuOpen((prev) => !prev)}
                  >
                    <PiPlusBold className="h-3 w-3" />
                    {gt('graphExplorer.processor.addRule', 'Add Rule')}
                    {isTransformMenuOpen ? (
                      <PiCaretUpBold className="h-2.5 w-2.5" />
                    ) : (
                      <PiCaretDownBold className="h-2.5 w-2.5" />
                    )}
                  </Button>
                  <div
                    className={cn(
                      'absolute right-0 top-full mt-1 z-20 bg-gray-0 dark:bg-gray-50 border border-muted rounded-lg shadow-lg min-w-[180px] py-1 overflow-hidden',
                      isTransformMenuOpen ? 'block' : 'hidden'
                    )}
                  >
                    <button
                      onClick={() => {
                        handleAddTransformRule('retype');
                        setIsTransformMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-100 transition-colors text-left"
                    >
                      <PiTagBold className="w-3.5 h-3.5 text-blue-500" />
                      <span>
                        <strong className="block">Retype</strong>
                        <span className="text-gray-400">Change type by label pattern</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        handleAddTransformRule('replace_label');
                        setIsTransformMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-100 transition-colors text-left"
                    >
                      <PiCodeBold className="w-3.5 h-3.5 text-green-500" />
                      <span>
                        <strong className="block">Replace in Label</strong>
                        <span className="text-gray-400">Find &amp; replace text/regex</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        handleAddTransformRule('split');
                        setIsTransformMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-100 transition-colors text-left"
                    >
                      <PiLightningBold className="w-3.5 h-3.5 text-orange-500" />
                      <span>
                        <strong className="block">Split on Delimiter</strong>
                        <span className="text-gray-400">Create entities from parts</span>
                      </span>
                    </button>
                  </div>
                </div>
                {transformRules.length > 0 && (
                  <Button
                    variant="text"
                    size="sm"
                    onClick={() => {
                      setTransformRules([]);
                      toast.success(gt('graphExplorer.processor.toast.allTransformRulesRemoved', 'All transform rules removed'));
                    }}
                    className="text-red-500"
                  >
                    <PiTrashBold className="h-3 w-3 mr-1" />
                    {gt('common.clearAll', 'Clear All')}
                  </Button>
                )}
              </div>
            </div>

            {showRegexGuide && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-3">
                <Text className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                  {gt('graphExplorer.processor.regexQuickGuide', 'Regex Quick Guide')}
                </Text>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-blue-200/70 dark:border-blue-700/70 bg-gray-0 dark:bg-gray-50 p-2">
                    <Text className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Match any of words</Text>
                    <Text className="text-[11px] font-mono text-gray-600 dark:text-gray-400">Jackson|Mike|Peter</Text>
                  </div>
                  <div className="rounded-md border border-blue-200/70 dark:border-blue-700/70 bg-gray-0 dark:bg-gray-50 p-2">
                    <Text className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Starts with &quot;Mr&quot;</Text>
                    <Text className="text-[11px] font-mono text-gray-600 dark:text-gray-400">^Mr\.</Text>
                  </div>
                  <div className="rounded-md border border-blue-200/70 dark:border-blue-700/70 bg-gray-0 dark:bg-gray-50 p-2">
                    <Text className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Ends with number</Text>
                    <Text className="text-[11px] font-mono text-gray-600 dark:text-gray-400">\d+$</Text>
                  </div>
                  <div className="rounded-md border border-blue-200/70 dark:border-blue-700/70 bg-gray-0 dark:bg-gray-50 p-2">
                    <Text className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Case-insensitive flag</Text>
                    <Text className="text-[11px] text-gray-600 dark:text-gray-400">Use flag <strong>i</strong> (example: company + i)</Text>
                  </div>
                </div>
              </div>
            )}

            {/* Rules list */}
            {transformRules.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
                <PiArrowsSplitBold className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                <Title as="h5" className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {gt('graphExplorer.processor.noTransformRules', 'No Transform Rules')}
                </Title>
                <Text className="text-xs text-gray-400 mb-4 max-w-sm mx-auto">
                  {gt(
                    'graphExplorer.processor.noTransformRulesHint',
                    'Add rules to automatically retype, rename, or split entities before visualization. For example: classify entities matching "Company" as "organization", or split long labels on "."'
                  )}
                </Text>
              </div>
            ) : (
              <div className="space-y-3">
                {transformRules.map((rule, index) => {
                  // Live preview: count how many rawData nodes this rule would affect
                  let affectedCount = 0;
                  let previewError: string | null = null;
                  try {
                    if (rule.type === 'retype' && rule.pattern) {
                      const re = new RegExp(rule.pattern, rule.patternFlags ?? 'i');
                      affectedCount = rawData.nodes.filter((n) => re.test(n.label)).length;
                    } else if (rule.type === 'replace_label' && rule.findText) {
                      if (rule.useRegex) {
                        const re = new RegExp(rule.findText, 'gi');
                        affectedCount = rawData.nodes.filter((n) => re.test(n.label)).length;
                      } else {
                        affectedCount = rawData.nodes.filter((n) =>
                          n.label.includes(rule.findText!)
                        ).length;
                      }
                    } else if (rule.type === 'split' && rule.delimiter) {
                      affectedCount = rawData.nodes.filter((n) =>
                        n.label.includes(rule.delimiter!)
                      ).length;
                    }
                  } catch {
                    previewError = 'Invalid regex pattern';
                  }

                  return (
                    <div
                      key={rule.id}
                      className={cn(
                        'rounded-lg border p-4 transition-all',
                        rule.enabled
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-0 dark:bg-gray-50'
                          : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-100 opacity-60'
                      )}
                    >
                      {/* Rule header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Text className="text-[10px] text-gray-400 font-mono w-4">{index + 1}</Text>
                          <Checkbox
                            checked={rule.enabled}
                            onChange={() =>
                              handleUpdateTransformRule(rule.id, 'enabled', !rule.enabled)
                            }
                          />
                          <Badge
                            variant="flat"
                            color={
                              rule.type === 'retype'
                                ? 'info'
                                : rule.type === 'replace_label'
                                  ? 'success'
                                  : 'warning'
                            }
                            size="sm"
                            className="text-[10px] capitalize"
                          >
                            {rule.type === 'retype'
                              ? 'Retype'
                              : rule.type === 'replace_label'
                                ? 'Replace Label'
                                : 'Split'}
                          </Badge>
                          {/* Affected count preview */}
                          {rule.enabled && !previewError && (
                            <span
                              className={cn(
                                'text-[10px] font-mono',
                                affectedCount > 0
                                  ? 'text-orange-500'
                                  : 'text-gray-400'
                              )}
                            >
                              {affectedCount > 0
                                ? `${affectedCount} entities affected`
                                : 'No matches yet'}
                            </span>
                          )}
                          {previewError && (
                            <span className="text-[10px] text-red-400">{previewError}</span>
                          )}
                        </div>
                        <ActionIcon
                          variant="text"
                          size="sm"
                          onClick={() => handleRemoveTransformRule(rule.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <PiTrashBold className="h-3.5 w-3.5" />
                        </ActionIcon>
                      </div>

                      {/* Rule fields */}
                      <div className="flex flex-wrap gap-3 items-end">
                        {/* Retype rule fields */}
                        {rule.type === 'retype' && (
                          <>
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                                Label matches pattern *
                              </label>
                              <Input
                                value={rule.pattern ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  handleUpdateTransformRule(rule.id, 'pattern', e.target.value)
                                }
                                placeholder="e.g. Jackson|Mike|Peter"
                                size="sm"
                              />
                            </div>
                            <div className="w-32">
                              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                                Regex flags
                              </label>
                              <Input
                                value={rule.patternFlags ?? 'i'}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  handleUpdateTransformRule(rule.id, 'patternFlags', e.target.value)
                                }
                                placeholder="i"
                                size="sm"
                              />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                                {gt('graphExplorer.processor.transformChangeTypeToRequired', 'Change type to *')}
                              </label>
                              <Select
                                size="sm"
                                value={rule.newType ?? null}
                                options={ENTITY_TYPE_OPTIONS}
                                placeholder={gt('graphExplorer.processor.selectType', 'Select type…')}
                                onChange={(option: { value?: string } | null) => {
                                  if (!option?.value) return;
                                  handleUpdateTransformRule(rule.id, 'newType', option.value);
                                }}
                                inPortal={false}
                                selectClassName="h-8 text-xs"
                                dropdownClassName="!z-20"
                              />
                            </div>
                          </>
                        )}

                        {/* Replace label rule fields */}
                        {rule.type === 'replace_label' && (
                          <>
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                                Find *
                              </label>
                              <Input
                                value={rule.findText ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  handleUpdateTransformRule(rule.id, 'findText', e.target.value)
                                }
                                placeholder={rule.useRegex ? 'e.g. Mike\\w+' : 'Text to find'}
                                size="sm"
                              />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                                Replace with
                              </label>
                              <Input
                                value={rule.replaceText ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  handleUpdateTransformRule(rule.id, 'replaceText', e.target.value)
                                }
                                placeholder="Replacement (empty to delete)"
                                size="sm"
                              />
                            </div>
                            <div className="flex items-center gap-1.5 pb-1">
                              <input
                                type="checkbox"
                                id={`regex-${rule.id}`}
                                checked={rule.useRegex ?? false}
                                onChange={(e) =>
                                  handleUpdateTransformRule(rule.id, 'useRegex', e.target.checked)
                                }
                                className="w-3.5 h-3.5 accent-primary"
                              />
                              <label
                                htmlFor={`regex-${rule.id}`}
                                className="text-[11px] text-gray-500 cursor-pointer select-none"
                              >
                                Use regex
                              </label>
                            </div>
                          </>
                        )}

                        {/* Split rule fields */}
                        {rule.type === 'split' && (
                          <>
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                                Split delimiter *
                              </label>
                              <Input
                                value={rule.delimiter ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  handleUpdateTransformRule(rule.id, 'delimiter', e.target.value)
                                }
                                placeholder="e.g. .  or  ,  or  and"
                                size="sm"
                              />
                            </div>
                            <div className="text-[10px] text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md px-3 py-2 self-end">
                              ⚠ Split creates new entity IDs. Manual exclusions will reset.
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Result summary */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-3 flex items-center gap-3">
                  <PiCheckCircleBold className="h-4 w-4 text-primary flex-shrink-0" />
                  <Text className="text-xs text-gray-700 dark:text-gray-300">
                    After transforms:{' '}
                    <strong className="text-gray-900 dark:text-gray-100">
                      {transformedBaseData.nodes.length}
                    </strong>{' '}
                    entities,{' '}
                    <strong className="text-gray-900 dark:text-gray-100">
                      {transformedBaseData.links.length}
                    </strong>{' '}
                    relationships
                    {transformedBaseData.nodes.length !== rawData.nodes.length && (
                      <span className="text-orange-500 ml-2">
                        ({transformedBaseData.nodes.length > rawData.nodes.length ? '+' : ''}
                        {transformedBaseData.nodes.length - rawData.nodes.length} vs original)
                      </span>
                    )}
                  </Text>
                </div>
              </div>
            )}
          </div>
        )}
          </div>
        )}

        {showEditPanel && showPreviewPanel && isWideLayout && (
          <button
            type="button"
            onMouseDown={startPreviewResize}
            className={cn(
              'w-2 flex-shrink-0 bg-gray-50 dark:bg-gray-100 border-x border-muted transition-colors cursor-col-resize',
              isResizingPreview ? 'bg-primary/20' : 'hover:bg-primary/10'
            )}
            aria-label="Resize preview panel"
            title="Drag to resize preview"
          >
            <span className="mx-auto block h-10 w-[2px] rounded-full bg-gray-300 dark:bg-gray-600" />
          </button>
        )}

        {showPreviewPanel && (
          <div
            className="min-w-0 flex flex-col bg-gray-50/40 dark:bg-gray-100/30"
            style={
              showEditPanel && isWideLayout
                ? { width: `${previewWidthPercent}%` }
                : { width: '100%' }
            }
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-muted">
              <div className="flex items-center gap-2">
                <PiGraphBold className="w-4 h-4 text-primary" />
                <Title as="h6" className="text-sm font-semibold">
                  {gt('graphExplorer.processor.livePreview', 'Live Preview')}
                </Title>
                <Badge variant="flat" color="primary" size="sm">
                  {gt('graphExplorer.processor.finalOutput', 'final output')}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                {showEditPanel && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={openPreviewOnly}>
                    {gt('graphExplorer.processor.focusPreview', 'Focus Preview')}
                  </Button>
                )}
                {!showEditPanel && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setShowEditPanel(true)}>
                    {gt('graphExplorer.processor.showEdit', 'Show Edit')}
                  </Button>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3 overflow-auto max-h-[calc(100vh-360px)] min-h-[320px]">
              <div className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
                <button
                  className="w-full px-3 py-2 flex items-center justify-between"
                  onClick={() => togglePreviewSection('summary')}
                >
                  <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">{gt('graphExplorer.processor.graphSummary', 'Graph Summary')}</Text>
                  {previewSections.summary ? <PiCaretUpBold className="w-3.5 h-3.5" /> : <PiCaretDownBold className="w-3.5 h-3.5" />}
                </button>
                {previewSections.summary && (
                  <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-muted px-2.5 py-2">
                      <Text className="text-[10px] text-gray-500">{gt('graphExplorer.stats.nodes', 'Nodes')}</Text>
                      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {processedData.nodes.length}
                      </Text>
                    </div>
                    <div className="rounded-md border border-muted px-2.5 py-2">
                      <Text className="text-[10px] text-gray-500">{gt('graphExplorer.stats.edges', 'Links')}</Text>
                      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {processedData.links.length}
                      </Text>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
                <button
                  className="w-full px-3 py-2 flex items-center justify-between"
                  onClick={() => togglePreviewSection('changes')}
                >
                  <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">{gt('graphExplorer.processor.changesOverview', 'Changes Overview')}</Text>
                  {previewSections.changes ? <PiCaretUpBold className="w-3.5 h-3.5" /> : <PiCaretDownBold className="w-3.5 h-3.5" />}
                </button>
                {previewSections.changes && (
                  <div className="px-3 pb-3 space-y-1.5">
                    <Text className="text-[11px] text-gray-600 dark:text-gray-400">
                      Edited entities: <strong>{nodeOverrides.size}</strong>
                    </Text>
                    <Text className="text-[11px] text-gray-600 dark:text-gray-400">
                      Edited relationships: <strong>{linkOverrides.size}</strong>
                    </Text>
                    <Text className="text-[11px] text-gray-600 dark:text-gray-400">
                      Excluded nodes: <strong>{excludedNodeIds.size}</strong>
                    </Text>
                    <Text className="text-[11px] text-gray-600 dark:text-gray-400">
                      Excluded links: <strong>{excludedLinkIds.size}</strong>
                    </Text>
                    {manualLinks.length > 0 && (
                      <Text className="text-[11px] text-green-600 dark:text-green-400">
                        Manual relationships: <strong>{manualLinks.length}</strong>
                      </Text>
                    )}
                    {annotations.size > 0 && (
                      <Text className="text-[11px] text-blue-600 dark:text-blue-400">
                        Annotated entities: <strong>{annotations.size}</strong>
                      </Text>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
                <button
                  className="w-full px-3 py-2 flex items-center justify-between"
                  onClick={() => togglePreviewSection('sample')}
                >
                  <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {activeTab === 'relationships' ? 'Sample Relationships' : 'Sample Entities'}
                  </Text>
                  {previewSections.sample ? <PiCaretUpBold className="w-3.5 h-3.5" /> : <PiCaretDownBold className="w-3.5 h-3.5" />}
                </button>
                {previewSections.sample && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {activeTab === 'relationships'
                      ? processedData.links.slice(0, 6).map((link) => (
                          <div key={link.id} className="rounded-md border border-muted px-2 py-1.5 text-[11px]">
                            <strong>{getNodeLabel(link.source)}</strong>
                            <span className="text-gray-400 mx-1">→</span>
                            <span>{getRelationConfig(link.relation).label}</span>
                            <span className="text-gray-400 mx-1">→</span>
                            <strong>{getNodeLabel(link.target)}</strong>
                          </div>
                        ))
                      : processedData.nodes.slice(0, 6).map((node) => {
                          const cfg = getEntityConfig(node.type as EntityType);
                          return (
                            <div key={node.id} className="rounded-md border border-muted px-2 py-1.5 flex items-center justify-between gap-2">
                              <Text className="text-[11px] truncate font-medium">{node.label}</Text>
                              <Badge variant="flat" size="sm" style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}>
                                {cfg.label}
                              </Badge>
                            </div>
                          );
                        })}
                    {((activeTab === 'relationships' && processedData.links.length === 0) ||
                      (activeTab !== 'relationships' && processedData.nodes.length === 0)) && (
                      <Text className="text-[11px] text-gray-400">No data available for preview.</Text>
                    )}
                  </div>
                )}
              </div>

              {showEditPanel && (
                <div className="pt-1">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={openEditOnly}>
                    Focus Edit Panel
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Merge Dialog ────────────────────────────────────────────────── */}
      {showMergeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-muted bg-gray-0 dark:bg-gray-50 shadow-2xl p-5 mx-4">
            <div className="flex items-center justify-between mb-4">
              <Title as="h5" className="text-sm font-semibold flex items-center gap-2">
                <PiArrowsMergeBold className="w-4 h-4 text-amber-500" />
                Merge {selectedForMerge.size} Entities
              </Title>
              <button
                onClick={() => setShowMergeDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <PiXBold className="w-4 h-4" />
              </button>
            </div>

            {/* Entities to be merged */}
            <div className="mb-4 rounded-lg border border-muted bg-gray-50 dark:bg-gray-100 p-3">
              <Text className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                Entities to merge:
              </Text>
              <div className="space-y-1">
                {Array.from(selectedForMerge).map((id) => {
                  const n = transformedBaseData.nodes.find((x) => x.id === id);
                  const ov = nodeOverrides.get(id);
                  const label = ov?.label ?? n?.label ?? id;
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="keepNode"
                        value={id}
                        checked={mergeConfig.keepNodeId === id}
                        onChange={() => setMergeConfig((c) => ({ ...c, keepNodeId: id }))}
                        className="accent-primary"
                      />
                      <Text className="text-xs font-medium">{label}</Text>
                      {mergeConfig.keepNodeId === id && (
                        <Badge variant="flat" color="success" size="sm" className="text-[9px]">keep</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              <Text className="text-[10px] text-gray-400 mt-2">
                Select which entity to keep. All links will be redirected to it.
              </Text>
            </div>

            {/* Final label */}
            <div className="mb-3">
              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                Final Label *
              </label>
              <Input
                size="sm"
                value={mergeConfig.targetLabel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setMergeConfig((c) => ({ ...c, targetLabel: e.target.value }))
                }
                placeholder="Label for the merged entity"
                autoFocus
              />
            </div>

            {/* Final type */}
            <div className="mb-4">
              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">
                Entity Type
              </label>
              <Select
                size="sm"
                value={mergeConfig.targetType}
                options={ENTITY_TYPE_OPTIONS}
                onChange={(opt: { value?: string } | null) =>
                  setMergeConfig((c) => ({ ...c, targetType: opt?.value ?? 'person' }))
                }
                inPortal={false}
                selectClassName="h-8 text-xs"
                dropdownClassName="!z-20"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowMergeDialog(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleMergeEntities}
                disabled={!mergeConfig.targetLabel.trim()}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
              >
                <PiArrowsMergeBold className="w-3.5 h-3.5" />
                Merge Entities
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom action bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-muted">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <PiCheckCircleBold className="h-4 w-4 text-green-500" />
          <span>
            Ready:{' '}
            <strong className="text-gray-900 dark:text-gray-100">
              {processedData.nodes.length}
            </strong>{' '}
            nodes and{' '}
            <strong className="text-gray-900 dark:text-gray-100">
              {processedData.links.length}
            </strong>{' '}
            links will be visualized
          </span>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="flex items-center gap-2">
            <PiGraphBold className="h-4 w-4" />
            Visualize Graph
            <PiArrowRightBold className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}