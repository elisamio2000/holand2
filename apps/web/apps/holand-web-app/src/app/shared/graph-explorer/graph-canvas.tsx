'use client';

/**
 * GraphCanvas — Core graph rendering component using react-force-graph.
 *
 * Handles 2D/3D rendering, node painting, link drawing, cluster hulls,
 * layout algorithms, node dragging, pin/lock/hide state management,
 * multi-selection, and imperative handle for parent control.
 *
 * @requires react-force-graph-2d — 2D canvas rendering engine
 * @requires react-force-graph-3d — 3D WebGL rendering engine
 * @requires d3 — for polygon hulls and force configuration
 *
 * @example
 * ```tsx
 * <GraphCanvas ref={canvasRef} data={graphData} settings={settings} ... />
 * ```
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3';
import {
  PiPushPinBold,
  PiLockKeyBold,
  PiEyeSlashBold,
  PiXBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { pathLayerGlowFromStroke } from './path-layer-colors';
import { getEntityConfig, getRelationConfig, getCommunityColor } from '@/config/graph-config';
import {
  hexLinkFadeRgba,
  resolveThemeBackgroundRgb,
  toForceGraph3DColor,
} from '@/utils/force-graph-webgl-colors';
import {
  getLODLevel,
  getLODLevelAdaptive,
  getLinkLODLevel,
  LODLevel,
  LinkLODLevel,
  getViewportBounds,
  isNodeInViewport,
  getEngineRecommendation,
  RenderStatsTracker,
  computeNodeImportance,
  getVisibilityThreshold,
  getLinkVisibilityImportanceThreshold,
  getImportanceNodeSize,
  type ViewportBounds,
} from './graph-bigdata-engine';
import type {
  GraphData,
  GraphNode,
  GraphLink,
  GraphSettings,
  GraphFilter,
  InspectorTarget,
  ContextMenuState,
  NodeAction,
  LinkAction,
  RenderStats,
  Community,
  CommunityReport,
} from '@/types/graph-explorer.types';
import { useForceWorker } from './use-force-worker';

// ─── Dynamic imports (avoid SSR) ──────────────────────────────────────────────

const ForceGraph2D = dynamic(() => import('./force-graph-2d-bridge'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-gray-0 dark:bg-gray-50">
      <div className="animate-pulse text-gray-500 text-sm">Loading graph engine…</div>
    </div>
  ),
});

const ForceGraph3D = dynamic(() => import('./force-graph-3d-bridge'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-gray-0 dark:bg-gray-50">
      <div className="animate-pulse text-gray-500 text-sm">Loading 3D engine…</div>
    </div>
  ),
});

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_BASE_SIZE = 6;

/**
 * D3 still integrates forces into vx/vy while fx/fy pin position each tick.
 * Clearing the pin without zeroing velocity launches the node ("infinity" drift).
 */
function zeroNodeSimulationVelocity(node: ForceGraphNode, is3D: boolean) {
  node.vx = 0;
  node.vy = 0;
  if (is3D) node.vz = 0;
}

/** react-force-graph zoom getter may return a number or a transform object. */
function readForceGraphZoomK(fg: { zoom?: () => unknown }): number {
  if (typeof fg.zoom !== 'function') return 1;
  const z = fg.zoom();
  if (typeof z === 'number' && Number.isFinite(z)) return z;
  if (z && typeof z === 'object' && 'k' in z && typeof (z as { k: unknown }).k === 'number') {
    return (z as { k: number }).k;
  }
  return 1;
}

/** Mean position of nodes with valid coordinates — used to center zoom on the graph mass. */
function computeGraphCentroid(nodes: { x?: number; y?: number }[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let c = 0;
  for (const n of nodes) {
    if (n.x != null && n.y != null && Number.isFinite(n.x) && Number.isFinite(n.y)) {
      sx += n.x;
      sy += n.y;
      c++;
    }
  }
  if (!c) return { x: 0, y: 0 };
  return { x: sx / c, y: sy / c };
}

function buildNodeDegreeMap(links: ForceGraphLink[]): Map<string, number> {
  const m = new Map<string, number>();
  const bump = (id: string) => m.set(id, (m.get(id) ?? 0) + 1);
  for (const l of links) {
    const s = typeof l.source === 'string' ? l.source : l.source.id;
    const t = typeof l.target === 'string' ? l.target : l.target.id;
    bump(s);
    bump(t);
  }
  return m;
}

/** D3 default link strength: 1 / min(degree(source), degree(target)). */
function defaultD3LinkStrength(link: ForceGraphLink, degree: Map<string, number>): number {
  const sid = typeof link.source === 'string' ? link.source : link.source.id;
  const tid = typeof link.target === 'string' ? link.target : link.target.id;
  const ds = Math.max(1, degree.get(sid) ?? 1);
  const dt = Math.max(1, degree.get(tid) ?? 1);
  return 1 / Math.min(ds, dt);
}

/** Filter-box search: match common node fields (not only label/description). */
function nodeMatchesGraphSearch(n: GraphNode, q: string): boolean {
  if (!q) return true;
  if (n.label.toLowerCase().includes(q)) return true;
  if (n.description?.toLowerCase().includes(q)) return true;
  if (n.id.toLowerCase().includes(q)) return true;
  if (n.type.toLowerCase().includes(q)) return true;
  if (n.origin?.toLowerCase().includes(q)) return true;
  if (n.case_id?.toLowerCase().includes(q)) return true;
  if (n.artifact_id?.toLowerCase().includes(q)) return true;
  if (n.community_id != null && String(n.community_id).includes(q)) return true;
  if (n.tags?.some((t) => t.toLowerCase().includes(q))) return true;
  if (n.properties && JSON.stringify(n.properties).toLowerCase().includes(q)) return true;
  return false;
}

function linkMatchesGraphSearch(l: GraphLink, q: string): boolean {
  if (!q) return false;
  if (String(l.relation).toLowerCase().includes(q)) return true;
  if (l.description?.toLowerCase().includes(q)) return true;
  if (l.id.toLowerCase().includes(q)) return true;
  if (l.origin?.toLowerCase().includes(q)) return true;
  if (l.properties && JSON.stringify(l.properties).toLowerCase().includes(q)) return true;
  return false;
}

/** Search also matches AI community report text for the node's cluster. */
function nodeMatchesCommunityReportSearch(
  n: GraphNode,
  reports: CommunityReport[] | undefined,
  q: string
): boolean {
  if (!q || n.community_id == null || !reports?.length) return false;
  for (const r of reports) {
    if (r.community_id !== n.community_id) continue;
    const parts = [
      r.title,
      r.summary,
      r.rating_explanation,
      ...(r.findings ?? []).flatMap((f) => [f.summary, f.explanation]),
      ...(r.entity_names ?? []),
    ];
    if (parts.join(' ').toLowerCase().includes(q)) return true;
  }
  return false;
}

/** Search matches synthesized `communities[]` titles / entity names for this cluster. */
function nodeMatchesCommunityCatalogSearch(
  n: GraphNode,
  communities: Community[] | undefined,
  q: string
): boolean {
  if (!q || n.community_id == null || !communities?.length) return false;
  for (const c of communities) {
    if (c.community_id !== n.community_id) continue;
    const parts = [c.title, c.description, ...(c.entity_names ?? [])];
    if (parts.join(' ').toLowerCase().includes(q)) return true;
  }
  return false;
}

function cssVar(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value ? `rgb(${value})` : fallback;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphCanvasProps {
  data: GraphData;
  settings: GraphSettings;
  filter: GraphFilter;
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  highlightedNodeIds: Set<string>;
  /** Node IDs matched by QueryBuilder — null means no query filter active */
  queryFilterNodeIds?: Set<string> | null;
  /** Link IDs matched by QueryBuilder — null means no query filter active */
  queryFilterLinkIds?: Set<string> | null;
  /** Pathfinding: per-node ring color on graph (multi-route). */
  pathHighlightNodeColors?: Map<string, string> | null;
  /** Pathfinding: per-link stroke on graph (multi-route). */
  pathHighlightLinkColors?: Map<string, string> | null;
  /** When the pathfinding side panel is open: plain left-click on a node sets destination (like the template UX). */
  pathfindingPanelOpen?: boolean;
  pathfindingSourceNodeId?: string | null;
  onPathfindingDestinationPicked?: (nodeId: string) => void;
  onSelectTarget: (target: InspectorTarget) => void;
  onContextMenu: (state: ContextMenuState) => void;
  onStatsUpdate: (visibleNodes: number, visibleLinks: number) => void;
  onNodeAction?: (nodeId: string, action: NodeAction) => void;
  onLinkAction?: (linkId: string, action: LinkAction) => void;
  /** Board graph: pin node on drag end and notify parent of new layout position. */
  persistDragPositions?: boolean;
  onNodeDragGestureStart?: () => void;
  onNodeDragGestureEnd?: (nodeId: string, x: number, y: number) => void;
}

export interface GraphCanvasHandle {
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  focusNode: (nodeId: string) => void;
  exportPNG: () => void;
  exportSVG: () => void;
  exportJSON: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
  applyLayout: (layout: string) => void;
  unhideAllNodes: () => void;
  unpinAllNodes: () => void;
  unlockAllNodes: () => void;
  hideNode: (nodeId: string) => void;
  pinNode: (nodeId: string) => void;
  unpinNode: (nodeId: string) => void;
  lockNode: (nodeId: string) => void;
  unlockNode: (nodeId: string) => void;
  getHiddenNodes: () => Set<string>;
  getPinnedNodes: () => Set<string>;
  getLockedNodes: () => Set<string>;
  getSelectedNodes: () => Set<string>;
  selectMultiple: (nodeIds: string[]) => void;
  clearMultiSelection: () => void;
  hideUnselected: () => void;
  hideUnconnected: (nodeId: string) => void;
  selectAll: () => void;
  /** Re-run force simulation (same as releasing energy after layout changes). */
  reheatSimulation: () => void;
  /** Zoom viewport to fit only the given node ids. */
  fitToNodes: (nodeIds: string[]) => void;
}

// ─── Internal force-graph types ───────────────────────────────────────────────

interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
  communityColor?: string;
  _pinned?: boolean;
  _locked?: boolean;
}

interface ForceGraphLink extends GraphLink {
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
}

interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
}

// ─── Layout Algorithms ────────────────────────────────────────────────────────

function applyCircularLayout(nodes: ForceGraphNode[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    node.x = cx + radius * Math.cos(angle);
    node.y = cy + radius * Math.sin(angle);
    node.fx = node.x;
    node.fy = node.y;
  });
}

function applyGridLayout(nodes: ForceGraphNode[], width: number, height: number) {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const cellW = width / (cols + 1);
  const cellH = height / (Math.ceil(nodes.length / cols) + 1);
  nodes.forEach((node, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    node.x = cellW * (col + 1);
    node.y = cellH * (row + 1);
    node.fx = node.x;
    node.fy = node.y;
  });
}

function applyRadialLayout(
  nodes: ForceGraphNode[],
  _links: ForceGraphLink[],
  width: number,
  height: number
) {
  const cx = width / 2;
  const cy = height / 2;

  const communities = new Map<number | null, ForceGraphNode[]>();
  nodes.forEach((n) => {
    const key = n.community_id;
    if (!communities.has(key)) communities.set(key, []);
    communities.get(key)!.push(n);
  });

  const communityKeys = Array.from(communities.keys());
  const baseRadius = Math.min(width, height) * 0.25;

  communityKeys.forEach((key, ci) => {
    const groupNodes = communities.get(key)!;
    const groupAngle = (2 * Math.PI * ci) / communityKeys.length;
    const groupCx = cx + baseRadius * Math.cos(groupAngle);
    const groupCy = cy + baseRadius * Math.sin(groupAngle);
    const groupRadius = Math.max(50, groupNodes.length * 15);

    groupNodes.forEach((node, ni) => {
      const nodeAngle = (2 * Math.PI * ni) / groupNodes.length;
      node.x = groupCx + groupRadius * Math.cos(nodeAngle);
      node.y = groupCy + groupRadius * Math.sin(nodeAngle);
      node.fx = node.x;
      node.fy = node.y;
    });
  });
}

function applyHierarchicalLayout(
  nodes: ForceGraphNode[],
  links: ForceGraphLink[],
  width: number,
  height: number,
  horizontal: boolean = false
) {
  const incoming = new Map<string, number>();
  nodes.forEach((n) => incoming.set(n.id, 0));
  links.forEach((l) => {
    const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
    incoming.set(tgtId, (incoming.get(tgtId) ?? 0) + 1);
  });

  const levels = new Map<string, number>();
  const roots = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0);
  const queue: { node: ForceGraphNode; level: number }[] =
    roots.length > 0 ? roots.map((n) => ({ node: n, level: 0 })) : [{ node: nodes[0], level: 0 }];

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;
    if (!node || levels.has(node.id)) continue;
    levels.set(node.id, level);

    links.forEach((l) => {
      const srcId = typeof l.source === 'string' ? l.source : l.source.id;
      const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
      if (srcId === node.id) {
        const childNode = nodes.find((n) => n.id === tgtId);
        if (childNode && !levels.has(tgtId)) {
          queue.push({ node: childNode, level: level + 1 });
        }
      }
    });
  }

  nodes.forEach((n) => {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  });

  const levelGroups = new Map<number, ForceGraphNode[]>();
  nodes.forEach((n) => {
    const lvl = levels.get(n.id) ?? 0;
    if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
    levelGroups.get(lvl)!.push(n);
  });

  const maxLevel = Math.max(...Array.from(levelGroups.keys()), 0);
  const levelSpacing = horizontal ? width / (maxLevel + 2) : height / (maxLevel + 2);

  levelGroups.forEach((groupNodes, level) => {
    const nodeSpacing = horizontal
      ? height / (groupNodes.length + 1)
      : width / (groupNodes.length + 1);
    groupNodes.forEach((node, i) => {
      if (horizontal) {
        node.x = levelSpacing * (level + 1);
        node.y = nodeSpacing * (i + 1);
      } else {
        node.x = nodeSpacing * (i + 1);
        node.y = levelSpacing * (level + 1);
      }
      node.fx = node.x;
      node.fy = node.y;
    });
  });
}

function applyConcentricLayout(nodes: ForceGraphNode[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const sorted = [...nodes].sort((a, b) => (b.connectionCount ?? 0) - (a.connectionCount ?? 0));

  let ring = 0;
  let ringCount = 1;
  let ringIndex = 0;
  const baseRadius = 60;

  sorted.forEach((node) => {
    const radius = baseRadius + ring * 80;
    const angle = (2 * Math.PI * ringIndex) / ringCount;
    node.x = cx + radius * Math.cos(angle);
    node.y = cy + radius * Math.sin(angle);
    node.fx = node.x;
    node.fy = node.y;

    ringIndex++;
    if (ringIndex >= ringCount) {
      ring++;
      ringIndex = 0;
      ringCount = Math.max(1, Math.floor(6 * ring));
    }
  });
}

// ─── Status Panel ─────────────────────────────────────────────────────────────

function StatusPanel({
  pinnedNodes,
  lockedNodes,
  hiddenNodes,
  multiSelectedNodes,
  nodes,
  onUnpinNode,
  onUnlockNode,
  onUnhideNode,
  onUnpinAll,
  onUnlockAll,
  onUnhideAll,
  onClearSelection,
  isPaused,
}: {
  pinnedNodes: Set<string>;
  lockedNodes: Set<string>;
  hiddenNodes: Set<string>;
  multiSelectedNodes: Set<string>;
  nodes: ForceGraphNode[];
  onUnpinNode: (id: string) => void;
  onUnlockNode: (id: string) => void;
  onUnhideNode: (id: string) => void;
  onUnpinAll: () => void;
  onUnlockAll: () => void;
  onUnhideAll: () => void;
  onClearSelection: () => void;
  isPaused: boolean;
}) {
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  const getNodeLabel = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    return node?.label ?? id;
  };

  return (
    <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1.5">
      {/* Expanded panels */}
      {expandedPanel === 'pinned' && pinnedNodes.size > 0 && (
        <StatusExpandedList
          title="Pinned Nodes"
          colorClass="text-red-500"
          borderClass="border-red-500/40"
          items={pinnedNodes}
          getLabel={getNodeLabel}
          onRemove={onUnpinNode}
          onRemoveAll={onUnpinAll}
          removeAllLabel="Unpin All"
          onClose={() => setExpandedPanel(null)}
        />
      )}
      {expandedPanel === 'locked' && lockedNodes.size > 0 && (
        <StatusExpandedList
          title="Locked Nodes"
          colorClass="text-amber-500"
          borderClass="border-amber-500/40"
          items={lockedNodes}
          getLabel={getNodeLabel}
          onRemove={onUnlockNode}
          onRemoveAll={onUnlockAll}
          removeAllLabel="Unlock All"
          onClose={() => setExpandedPanel(null)}
        />
      )}
      {expandedPanel === 'hidden' && hiddenNodes.size > 0 && (
        <StatusExpandedList
          title="Hidden Nodes"
          colorClass="text-gray-500"
          borderClass="border-muted"
          items={hiddenNodes}
          getLabel={getNodeLabel}
          onRemove={onUnhideNode}
          onRemoveAll={onUnhideAll}
          removeAllLabel="Show All"
          onClose={() => setExpandedPanel(null)}
        />
      )}

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {isPaused && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded text-amber-500 text-xs">
            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            Paused
          </div>
        )}

        {multiSelectedNodes.size > 0 && (
          <button
            onClick={onClearSelection}
            className="flex items-center gap-1.5 px-2 py-1 bg-primary/20 border border-primary/40 rounded text-primary text-xs hover:bg-primary/30 transition-colors"
          >
            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
            {multiSelectedNodes.size} selected
            <PiXBold className="w-3 h-3 ml-0.5" />
          </button>
        )}

        {pinnedNodes.size > 0 && (
          <button
            onClick={() => setExpandedPanel(expandedPanel === 'pinned' ? null : 'pinned')}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
              'bg-red-500/20 border border-red-500/40 text-red-500',
              expandedPanel === 'pinned' && 'ring-1 ring-red-400'
            )}
          >
            <PiPushPinBold className="w-3 h-3" />
            {pinnedNodes.size} pinned
          </button>
        )}

        {lockedNodes.size > 0 && (
          <button
            onClick={() => setExpandedPanel(expandedPanel === 'locked' ? null : 'locked')}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
              'bg-amber-500/20 border border-amber-500/40 text-amber-500',
              expandedPanel === 'locked' && 'ring-1 ring-amber-400'
            )}
          >
            <PiLockKeyBold className="w-3 h-3" />
            {lockedNodes.size} locked
          </button>
        )}

        {hiddenNodes.size > 0 && (
          <button
            onClick={() => setExpandedPanel(expandedPanel === 'hidden' ? null : 'hidden')}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
              'bg-gray-100 dark:bg-gray-200 border border-muted text-gray-500',
              expandedPanel === 'hidden' && 'ring-1 ring-gray-400'
            )}
          >
            <PiEyeSlashBold className="w-3 h-3" />
            {hiddenNodes.size} hidden
          </button>
        )}
      </div>
    </div>
  );
}

/** Reusable expanded list for status panel sections */
function StatusExpandedList({
  title,
  colorClass,
  borderClass,
  items,
  getLabel,
  onRemove,
  onRemoveAll,
  removeAllLabel,
  onClose,
}: {
  title: string;
  colorClass: string;
  borderClass: string;
  items: Set<string>;
  getLabel: (id: string) => string;
  onRemove: (id: string) => void;
  onRemoveAll: () => void;
  removeAllLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'bg-gray-0/95 dark:bg-gray-50/95 backdrop-blur-sm border rounded-lg p-2 max-w-[240px] max-h-[200px] overflow-auto shadow-lg',
        borderClass
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-xs font-medium', colorClass)}>{title}</span>
        <div className="flex gap-1">
          <button
            onClick={onRemoveAll}
            className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-700 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-200 hover:bg-gray-200 dark:hover:bg-gray-300 transition-colors"
          >
            {removeAllLabel}
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-700">
            <PiXBold className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {Array.from(items).map((id) => (
          <div
            key={id}
            className="flex items-center justify-between text-xs py-0.5 px-1.5 rounded hover:bg-gray-100/50 dark:hover:bg-gray-200/50 group"
          >
            <span className="truncate max-w-[160px]">{getLabel(id)}</span>
            <button
              onClick={() => onRemove(id)}
              className={cn(
                'opacity-0 group-hover:opacity-100 transition-opacity',
                colorClass
              )}
            >
              <PiXBold className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  (
    {
      data,
      settings,
      filter,
      selectedNodeId,
      selectedLinkId,
      highlightedNodeIds,
      queryFilterNodeIds,
      queryFilterLinkIds,
      pathHighlightNodeColors,
      pathHighlightLinkColors,
      pathfindingPanelOpen,
      pathfindingSourceNodeId,
      onPathfindingDestinationPicked,
      onSelectTarget,
      onContextMenu,
      onStatsUpdate,
      persistDragPositions = false,
      onNodeDragGestureStart,
      onNodeDragGestureEnd,
    },
    ref
  ) => {
    const fgRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [is3D, setIs3D] = useState(settings.is3D ?? false);

    /** Pause the active engine and drop ref before swapping 2D/3D (avoids stale tickFrame). */
    const switchGraphMode = useCallback((next3d: boolean) => {
      try {
        fgRef.current?.pauseAnimation?.();
      } catch {
        /* graph may already be torn down */
      }
      fgRef.current = null;
      setIs3D(next3d);
    }, []);

    useEffect(() => {
      return () => {
        try {
          fgRef.current?.pauseAnimation?.();
        } catch {
          /* ignore */
        }
        fgRef.current = null;
      };
    }, [is3D]);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [hoveredNode, setHoveredNode] = useState<ForceGraphNode | null>(null);
    const [hoveredLink, setHoveredLink] = useState<ForceGraphLink | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
    const [pinnedNodes, setPinnedNodes] = useState<Set<string>>(new Set());
    const [lockedNodes, setLockedNodes] = useState<Set<string>>(new Set());
    const [multiSelectedNodes, setMultiSelectedNodes] = useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const draggedNodeRef = useRef<ForceGraphNode | null>(null);
    const dragGestureStartedRef = useRef(false);
    
    // WHY theme state: Canvas 2D painting requires runtime theme detection
    // for dynamic color adaptation (text, labels, backgrounds)
    const [isDarkMode, setIsDarkMode] = useState(false);
    
    // WHY temporary highlight: for focusNode animation (2s pulse on focused node)
    const [temporaryHighlight, setTemporaryHighlight] = useState<string | null>(null);
    const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // WHY ref for positions: preserves node positions across React re-renders
    // that would otherwise reset the D3 simulation state
    const nodePositionsRef = useRef<
      Map<string, { x: number; y: number; z?: number; fx?: number | null; fy?: number | null; fz?: number | null }>
    >(new Map());

    // ─── Big Data Engine State ─────────────────────────────────────────────
    // WHY render stats: Track FPS to auto-degrade LOD when performance drops
    const renderStatsRef = useRef(new RenderStatsTracker(60));
    const [currentLOD, setCurrentLOD] = useState<LODLevel>(LODLevel.STANDARD);
    // WHY currentLODRef: useCallback closures can't access latest state; ref enables
    // sync LOD access in nodeVisibility and onRenderFramePost without stale closures
    const currentLODRef = useRef<LODLevel>(LODLevel.STANDARD);
    // WHY globalScaleRef: nodeVisibility callback needs zoom level for progressive
    // disclosure but doesn't receive globalScale as parameter
    const globalScaleRef = useRef<number>(1);
    // WHY nodeImportanceRef: pre-computed importance map (0-1) for each node.
    // Read by nodeVisibility and paintNode every frame — Map.get is O(1).
    const nodeImportanceRef = useRef<Map<string, number>>(new Map());

    const [renderStats, setRenderStats] = useState<RenderStats>({
      fps: 60, nodeCount: 0, linkCount: 0,
      visibleNodes: 0, visibleLinks: 0, renderTime: 0,
    });
    const viewportBoundsRef = useRef<ViewportBounds | null>(null);

    // WHY engine recommendation: Suggest 3D/WebGL for large graphs
    const engineRecommendation = useMemo(
      () => getEngineRecommendation(data.nodes.length),
      [data.nodes.length]
    );

    // ─── Web Worker Force Simulation ───────────────────────────────────────
    // WHY: Offload force calculation to worker thread for graphs > 1K nodes
    // to keep main thread free for 60fps rendering
    // WHY gate on enablePhysics: otherwise the worker keeps pushing nodes while the UI says physics is off.
    const isWorkerEnabled = data.nodes.length > 1000 && !is3D && settings.enablePhysics;

    const handleWorkerTick = useCallback(
      (positions: Map<string, { x: number; y: number }>, _alpha: number) => {
        // Apply worker-computed positions to node objects
        positions.forEach((pos, id) => {
          const node = data.nodes.find((n) => n.id === id) as GraphNode & { x?: number; y?: number } | undefined;
          if (node) {
            node.x = pos.x;
            node.y = pos.y;
          }
        });
      },
      [data.nodes]
    );

    const {
      initWorker,
      pinNode: workerPinNode,
      unpinNode: workerUnpinNode,
      stopWorker,
      reheatWorker,
      isRunning: isWorkerRunning,
      isAvailable: isWorkerAvailable,
    } = useForceWorker(isWorkerEnabled, {
      onTick: handleWorkerTick,
      onDone: () => console.info('[GraphCanvas] Worker simulation converged'),
    });

    // Initialize worker when data changes and worker is enabled
    useEffect(() => {
      if (!isWorkerEnabled || !isWorkerAvailable) return;

      const workerNodes = data.nodes.map((n) => ({
        id: n.id,
        x: (n as GraphNode & { x?: number }).x,
        y: (n as GraphNode & { y?: number }).y,
      }));
      const workerLinks = data.links.map((l) => ({
        source: typeof l.source === 'string' ? l.source : (l.source as GraphNode).id,
        target: typeof l.target === 'string' ? l.target : (l.target as GraphNode).id,
      }));

      initWorker(workerNodes, workerLinks, {
        chargeStrength: settings.chargeStrength,
        linkDistance: settings.linkDistance,
        // WHY nodeSize + 3: Match the collision radius used in the main force config
        collisionRadius: settings.nodeSize + 3,
      });
    }, [isWorkerEnabled, isWorkerAvailable, data.nodes.length, data.links.length, settings.enablePhysics, data.nodes, data.links, initWorker, settings.chargeStrength, settings.linkDistance, settings.nodeSize]);

    // ─── Theme detection ───────────────────────────────────────────────────
    useEffect(() => {
      console.info('[GraphCanvas] Initializing theme detection...');
      
      const checkTheme = () => {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        console.info('[GraphCanvas] Theme detected:', { isDark });
        setIsDarkMode(isDark);
      };

      checkTheme();

      // Listen for theme changes via MutationObserver
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            checkTheme();
          }
        });
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      return () => {
        console.info('[GraphCanvas] Theme observer disconnected');
        observer.disconnect();
      };
    }, []);

    // ─── Cleanup temporary highlight timeout on unmount ───────────────────
    useEffect(() => {
      return () => {
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
      };
    }, []);

    // ─── Resize observer ───────────────────────────────────────────────────
    // WHY debounce: When filter toggles (showHiddenNodes, etc.) trigger
    // sidebar reflow, rapid resize events cause canvas jitter. 100ms debounce
    // ensures smooth transitions.
    useEffect(() => {
      if (!containerRef.current) return;

      let rafId: number | null = null;
      const updateDimensions = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const w = Math.round(rect.width) || 800;
            const h = Math.round(rect.height) || 600;
            setDimensions((prev) => {
              // WHY threshold: Avoid re-renders for sub-pixel changes from CSS transitions
              if (Math.abs(prev.width - w) < 2 && Math.abs(prev.height - h) < 2) return prev;
              return { width: w, height: h };
            });
          }
        });
      };

      updateDimensions();
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(containerRef.current);
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
      };
    }, []);

    // ─── Filter data ───────────────────────────────────────────────────────
    const filteredData = useMemo((): ForceGraphData => {
      const activeTypes = new Set(filter.entityTypes);
      const activeRelations = new Set(filter.relationTypes);
      const activeCommunities = new Set(filter.communities);
      const query = filter.searchQuery.toLowerCase().trim();

      const nodeIdsFromLinkSearch = new Set<string>();
      if (query) {
        for (const l of data.links) {
          if (!linkMatchesGraphSearch(l, query)) continue;
          const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          nodeIdsFromLinkSearch.add(srcId);
          nodeIdsFromLinkSearch.add(tgtId);
        }
      }

      const visibleNodes = data.nodes.filter((n) => {
        if (hiddenNodes.has(n.id) && !filter.showHiddenNodes) return false;
        if (activeTypes.size > 0 && !activeTypes.has(n.type)) return false;
        if (activeCommunities.size > 0 && n.community_id !== null && !activeCommunities.has(n.community_id))
          return false;
        if (query) {
          const hitNode = nodeMatchesGraphSearch(n, query);
          const hitLinkEndpoint = nodeIdsFromLinkSearch.has(n.id);
          const hitReport = nodeMatchesCommunityReportSearch(n, data.community_reports, query);
          const hitCatalog = nodeMatchesCommunityCatalogSearch(n, data.communities, query);
          if (!hitNode && !hitLinkEndpoint && !hitReport && !hitCatalog) return false;
        }
        return true;
      });

      const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

      let visibleLinks = data.links.filter((l) => {
        const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        if (!visibleNodeIds.has(srcId) || !visibleNodeIds.has(tgtId)) return false;
        if (activeRelations.size > 0 && !activeRelations.has(l.relation)) return false;
        if (l.strength < filter.minStrength || l.strength > filter.maxStrength) return false;
        return true;
      });

      let finalNodes = visibleNodes;

      // WHY: QueryBuilder provides optional node/link ID sets to further filter
      // the graph. When active (non-null), only matched entities are shown.
      if (queryFilterNodeIds) {
        finalNodes = finalNodes.filter((n) => queryFilterNodeIds.has(n.id));
      }
      if (queryFilterLinkIds) {
        visibleLinks = visibleLinks.filter((l) => queryFilterLinkIds.has(l.id));
      }

      // WHY: After any node filtering (query, type, community, etc.), links may
      // reference nodes no longer in finalNodes. D3 throws "node not found" errors
      // if source/target IDs are missing from the node set. Always reconcile.
      const finalNodeIdSet = new Set(finalNodes.map((n) => n.id));
      visibleLinks = visibleLinks.filter((l) => {
        const srcId = typeof l.source === 'string' ? l.source : l.source.id;
        const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
        return finalNodeIdSet.has(srcId) && finalNodeIdSet.has(tgtId);
      });

      // WHY hide-isolated AFTER query + reconcile: Isolated must mean "no edge in
      // the *currently rendered* subgraph". If we hid isolated before the query
      // narrowed links, every node that had any link in the full graph stayed visible
      // while only query-matched edges drew — producing hundreds of orphan nodes.
      if (!filter.showIsolated) {
        const connectedIds = new Set<string>();
        visibleLinks.forEach((l) => {
          const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          connectedIds.add(srcId);
          connectedIds.add(tgtId);
        });
        finalNodes = finalNodes.filter((n) => connectedIds.has(n.id));
        const prunedIds = new Set(finalNodes.map((n) => n.id));
        visibleLinks = visibleLinks.filter((l) => {
          const srcId = typeof l.source === 'string' ? l.source : l.source.id;
          const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
          return prunedIds.has(srcId) && prunedIds.has(tgtId);
        });
      }

      const nodesCopy: ForceGraphNode[] = finalNodes.map((n) => {
        const savedPos = nodePositionsRef.current.get(n.id);
        return {
          ...n,
          communityColor: getCommunityColor(n.community_id),
          _pinned: pinnedNodes.has(n.id),
          _locked: lockedNodes.has(n.id),
          x: savedPos?.x ?? n.x,
          y: savedPos?.y ?? n.y,
          z: savedPos?.z ?? n.z,
          fx: savedPos?.fx ?? (pinnedNodes.has(n.id) || lockedNodes.has(n.id) ? savedPos?.x : null),
          fy: savedPos?.fy ?? (pinnedNodes.has(n.id) || lockedNodes.has(n.id) ? savedPos?.y : null),
          fz: savedPos?.fz ?? (pinnedNodes.has(n.id) || lockedNodes.has(n.id) ? savedPos?.z : null),
        };
      });

      const linksCopy: ForceGraphLink[] = visibleLinks.map((l) => ({
        ...l,
        source: typeof l.source === 'string' ? l.source : l.source.id,
        target: typeof l.target === 'string' ? l.target : l.target.id,
      }));

      return { nodes: nodesCopy, links: linksCopy };
    }, [data, filter, hiddenNodes, pinnedNodes, lockedNodes, queryFilterNodeIds, queryFilterLinkIds]);

    useEffect(() => {
      const inputRelationTypes = new Set(data.links.map((l) => String(l.relation || 'RELATED_TO'))).size;
      const visibleRelationTypes = new Set(
        filteredData.links.map((l) => String(l.relation || 'RELATED_TO'))
      ).size;
      console.info('[GraphCanvas] Visible counts:', {
        inputNodes: data.nodes.length,
        inputLinks: data.links.length,
        inputRelationTypes,
        visibleNodes: filteredData.nodes.length,
        visibleLinks: filteredData.links.length,
        visibleRelationTypes,
      });
    }, [data.nodes.length, data.links, filteredData.nodes.length, filteredData.links]);

    // ─── Physics preset (gentle = stable / proportional tuning) ──────────────
    const physicsTuning = useMemo(() => {
      const count = filteredData.nodes.length;
      const preset = settings.physicsPreset ?? 'standard';
      if (preset === 'gentle') {
        return {
          chargeScale: count > 5000 ? 0.82 : count > 2000 ? 0.68 : 0.58,
          linkDistanceScale: 0.92,
          alphaDecayAdd: count > 2000 ? 0.022 : 0.014,
          velocityDecayAdd: 0.18,
          cooldownMult: 0.45,
          applyWeakCentering: true,
          weakCenterStrength: count > 4000 ? 0.028 : 0.052,
          reheatOnNodeDragEnd: false,
        };
      }
      if (preset === 'energetic') {
        return {
          chargeScale: 1.12,
          linkDistanceScale: 1.06,
          alphaDecayAdd: -0.005,
          velocityDecayAdd: -0.08,
          cooldownMult: 1.25,
          applyWeakCentering: false,
          weakCenterStrength: 0,
          reheatOnNodeDragEnd: true,
        };
      }
      return {
        chargeScale: 1,
        linkDistanceScale: 1,
        alphaDecayAdd: 0,
        velocityDecayAdd: 0,
        cooldownMult: 1,
        applyWeakCentering: false,
        weakCenterStrength: 0,
        reheatOnNodeDragEnd: true,
      };
    }, [settings.physicsPreset, filteredData.nodes.length]);

    // Update stats when filtered data changes
    useEffect(() => {
      onStatsUpdate(filteredData.nodes.length, filteredData.links.length);
    }, [filteredData, onStatsUpdate]);

    // ─── Pre-compute node importance when data changes ────────────────────
    // WHY useMemo: importance is a pure derivation from node connectionCount.
    // Recomputes only when filteredData changes (not every frame).
    useMemo(() => {
      nodeImportanceRef.current = computeNodeImportance(filteredData.nodes);
    }, [filteredData.nodes]);

    // ─── Node appearance ───────────────────────────────────────────────────
    const getNodeSize = useCallback(
      (node: ForceGraphNode) => {
        // WHY importance-based: Force simulation uses this for collision radius.
        // More connected nodes should occupy more space in the layout.
        const importance = nodeImportanceRef.current.get(node.id) ?? 0;
        const base = NODE_BASE_SIZE * (settings.nodeSize / 10);
        const size = base * (0.6 + importance * 2);
        const selected = selectedNodeId === node.id || multiSelectedNodes.has(node.id) ? 1.4 : 1;
        const hovered = hoveredNode?.id === node.id ? 1.25 : 1;
        return size * selected * hovered;
      },
      [settings.nodeSize, selectedNodeId, multiSelectedNodes, hoveredNode]
    );

    const getNodeColor = useCallback(
      (node: ForceGraphNode) => {
        const cfg = getEntityConfig(node.type);
        if (selectedNodeId === node.id || multiSelectedNodes.has(node.id)) return cfg.color;
        if (highlightedNodeIds.has(node.id)) return cfg.color;
        // WHY temporary highlight: focusNode shows a 2s pulse on focused node
        if (temporaryHighlight === node.id) return cfg.color;
        if (hoveredNode?.id === node.id) return cfg.color;
        return cfg.bgColor;
      },
      [selectedNodeId, multiSelectedNodes, highlightedNodeIds, temporaryHighlight, hoveredNode]
    );

    const getLinkColor = useCallback(
      (link: ForceGraphLink) => {
        const pathStroke = pathHighlightLinkColors?.get(link.id);
        if (pathStroke) return is3D ? toForceGraph3DColor(pathStroke) : pathStroke;
        const cfg = getRelationConfig(link.relation);
        const srcId = typeof link.source === 'string' ? link.source : link.source.id;
        const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
        if (selectedLinkId === link.id) return cfg.color;
        if (selectedNodeId === srcId || selectedNodeId === tgtId) return cfg.color;
        if (hoveredNode && (hoveredNode.id === srcId || hoveredNode.id === tgtId)) return cfg.color;
        if (hoveredLink?.id === link.id) return cfg.color;
        // 2D canvas accepts 8-digit hex; 3D (polished) needs rgba
        return is3D ? hexLinkFadeRgba(cfg.color) : `${cfg.color}55`;
      },
      [is3D, selectedNodeId, selectedLinkId, hoveredNode, hoveredLink, pathHighlightLinkColors]
    );

    const getLinkWidth = useCallback(
      (link: ForceGraphLink) => {
        const raw =
          typeof link.strength === 'number' && Number.isFinite(link.strength) ? link.strength : 0;
        // Strength varies widely across datasets; keep it as a mild modifier so the Appearance
        // slider (linkWidth) always produces a visible change instead of clamping to a constant.
        const strengthNorm = Math.min(2, Math.max(0.35, 0.4 + raw * 0.15));
        const base = Math.max(0.22, settings.linkWidth * 0.52 * strengthNorm);
        const srcId = typeof link.source === 'string' ? link.source : link.source.id;
        const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
        const onPath = pathHighlightLinkColors?.has(link.id);
        if (selectedLinkId === link.id) return base * 3;
        if (onPath) return base * 2.4;
        if (selectedNodeId === srcId || selectedNodeId === tgtId) return base * 2;
        if (hoveredNode && (hoveredNode.id === srcId || hoveredNode.id === tgtId)) return base * 1.5;
        if (hoveredLink?.id === link.id) return base * 2;
        return base;
      },
      [settings.linkWidth, selectedNodeId, selectedLinkId, hoveredNode, hoveredLink, pathHighlightLinkColors]
    );

    // ─── Canvas drawing: nodes (LOD-aware) ───────────────────────────────────
    // WHY LOD: At extreme zoom-out (5K+ nodes visible), drawing full detail
    // per node is the #1 perf bottleneck. LOD skips expensive text rendering
    // and decorations when they're invisible anyway.
    const paintNode = useCallback(
      (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const cfg = getEntityConfig(node.type);
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const lod = getLODLevelAdaptive(globalScale, filteredData.nodes.length);

        // ─── Zoom-dependent importance sizing ────────────────────────────
        // WHY: Hub nodes (high importance) are proportionally larger at far zoom,
        // like capital cities on a world map. Sizes converge at close zoom.
        const importance = nodeImportanceRef.current.get(node.id) ?? 0;
        const baseSize = NODE_BASE_SIZE * (settings.nodeSize / 10);
        const size = getImportanceNodeSize(importance, globalScale, baseSize, filteredData.nodes.length);
        const selected = selectedNodeId === node.id || multiSelectedNodes.has(node.id);
        const hovered = hoveredNode?.id === node.id;
        const displaySize = size * (selected ? 1.4 : 1) * (hovered ? 1.25 : 1);

        // ── LOD 0: BLOB — community-colored dot, size from importance ─────
        if (lod === LODLevel.BLOB) {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1.5, displaySize * 0.5), 0, 2 * Math.PI);
          ctx.fillStyle = node.communityColor ?? cfg.bgColor;
          ctx.fill();
          return;
        }

        const isMultiSelected = multiSelectedNodes.has(node.id);

        // ── LOD 1: SIMPLE — colored circle + community ring ───────────────
        if (lod === LODLevel.SIMPLE) {
          // Community ring
          if (node.community_id !== null) {
            ctx.beginPath();
            ctx.arc(x, y, displaySize + 2, 0, 2 * Math.PI);
            ctx.strokeStyle = node.communityColor ?? '#6b7280';
            ctx.lineWidth = 1 / globalScale;
            ctx.stroke();
          }

          const pathRing = pathHighlightNodeColors?.get(node.id);
          if (pathRing) {
            ctx.beginPath();
            ctx.arc(x, y, displaySize + 6, 0, 2 * Math.PI);
            ctx.strokeStyle = pathRing;
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();
          }

          // Selection glow (simplified — thin ring)
          if (selectedNodeId === node.id || isMultiSelected || highlightedNodeIds.has(node.id)) {
            ctx.beginPath();
            ctx.arc(x, y, displaySize + 5, 0, 2 * Math.PI);
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = 1.5 / globalScale;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }

          // Main circle
          ctx.beginPath();
          ctx.arc(x, y, displaySize, 0, 2 * Math.PI);
          ctx.fillStyle = cfg.bgColor;
          ctx.fill();
          ctx.strokeStyle = cfg.color;
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
          return;
        }

        // ── LOD 2+: STANDARD / FULL — full detail rendering ──────────────

        // Multi-selection glow
        if (isMultiSelected) {
          ctx.beginPath();
          ctx.arc(x, y, displaySize + 10, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.fill();
        }

        const pathRingStd = pathHighlightNodeColors?.get(node.id);
        if (pathRingStd) {
          ctx.beginPath();
          ctx.arc(x, y, displaySize + 9, 0, 2 * Math.PI);
          ctx.strokeStyle = pathRingStd;
          ctx.lineWidth = 2.5 / globalScale;
          ctx.globalAlpha = 0.85;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Community cluster background
        if (settings.showClusterHulls && node.community_id !== null) {
          ctx.beginPath();
          ctx.arc(x, y, displaySize + 4, 0, 2 * Math.PI);
          ctx.fillStyle = (node.communityColor ?? '#6b7280') + '15';
          ctx.fill();
        }

        // Outer ring (community color)
        ctx.beginPath();
        ctx.arc(x, y, displaySize + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = node.communityColor ?? '#6b7280';
        ctx.lineWidth = (node._pinned || node._locked ? 3 : 1.5) / globalScale;
        ctx.stroke();

        // Selection glow
        if (selectedNodeId === node.id || highlightedNodeIds.has(node.id) || temporaryHighlight === node.id) {
          ctx.beginPath();
          ctx.arc(x, y, displaySize + 8, 0, 2 * Math.PI);
          ctx.strokeStyle = cfg.color;
          ctx.lineWidth = 2 / globalScale;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(x, y, displaySize, 0, 2 * Math.PI);
        ctx.fillStyle = cfg.bgColor;
        ctx.fill();
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = (selectedNodeId === node.id ? 2 : 1) / globalScale;
        ctx.stroke();

        // Icon letter
        const fontSize = Math.max(6, displaySize * 0.75);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = cfg.color;

        const iconMap: Record<string, string> = {
          person: 'P',
          organization: 'O',
          location: 'L',
          financial_entity: '$',
          event: 'E',
          document: 'D',
          vehicle: 'V',
          phone: '#',
          phone_number: '#',
          email: '@',
          product: '*',
          project: 'J',
          unknown: '?',
        };
        ctx.fillText(iconMap[node.type] ?? '?', x, y);

        // Label (LOD 2+)
        if (settings.showLabels && globalScale > 0.35) {
          const label = node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label;
          const labelSize = Math.max(8, 11 / globalScale);
          ctx.font = `500 ${labelSize}px sans-serif`;
          
          // WHY theme-aware colors: Label must be readable in both dark and light modes
          const textColor = isDarkMode ? 'rgba(248,250,252,0.9)' : 'rgba(15,23,42,0.9)';
          const strokeColor = isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(248,250,252,0.8)';
          
          ctx.fillStyle = textColor;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 2.5 / globalScale;
          ctx.strokeText(label, x, y + displaySize + labelSize);
          ctx.fillText(label, x, y + displaySize + labelSize);
        }

        // ── LOD 3 only: FULL — badges and indicators ───────────────────────
        if (lod === LODLevel.FULL) {
          // Connection count badge
          if ((node.connectionCount ?? 0) > 2) {
            const badgeX = x + displaySize * 0.7;
            const badgeY = y - displaySize * 0.7;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, 5, 0, 2 * Math.PI);
            ctx.fillStyle = isDarkMode ? '#1f1f1f' : '#ffffff';
            ctx.fill();
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = 1 / globalScale;
            ctx.stroke();
            ctx.font = 'bold 5px sans-serif';
            ctx.fillStyle = cfg.color;
            ctx.fillText(String(node.connectionCount), badgeX, badgeY);
          }

          // Pinned indicator (red dot)
          if (node._pinned) {
            const pinX = x - displaySize * 0.7;
            const pinY = y - displaySize * 0.7;
            ctx.beginPath();
            ctx.arc(pinX, pinY, 4 / globalScale, 0, 2 * Math.PI);
            ctx.fillStyle = cssVar('--red-default', '#ef4444');
            ctx.fill();
            ctx.strokeStyle = isDarkMode ? '#1f1f1f' : '#ffffff';
            ctx.lineWidth = 1 / globalScale;
            ctx.stroke();
          }

          // Locked indicator (orange dot)
          if (node._locked) {
            const lockX = x + displaySize * 0.7;
            const lockY = y - displaySize * 0.7;
            ctx.beginPath();
            ctx.arc(lockX, lockY, 4 / globalScale, 0, 2 * Math.PI);
            ctx.fillStyle = cssVar('--orange-default', '#f59e0b');
            ctx.fill();
            ctx.strokeStyle = isDarkMode ? '#1f1f1f' : '#ffffff';
            ctx.lineWidth = 1 / globalScale;
            ctx.stroke();
          }
        } else {
          // LOD 2 (STANDARD): Show pin/lock only as smaller indicators
          if (node._pinned || node._locked) {
            const indicatorX = x - displaySize * 0.7;
            const indicatorY = y - displaySize * 0.7;
            ctx.beginPath();
            ctx.arc(indicatorX, indicatorY, 3 / globalScale, 0, 2 * Math.PI);
            ctx.fillStyle = node._pinned
              ? cssVar('--red-default', '#ef4444')
              : cssVar('--orange-default', '#f59e0b');
            ctx.fill();
          }
        }
      },
      [
        settings.showLabels,
        settings.showClusterHulls,
        settings.nodeSize,
        selectedNodeId,
        highlightedNodeIds,
        temporaryHighlight,
        multiSelectedNodes,
        hoveredNode,
        isDarkMode,
        filteredData.nodes.length,
        pathHighlightNodeColors,
      ]
    );

    // ─── Canvas drawing: cluster hulls ─────────────────────────────────────
    // Recompute hull geometry every frame from live node coordinates so hulls
    // stay aligned with force / layout motion (stale 60-frame cache caused visible lag).
    const drawClusterHulls = useCallback(
      (ctx: CanvasRenderingContext2D, nodes: ForceGraphNode[], globalScale: number) => {
        if (!settings.showClusterHulls) return;

        const lod = getLODLevelAdaptive(globalScale, nodes.length);
        if (lod === LODLevel.BLOB) return;

        const communities = new Map<number, ForceGraphNode[]>();
        nodes.forEach((n) => {
          if (n.community_id !== null && n.x !== undefined && n.y !== undefined) {
            if (!communities.has(n.community_id)) communities.set(n.community_id, []);
            communities.get(n.community_id)!.push(n);
          }
        });

        communities.forEach((clusterNodes, communityId) => {
          if (clusterNodes.length < 2) return;
          const points = clusterNodes.map((n) => [n.x!, n.y!] as [number, number]);
          const hull = d3.polygonHull(points);
          if (!hull || hull.length < 3) return;
          const color = getCommunityColor(communityId);
          ctx.beginPath();
          ctx.moveTo(hull[0][0], hull[0][1]);
          hull.forEach((p: [number, number]) => ctx.lineTo(p[0], p[1]));
          ctx.closePath();
          ctx.fillStyle = color + '18';
          ctx.fill();
          ctx.strokeStyle = color + '55';
          ctx.lineWidth = 2 / globalScale;
          ctx.setLineDash([5 / globalScale, 3 / globalScale]);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      },
      [settings.showClusterHulls]
    );

    // ─── Canvas drawing: links (LOD-aware) ───────────────────────────────────
    const paintLink = useCallback(
      (link: ForceGraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const src = link.source as ForceGraphNode;
        const tgt = link.target as ForceGraphNode;
        if (!src.x || !src.y || !tgt.x || !tgt.y) return;

        const linkLod = getLinkLODLevel(globalScale, filteredData.nodes.length);

        const cfg = getRelationConfig(link.relation);

        // ── Link LOD SIMPLE — thin line only, no arrows or labels ─────────
        if (linkLod === LinkLODLevel.SIMPLE) {
          const zoomMul =
            globalScale < 0.22 ? 0.24 : globalScale < (filteredData.nodes.length > 500 ? 0.55 : 0.4) ? 0.34 : 0.38;
          const lw = Math.max(0.06, settings.linkWidth * zoomMul);
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.strokeStyle = getLinkColor(link);
          ctx.lineWidth = ((pathHighlightLinkColors?.has(link.id) ? lw * 1.75 : lw) / globalScale);
          ctx.stroke();
          return;
        }

        // ── Link LOD 2: FULL — arrows, labels, dashes ──────────────────
        const width = getLinkWidth(link);
        const isSelected = selectedLinkId === link.id;
        const pathEdgeColor = pathHighlightLinkColors?.get(link.id);
        const onPath = !!pathEdgeColor;

        if (onPath && !isSelected && pathEdgeColor) {
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.strokeStyle = pathLayerGlowFromStroke(pathEdgeColor);
          ctx.lineWidth = (width + 5) / globalScale;
          ctx.stroke();
        }

        // Selection highlight
        if (isSelected) {
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.strokeStyle = cfg.color + '40';
          ctx.lineWidth = (width + 4) / globalScale;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = getLinkColor(link);
        ctx.lineWidth = width / globalScale;

        if (cfg.dashed) {
          ctx.setLineDash([4 / globalScale, 3 / globalScale]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const targetSize = getNodeSize(tgt);
        const arrowLen = 5 / globalScale;
        const arrowPos = 1 - (targetSize + 4) / dist;

        const ax = src.x + dx * arrowPos;
        const ay = src.y + dy * arrowPos;
        const angle = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - arrowLen * Math.cos(angle - Math.PI / 6), ay - arrowLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ax - arrowLen * Math.cos(angle + Math.PI / 6), ay - arrowLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = getLinkColor(link);
        ctx.fill();

        // Relation label
        if (settings.showRelationLabels && globalScale > 0.5) {
          const midX = (src.x + tgt.x) / 2;
          const midY = (src.y + tgt.y) / 2;
          const labelSize = Math.max(7, 9 / globalScale);
          ctx.font = `${labelSize}px sans-serif`;
          
          // WHY theme-aware label: Readable in both dark and light backgrounds
          ctx.fillStyle = isDarkMode ? 'rgba(248,250,252,0.6)' : 'rgba(0,0,0,0.35)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cfg.label, midX, midY - 3 / globalScale);
        }
      },
      [
        filteredData.nodes.length,
        settings.showRelationLabels,
        settings.linkWidth,
        getLinkColor,
        getLinkWidth,
        getNodeSize,
        selectedLinkId,
        isDarkMode,
        pathHighlightLinkColors,
      ]
    );

    // ─── Event handlers ────────────────────────────────────────────────────
    const handleNodeClick = useCallback(
      (node: ForceGraphNode, event: MouseEvent) => {
        if (isDragging) return;
        if (
          pathfindingPanelOpen &&
          onPathfindingDestinationPicked &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          if (pathfindingSourceNodeId && node.id === pathfindingSourceNodeId) {
            onSelectTarget({ kind: 'node', item: node as GraphNode });
            return;
          }
          onPathfindingDestinationPicked(node.id);
          onSelectTarget({ kind: 'node', item: node as GraphNode });
          return;
        }
        if (event.ctrlKey || event.metaKey) {
          setMultiSelectedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
          });
        } else {
          setMultiSelectedNodes(new Set());
          onSelectTarget({ kind: 'node', item: node as GraphNode });
        }
      },
      [
        onSelectTarget,
        isDragging,
        pathfindingPanelOpen,
        pathfindingSourceNodeId,
        onPathfindingDestinationPicked,
      ]
    );

    const handleLinkClick = useCallback(
      (link: ForceGraphLink) => {
        setMultiSelectedNodes(new Set());
        onSelectTarget({ kind: 'link', item: link as GraphLink });
      },
      [onSelectTarget]
    );

    const handleNodeRightClick = useCallback(
      (node: ForceGraphNode, event: MouseEvent) => {
        event.preventDefault();
        onContextMenu({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          target: { kind: 'node', item: node as GraphNode },
        });
      },
      [onContextMenu]
    );

    const handleLinkRightClick = useCallback(
      (link: ForceGraphLink, event: MouseEvent) => {
        event.preventDefault();
        onContextMenu({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          target: { kind: 'link', item: link as GraphLink },
        });
      },
      [onContextMenu]
    );

    const handleBackgroundClick = useCallback(() => {
      setMultiSelectedNodes(new Set());
      onSelectTarget(null);
      onContextMenu({ visible: false, x: 0, y: 0, target: null });
    }, [onSelectTarget, onContextMenu]);

    const handleBackgroundRightClick = useCallback(
      (event: MouseEvent) => {
        event.preventDefault();
        onContextMenu({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          target: { kind: 'canvas' },
        });
      },
      [onContextMenu]
    );

    const handleNodeHover = useCallback(
      (node: ForceGraphNode | null) => {
        setHoveredNode(node);
        if (containerRef.current) {
          const cursor =
            pathfindingPanelOpen && !node ? 'crosshair' : node ? 'pointer' : 'grab';
          containerRef.current.style.cursor = cursor;
        }
      },
      [pathfindingPanelOpen]
    );

    const handleLinkHover = useCallback((link: ForceGraphLink | null) => {
      setHoveredLink(link);
      if (containerRef.current) {
        containerRef.current.style.cursor = link ? 'pointer' : 'grab';
      }
    }, []);

    // ─── Node dragging ─────────────────────────────────────────────────────
    const handleNodeDrag = useCallback(
      (node: ForceGraphNode) => {
        setIsDragging(true);
        draggedNodeRef.current = node;
        if (persistDragPositions && !dragGestureStartedRef.current) {
          dragGestureStartedRef.current = true;
          onNodeDragGestureStart?.();
        }
        zeroNodeSimulationVelocity(node, is3D);
        node.fx = node.x;
        node.fy = node.y;
        if (is3D) node.fz = node.z;
        nodePositionsRef.current.set(node.id, {
          x: node.x ?? 0,
          y: node.y ?? 0,
          z: node.z,
          fx: node.fx,
          fy: node.fy,
          fz: node.fz,
        });
      },
      [is3D, persistDragPositions, onNodeDragGestureStart]
    );

    const handleNodeDragEnd = useCallback(
      (node: ForceGraphNode) => {
        draggedNodeRef.current = null;
        setTimeout(() => setIsDragging(false), 50);

        const isPinned = pinnedNodes.has(node.id);
        const isLocked = lockedNodes.has(node.id);
        const shouldPersist = persistDragPositions || isPinned || isLocked;

        zeroNodeSimulationVelocity(node, is3D);

        // WHY: Only keep fixed position if the node is already pinned or locked,
        // or when board graph mode requests persisted layout positions.
        if (shouldPersist) {
          node.fx = node.x;
          node.fy = node.y;
          if (is3D) node.fz = node.z;
          nodePositionsRef.current.set(node.id, {
            x: node.x ?? 0,
            y: node.y ?? 0,
            z: node.z,
            fx: node.x,
            fy: node.y,
            fz: is3D ? node.z : undefined,
          });
          if (persistDragPositions) {
            setPinnedNodes((prev) => new Set([...prev, node.id]));
            onNodeDragGestureEnd?.(node.id, node.x ?? 0, node.y ?? 0);
            dragGestureStartedRef.current = false;
          }
        } else {
          node.fx = null;
          node.fy = null;
          if (is3D) node.fz = null;
          nodePositionsRef.current.set(node.id, {
            x: node.x ?? 0,
            y: node.y ?? 0,
            z: node.z,
            fx: null,
            fy: null,
            fz: null,
          });
          if (fgRef.current && settings.enablePhysics && physicsTuning.reheatOnNodeDragEnd) {
            fgRef.current.d3ReheatSimulation?.();
          }
        }
      },
      [is3D, pinnedNodes, lockedNodes, settings.enablePhysics, physicsTuning.reheatOnNodeDragEnd, persistDragPositions, onNodeDragGestureEnd]
    );

    // ─── Pin/Unpin/Lock/Unlock helpers ─────────────────────────────────────
    const doPinNode = useCallback(
      (nodeId: string) => {
        const node = filteredData.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.fx = node.x;
          node.fy = node.y;
          if (is3D) node.fz = node.z;
          nodePositionsRef.current.set(nodeId, {
            x: node.x ?? 0,
            y: node.y ?? 0,
            z: node.z,
            fx: node.x,
            fy: node.y,
            fz: is3D ? node.z : undefined,
          });
          setPinnedNodes((prev) => new Set([...prev, nodeId]));
        }
      },
      [filteredData.nodes, is3D]
    );

    const doUnpinNode = useCallback(
      (nodeId: string) => {
        const node = filteredData.nodes.find((n) => n.id === nodeId);
        if (node && !lockedNodes.has(nodeId)) {
          node.fx = null;
          node.fy = null;
          if (is3D) node.fz = null;
          nodePositionsRef.current.set(nodeId, {
            x: node.x ?? 0,
            y: node.y ?? 0,
            z: node.z,
            fx: null,
            fy: null,
            fz: null,
          });
        }
        setPinnedNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        if (fgRef.current && settings.enablePhysics) {
          fgRef.current.d3ReheatSimulation?.();
        }
      },
      [filteredData.nodes, lockedNodes, is3D, settings.enablePhysics]
    );

    const doLockNode = useCallback(
      (nodeId: string) => {
        const node = filteredData.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.fx = node.x;
          node.fy = node.y;
          if (is3D) node.fz = node.z;
          nodePositionsRef.current.set(nodeId, {
            x: node.x ?? 0,
            y: node.y ?? 0,
            z: node.z,
            fx: node.x,
            fy: node.y,
            fz: is3D ? node.z : undefined,
          });
          setLockedNodes((prev) => new Set([...prev, nodeId]));
        }
      },
      [filteredData.nodes, is3D]
    );

    const doUnlockNode = useCallback(
      (nodeId: string) => {
        const node = filteredData.nodes.find((n) => n.id === nodeId);
        if (node && !pinnedNodes.has(nodeId)) {
          node.fx = null;
          node.fy = null;
          if (is3D) node.fz = null;
          nodePositionsRef.current.set(nodeId, {
            x: node.x ?? 0,
            y: node.y ?? 0,
            z: node.z,
            fx: null,
            fy: null,
            fz: null,
          });
        }
        setLockedNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        if (fgRef.current && settings.enablePhysics) {
          fgRef.current.d3ReheatSimulation?.();
        }
      },
      [filteredData.nodes, pinnedNodes, is3D, settings.enablePhysics]
    );

    const doUnhideNode = useCallback((nodeId: string) => {
      setHiddenNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }, []);

    const doUnpinAll = useCallback(() => {
      filteredData.nodes.forEach((n) => {
        if (pinnedNodes.has(n.id) && !lockedNodes.has(n.id)) {
          n.fx = null;
          n.fy = null;
          if (is3D) n.fz = null;
        }
      });
      setPinnedNodes(new Set());
      if (fgRef.current && settings.enablePhysics) {
        fgRef.current.d3ReheatSimulation?.();
      }
    }, [filteredData.nodes, pinnedNodes, lockedNodes, is3D, settings.enablePhysics]);

    const doUnlockAll = useCallback(() => {
      filteredData.nodes.forEach((n) => {
        if (lockedNodes.has(n.id) && !pinnedNodes.has(n.id)) {
          n.fx = null;
          n.fy = null;
          if (is3D) n.fz = null;
        }
      });
      setLockedNodes(new Set());
      if (fgRef.current && settings.enablePhysics) {
        fgRef.current.d3ReheatSimulation?.();
      }
    }, [filteredData.nodes, lockedNodes, pinnedNodes, is3D, settings.enablePhysics]);

    const doUnhideAll = useCallback(() => {
      setHiddenNodes(new Set());
    }, []);

    // ─── Apply layout ──────────────────────────────────────────────────────
    const doApplyLayout = useCallback(
      (layout: string) => {
        const nodes = filteredData.nodes;
        const links = filteredData.links;
        const { width, height } = dimensions;

        const savedPositions = new Map<string, { x: number; y: number; z?: number }>();
        nodes.forEach((n) => {
          if (pinnedNodes.has(n.id) || lockedNodes.has(n.id)) {
            savedPositions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0, z: n.z });
          }
        });

        switch (layout) {
          case 'circular':
            applyCircularLayout(nodes, width, height);
            break;
          case 'grid':
            applyGridLayout(nodes, width, height);
            break;
          case 'radial':
          case 'cluster':
            applyRadialLayout(nodes, links, width, height);
            break;
          case 'hierarchical':
          case 'tree':
            applyHierarchicalLayout(nodes, links, width, height, false);
            break;
          case 'hierarchical-horizontal':
          case 'tree-horizontal':
            applyHierarchicalLayout(nodes, links, width, height, true);
            break;
          case 'concentric':
            applyConcentricLayout(nodes, width, height);
            break;
          case 'force':
          default:
            nodes.forEach((n) => {
              if (!pinnedNodes.has(n.id) && !lockedNodes.has(n.id)) {
                n.fx = null;
                n.fy = null;
                if (is3D) n.fz = null;
                nodePositionsRef.current.delete(n.id);
              }
            });
            if (fgRef.current) {
              fgRef.current.d3ReheatSimulation?.();
            }
            break;
        }

        // Restore pinned/locked nodes
        if (layout !== 'force') {
          savedPositions.forEach((pos, id) => {
            const node = nodes.find((n) => n.id === id);
            if (node) {
              node.x = pos.x;
              node.y = pos.y;
              node.fx = pos.x;
              node.fy = pos.y;
            }
          });
        }

        // Update position ref
        nodes.forEach((n) => {
          nodePositionsRef.current.set(n.id, {
            x: n.x ?? 0,
            y: n.y ?? 0,
            z: n.z,
            fx: n.fx ?? null,
            fy: n.fy ?? null,
            fz: n.fz ?? null,
          });
        });

        if (fgRef.current && layout !== 'force') {
          setTimeout(() => fgRef.current?.zoomToFit?.(400, 40), 100);
        }
      },
      [filteredData, dimensions, pinnedNodes, lockedNodes, is3D]
    );

    // ─── Imperative handle ─────────────────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        resetView: () => {
          console.info('[GraphCanvas] resetView called');
          try {
            if (!fgRef.current) {
              console.warn('[GraphCanvas] resetView: fgRef.current is null');
              return;
            }
            // Unpin/unlock all non-fixed nodes and reset positions to force simulation
            filteredData.nodes.forEach((node) => {
              if (!pinnedNodes.has(node.id) && !lockedNodes.has(node.id)) {
                node.fx = null;
                node.fy = null;
                if (is3D) node.fz = null;
              }
            });
            if (settings.enablePhysics && typeof fgRef.current.d3ReheatSimulation === 'function') {
              fgRef.current.d3ReheatSimulation();
            }
            // Fit view after brief delay to allow simulation to initialize
            setTimeout(() => {
              if (fgRef.current && typeof fgRef.current.zoomToFit === 'function') {
                fgRef.current.zoomToFit(400, 40);
                console.info('[GraphCanvas] resetView completed');
              }
            }, 100);
          } catch (error) {
            console.error('[GraphCanvas] resetView failed:', error);
          }
        },
        zoomIn: () => {
          try {
            const fg = fgRef.current;
            if (!fg) return;
            if (is3D && typeof fg.cameraPosition === 'function') {
              const cp = fg.cameraPosition();
              if (cp && typeof cp.x === 'number') {
                const h = Math.hypot(cp.x, cp.y, cp.z) || 400;
                const newH = Math.max(60, h / 1.4);
                const r = newH / h;
                fg.cameraPosition({ x: cp.x * r, y: cp.y * r, z: cp.z * r }, undefined, 250);
              }
              return;
            }
            if (typeof fg.zoom !== 'function') return;
            const centroid = computeGraphCentroid(filteredData.nodes);
            if (typeof fg.centerAt === 'function' && Number.isFinite(centroid.x) && Number.isFinite(centroid.y)) {
              fg.centerAt(centroid.x, centroid.y, 240);
            }
            window.setTimeout(() => {
              const g = fgRef.current;
              if (!g || typeof g.zoom !== 'function') return;
              const currentZoom = readForceGraphZoomK(g);
              const clampedZoom = Math.min(currentZoom * 1.35, 8);
              try {
                g.zoom(clampedZoom, 220);
              } catch {
                g.zoom(clampedZoom);
              }
            }, 40);
          } catch (error) {
            console.error('[GraphCanvas] zoomIn failed:', error);
          }
        },
        zoomOut: () => {
          try {
            const fg = fgRef.current;
            if (!fg) return;
            if (is3D && typeof fg.cameraPosition === 'function') {
              const cp = fg.cameraPosition();
              if (cp && typeof cp.x === 'number') {
                const h = Math.hypot(cp.x, cp.y, cp.z) || 400;
                const newH = Math.min(4000, h * 1.4);
                const r = newH / h;
                fg.cameraPosition({ x: cp.x * r, y: cp.y * r, z: cp.z * r }, undefined, 250);
              }
              return;
            }
            if (typeof fg.zoom !== 'function') return;
            const centroid = computeGraphCentroid(filteredData.nodes);
            if (typeof fg.centerAt === 'function' && Number.isFinite(centroid.x) && Number.isFinite(centroid.y)) {
              fg.centerAt(centroid.x, centroid.y, 240);
            }
            window.setTimeout(() => {
              const g = fgRef.current;
              if (!g || typeof g.zoom !== 'function') return;
              const currentZoom = readForceGraphZoomK(g);
              const clampedZoom = Math.max(currentZoom / 1.35, 0.1);
              try {
                g.zoom(clampedZoom, 220);
              } catch {
                g.zoom(clampedZoom);
              }
            }, 40);
          } catch (error) {
            console.error('[GraphCanvas] zoomOut failed:', error);
          }
        },
        fitView: () => {
          console.info('[GraphCanvas] fitView called');
          try {
            if (!fgRef.current) {
              console.warn('[GraphCanvas] fitView: fgRef.current is null');
              return;
            }
            if (typeof fgRef.current.zoomToFit !== 'function') {
              console.warn('[GraphCanvas] fitView: zoomToFit method not available');
              return;
            }
            fgRef.current.zoomToFit(400, 40);
            console.info('[GraphCanvas] fitView completed');
          } catch (error) {
            console.error('[GraphCanvas] fitView failed:', error);
          }
        },
        reheatSimulation: () => {
          try {
            fgRef.current?.d3ReheatSimulation?.();
          } catch (e) {
            console.error('[GraphCanvas] reheatSimulation failed:', e);
          }
        },
        fitToNodes: (nodeIds: string[]) => {
          try {
            const idSet = new Set(nodeIds);
            if (typeof fgRef.current?.zoomToFit === 'function') {
              fgRef.current.zoomToFit(500, 56, (n: ForceGraphNode) => idSet.has(n.id));
            }
          } catch (e) {
            console.error('[GraphCanvas] fitToNodes failed:', e);
          }
        },
        focusNode: (nodeId: string) => {
          console.info('[GraphCanvas] focusNode called:', { nodeId });
          try {
            const node = filteredData.nodes.find((n) => n.id === nodeId);
            if (!node) {
              console.warn('[GraphCanvas] focusNode: Node not found:', { nodeId });
              return;
            }
            if (!fgRef.current) {
              console.warn('[GraphCanvas] focusNode: fgRef.current is null');
              return;
            }
            // Select the node to show in Inspector panel
            onSelectTarget({ kind: 'node', item: node as GraphNode });
            console.info('[GraphCanvas] focusNode: Node selected for Inspector');
            
            // Set temporary highlight with 2s pulse
            if (highlightTimeoutRef.current) {
              clearTimeout(highlightTimeoutRef.current);
            }
            setTemporaryHighlight(nodeId);
            highlightTimeoutRef.current = setTimeout(() => {
              setTemporaryHighlight(null);
              console.info('[GraphCanvas] Temporary highlight cleared');
            }, 2000);
            
            if (is3D) {
              // 3D camera positioning
              if (typeof fgRef.current.cameraPosition === 'function') {
                fgRef.current.cameraPosition(
                  { x: node.x ?? 0, y: node.y ?? 0, z: (node.z ?? 0) + 200 },
                  node,
                  500
                );
                console.info('[GraphCanvas] focusNode 3D completed:', { nodeId, x: node.x, y: node.y, z: node.z });
              } else {
                console.warn('[GraphCanvas] focusNode: cameraPosition method not available');
              }
            } else {
              // 2D center + zoom
              if (typeof fgRef.current.centerAt === 'function') {
                fgRef.current.centerAt(node.x, node.y, 500);
              } else {
                console.warn('[GraphCanvas] focusNode: centerAt method not available');
              }
              if (typeof fgRef.current.zoom === 'function') {
                fgRef.current.zoom(2.5, 500);
              } else {
                console.warn('[GraphCanvas] focusNode: zoom method not available');
              }
              console.info('[GraphCanvas] focusNode 2D completed:', { nodeId, x: node.x, y: node.y });
            }
          } catch (error) {
            console.error('[GraphCanvas] focusNode failed:', { nodeId, error });
          }
        },
        exportPNG: () => {
          console.info('[GraphCanvas] exportPNG called');
          try {
            const canvas = containerRef.current?.querySelector('canvas');
            if (!canvas) {
              console.warn('[GraphCanvas] exportPNG: Canvas element not found');
              return;
            }
            const link = document.createElement('a');
            link.download = `knowledge-graph-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            console.info('[GraphCanvas] PNG export completed');
          } catch (error) {
            console.error('[GraphCanvas] exportPNG failed:', error);
          }
        },
        exportSVG: () => {
          console.info('[GraphCanvas] exportSVG called');
          try {
            // WHY manual SVG generation: Canvas is raster, SVG is vector.
            // We manually construct SVG from node/link data for scalable export.
            
            const nodes = filteredData.nodes.filter((n) => !hiddenNodes.has(n.id));
            const links = filteredData.links.filter((l) => {
              const srcId = typeof l.source === 'string' ? l.source : l.source.id;
              const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
              return !hiddenNodes.has(srcId) && !hiddenNodes.has(tgtId);
            });

            // Calculate bounds
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            nodes.forEach((n) => {
              if (n.x !== undefined && n.y !== undefined) {
                minX = Math.min(minX, n.x);
                maxX = Math.max(maxX, n.x);
                minY = Math.min(minY, n.y);
                maxY = Math.max(maxY, n.y);
              }
            });

            const padding = 50;
            const width = maxX - minX + 2 * padding;
            const height = maxY - minY + 2 * padding;

            // Build SVG
            let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX - padding} ${minY - padding} ${width} ${height}">`;
            svg += `<rect width="100%" height="100%" fill="${isDarkMode ? '#111111' : '#f8fafc'}"/>`;
            
            // Links
            links.forEach((l) => {
              const src = typeof l.source === 'object' ? l.source : nodes.find((n) => n.id === l.source);
              const tgt = typeof l.target === 'object' ? l.target : nodes.find((n) => n.id === l.target);
              if (src && tgt && src.x !== undefined && src.y !== undefined && tgt.x !== undefined && tgt.y !== undefined) {
                const cfg = getRelationConfig(l.relation);
                svg += `<line x1="${src.x}" y1="${src.y}" x2="${tgt.x}" y2="${tgt.y}" stroke="${cfg.color}" stroke-width="1.5" opacity="0.6"/>`;
              }
            });

            // Nodes
            nodes.forEach((n) => {
              if (n.x !== undefined && n.y !== undefined) {
                const cfg = getEntityConfig(n.type);
                const size = settings.nodeSize;
                svg += `<circle cx="${n.x}" cy="${n.y}" r="${size}" fill="${cfg.bgColor}" stroke="${n.communityColor ?? cfg.color}" stroke-width="2"/>`;
                if (settings.showLabels) {
                  svg += `<text x="${n.x}" y="${n.y - size - 3}" text-anchor="middle" font-size="10" fill="${isDarkMode ? '#f8fafc' : '#111111'}">${n.label}</text>`;
                }
              }
            });

            svg += '</svg>';

            // Download
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            const link = document.createElement('a');
            link.download = `knowledge-graph-${Date.now()}.svg`;
            link.href = URL.createObjectURL(blob);
            link.click();
            console.info('[GraphCanvas] SVG export completed:', { nodes: nodes.length, links: links.length });
          } catch (error) {
            console.error('[GraphCanvas] exportSVG failed:', error);
          }
        },
        exportJSON: () => {
          const exportData = {
            // WHY export full graph: filteredData is viewport/UI-filter dependent and
            // can hide large portions of the dataset (search, relation filters, etc.).
            // JSON export should preserve the authoritative dataset.
            nodes: data.nodes.map((n) => ({
              id: n.id,
              label: n.label,
              type: n.type,
              community_id: n.community_id,
              x: n.x,
              y: n.y,
              pinned: pinnedNodes.has(n.id),
              locked: lockedNodes.has(n.id),
            })),
            links: data.links.map((l) => ({
              id: l.id,
              source: typeof l.source === 'string' ? l.source : l.source.id,
              target: typeof l.target === 'string' ? l.target : l.target.id,
              relation: l.relation,
              strength: l.strength,
            })),
            metadata: {
              exportedAt: new Date().toISOString(),
              totalNodes: data.nodes.length,
              totalLinks: data.links.length,
              visibleNodes: filteredData.nodes.length,
              visibleLinks: filteredData.links.length,
              exportScope: 'full_data',
            },
          };
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
          const link = document.createElement('a');
          link.download = 'knowledge-graph.json';
          link.href = URL.createObjectURL(blob);
          link.click();
        },
        pauseSimulation: () => {
          if (fgRef.current) {
            fgRef.current.pauseAnimation?.();
            setIsPaused(true);
          }
        },
        resumeSimulation: () => {
          if (fgRef.current) {
            fgRef.current.resumeAnimation?.();
            if (settings.enablePhysics) {
              fgRef.current.d3ReheatSimulation?.();
            }
            setIsPaused(false);
          }
        },
        applyLayout: doApplyLayout,
        unhideAllNodes: doUnhideAll,
        unpinAllNodes: doUnpinAll,
        unlockAllNodes: doUnlockAll,
        hideNode: (nodeId: string) => {
          setHiddenNodes((prev) => new Set([...prev, nodeId]));
        },
        pinNode: doPinNode,
        unpinNode: doUnpinNode,
        lockNode: doLockNode,
        unlockNode: doUnlockNode,
        getHiddenNodes: () => hiddenNodes,
        getPinnedNodes: () => pinnedNodes,
        getLockedNodes: () => lockedNodes,
        getSelectedNodes: () => multiSelectedNodes,
        selectMultiple: (nodeIds: string[]) => {
          console.info('[GraphCanvas] selectMultiple:', { count: nodeIds.length });
          setMultiSelectedNodes(new Set(nodeIds));
        },
        clearMultiSelection: () => {
          console.info('[GraphCanvas] clearMultiSelection');
          setMultiSelectedNodes(new Set());
        },
        hideUnselected: () => {
          console.info('[GraphCanvas] hideUnselected:', { selected: multiSelectedNodes.size });
          if (multiSelectedNodes.size === 0) {
            console.warn('[GraphCanvas] hideUnselected: No nodes selected');
            return;
          }
          const toHide = new Set<string>();
          filteredData.nodes.forEach((n) => {
            if (!multiSelectedNodes.has(n.id)) toHide.add(n.id);
          });
          setHiddenNodes((prev) => new Set([...prev, ...toHide]));
          console.info('[GraphCanvas] hideUnselected completed:', { hidden: toHide.size });
        },
        hideUnconnected: (nodeId: string) => {
          console.info('[GraphCanvas] hideUnconnected:', { nodeId });
          const connectedIds = new Set<string>([nodeId]);
          filteredData.links.forEach((l) => {
            const srcId = typeof l.source === 'string' ? l.source : l.source.id;
            const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
            if (srcId === nodeId) connectedIds.add(tgtId);
            if (tgtId === nodeId) connectedIds.add(srcId);
          });
          const toHide = new Set<string>();
          filteredData.nodes.forEach((n) => {
            if (!connectedIds.has(n.id)) toHide.add(n.id);
          });
          setHiddenNodes((prev) => new Set([...prev, ...toHide]));
          console.info('[GraphCanvas] hideUnconnected completed:', {
            connected: connectedIds.size,
            hidden: toHide.size,
          });
        },
        selectAll: () => {
          console.info('[GraphCanvas] selectAll:', { count: filteredData.nodes.length });
          setMultiSelectedNodes(new Set(filteredData.nodes.map((n) => n.id)));
        },
      }),
      [doApplyLayout, doUnhideAll, doUnpinAll, doUnlockAll, doPinNode, doUnpinNode, doLockNode, doUnlockNode, filteredData.nodes, filteredData.links, settings.enablePhysics, settings.nodeSize, settings.showLabels, pinnedNodes, lockedNodes, is3D, onSelectTarget, isDarkMode, hiddenNodes, data.nodes, data.links, multiSelectedNodes]
    );

    // ─── Layout effect on settings change ──────────────────────────────────
    useEffect(() => {
      doApplyLayout(settings.layout);
    }, [settings.layout, doApplyLayout]);

    // ─── Initial fit to view ───────────────────────────────────────────────
    // WHY data dep only: Using filteredData.nodes.length caused zoomToFit to
    // fire on EVERY filter change (showHiddenNodes, entityTypes, etc.), making
    // the canvas zoom out unexpectedly. By depending on the raw data prop, we
    // only re-fit when genuinely new data is loaded, not on filter changes.
    useEffect(() => {
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit?.(400, 40);
      }, 600);
      return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // ─── Force configuration ───────────────────────────────────────────────
    // WHY rAF + is3D: After 2D↔3D toggle the graph ref is null until the new engine
    // mounts. 3D must not use d3Simulation().stop() or 2D-only forces — that leaves
    // three-forcegraph's layout engine undefined (tickFrame crash on second 3D entry).
    useEffect(() => {
      let cancelled = false;
      const frameId = requestAnimationFrame(() => {
        if (cancelled) return;
        const fg = fgRef.current;
        if (!fg) return;

        const n = filteredData.nodes.length;
        console.info('[GraphCanvas] Configuring D3 forces...', { is3D, nodes: n });

        if (!settings.enablePhysics) {
          fg.d3Force?.('charge')?.strength?.(0);
          const lfOff = fg.d3Force?.('link');
          if (lfOff && typeof lfOff.strength === 'function') {
            lfOff.strength(() => 0);
          }
          if (is3D) {
            fg.pauseAnimation?.();
          } else {
            fg.d3Force?.('collide', null);
            fg.d3Force?.('center', null);
            fg.d3Force?.('x', null);
            fg.d3Force?.('y', null);
            fg.d3Simulation?.()?.stop?.();
          }
          console.info('[GraphCanvas] Physics off');
          return;
        }

        const scaledCharge =
          (n > 5000
            ? Math.max(settings.chargeStrength, -30)
            : n > 2000
              ? Math.max(settings.chargeStrength, -50)
              : settings.chargeStrength) * physicsTuning.chargeScale;

        fg.d3Force?.('charge')?.strength?.(scaledCharge);

        const lf = fg.d3Force?.('link');
        lf?.distance?.(settings.linkDistance * physicsTuning.linkDistanceScale);
        if (lf && typeof lf.strength === 'function') {
          const deg = buildNodeDegreeMap(filteredData.links);
          lf.strength((link: ForceGraphLink) => defaultD3LinkStrength(link, deg));
        }

        if (is3D) {
          if (typeof fg.d3Force === 'function') {
            fg.d3Force('collide', null);
            fg.d3Force('x', null);
            fg.d3Force('y', null);
          }
          fg.resumeAnimation?.();
          fg.d3ReheatSimulation?.();
          console.info('[GraphCanvas] 3D physics reheated');
          return;
        }

        if (n > 5000) {
          if (typeof fg.d3Force === 'function') {
            fg.d3Force('collide', null);
          }
        } else {
          const collisionForce = d3.forceCollide<ForceGraphNode>()
            .radius((node: ForceGraphNode) => {
              const baseSize = settings.nodeSize;
              const communitySize = node.community_id !== null ? 1 : 0;
              return baseSize + communitySize + 3;
            })
            .strength(n > 2000 ? 0.3 : 0.7);

          if (typeof fg.d3Force === 'function') {
            fg.d3Force('collide', collisionForce);
          }
        }

        if (typeof fg.d3Force === 'function') {
          if (physicsTuning.applyWeakCentering) {
            fg.d3Force('x', d3.forceX(0).strength(physicsTuning.weakCenterStrength));
            fg.d3Force('y', d3.forceY(0).strength(physicsTuning.weakCenterStrength));
          } else {
            fg.d3Force('x', null);
            fg.d3Force('y', null);
          }
        }

        fg.resumeAnimation?.();
        fg.d3ReheatSimulation?.();
        console.info('[GraphCanvas] 2D physics reheated');
      });

      return () => {
        cancelled = true;
        cancelAnimationFrame(frameId);
      };
    }, [
      is3D,
      settings.chargeStrength,
      settings.linkDistance,
      settings.nodeSize,
      settings.enablePhysics,
      settings.physicsPreset,
      filteredData.nodes.length,
      filteredData.links,
      physicsTuning.chargeScale,
      physicsTuning.linkDistanceScale,
      physicsTuning.applyWeakCentering,
      physicsTuning.weakCenterStrength,
    ]);

    // ─── Background & 3D colors ────────────────────────────────────────────
    // WHY theme-aware background: Canvas must match overall page theme
    // Light mode: #f8fafc (gray-50 equivalent)
    // Dark mode: #111111 (gray-950 equivalent)
    const bgColor2d = 'rgb(var(--gray-50))';
    const bgColor3d = useMemo(
      () =>
        resolveThemeBackgroundRgb(
          '--gray-50',
          'rgb(250, 250, 250)',
          'rgb(17, 17, 17)',
          isDarkMode
        ),
      [isDarkMode]
    );

    const get3DNodeColor = useCallback(
      (node: ForceGraphNode) => {
        const cfg = getEntityConfig(node.type);
        const pathCol = pathHighlightNodeColors?.get(node.id);
        if (pathCol) return toForceGraph3DColor(pathCol);
        if (selectedNodeId === node.id || multiSelectedNodes.has(node.id)) return cfg.color;
        if (highlightedNodeIds.has(node.id)) return cfg.color;
        return toForceGraph3DColor(node.communityColor ?? cfg.color);
      },
      [selectedNodeId, multiSelectedNodes, highlightedNodeIds, pathHighlightNodeColors]
    );

    // WHY scale physics params: With 10K+ nodes, default alphaDecay and warmupTicks
    // cause multi-second freezes. Increase decay & reduce warmup proportionally.
    const nodeCount = filteredData.nodes.length;
    const baseAlphaDecay = nodeCount > 5000 ? 0.05 : nodeCount > 2000 ? 0.035 : 0.0228;
    const baseVelocityDecay = nodeCount > 4000 ? 0.48 : nodeCount > 1500 ? 0.42 : 0.28;
    const alphaDecay = settings.enablePhysics
      ? Math.min(0.88, Math.max(0.01, baseAlphaDecay + physicsTuning.alphaDecayAdd))
      : 1;
    const scaledWarmupTicks = nodeCount > 5000 ? 0 : nodeCount > 2000 ? 20 : 100;
    const scaledCooldownTime =
      (nodeCount > 5000 ? 5000 : nodeCount > 2000 ? 8000 : 15000) * physicsTuning.cooldownMult;
    const velocityDecay = settings.enablePhysics
      ? Math.min(0.9, Math.max(0.12, baseVelocityDecay + physicsTuning.velocityDecayAdd))
      : 0.97;

    // ─── Virtual Viewport: node visibility callback ─────────────────────────
    // WHY: For graphs > 2K nodes, rendering off-screen nodes is wasteful.
    // This callback uses viewport culling to skip nodes outside the visible area.
    // Only enabled for large graphs (> 500 nodes) to avoid overhead on small ones.
    const isLargeGraph = filteredData.nodes.length > 500;

    // ─── Progressive visibility: map-like semantic zoom ─────────────────────
    // WHY progressive: Like maps showing capitals first then cities then villages,
    // hub nodes (high connection count) appear first at far zoom. As you zoom in,
    // less important nodes progressively reveal. At close zoom, all viewport nodes
    // are visible. This avoids the jarring all-or-nothing switch of the old system.
    const nodeVisibility = useCallback(
      (node: ForceGraphNode) => {
        if (!isLargeGraph) return true;

        // Progressive importance-based disclosure
        const gs = globalScaleRef.current;
        const importance = nodeImportanceRef.current.get(node.id) ?? 0;
        const threshold = getVisibilityThreshold(gs, filteredData.nodes.length);
        if (importance < threshold) return false;

        // Viewport culling for visible (above-threshold) nodes
        const bounds = viewportBoundsRef.current;
        if (!bounds) return true;
        return isNodeInViewport(node.x ?? 0, node.y ?? 0, bounds);
      },
      [isLargeGraph, filteredData.nodes.length]
    );

    // ─── Link visibility — importance + viewport (relaxed threshold vs nodes) ─
    // WHY relaxed: At far zoom, node disclosure is stricter than edges; milder bar
    // keeps the network readable. Still hide if both endpoints are below link bar.
    const linkVisibility = useCallback(
      (link: ForceGraphLink) => {
        if (!isLargeGraph) return true;

        const gs = globalScaleRef.current;
        const threshold = getLinkVisibilityImportanceThreshold(gs, filteredData.nodes.length);

        const src = link.source as ForceGraphNode;
        const tgt = link.target as ForceGraphNode;
        const srcImportance = nodeImportanceRef.current.get(src.id) ?? 0;
        const tgtImportance = nodeImportanceRef.current.get(tgt.id) ?? 0;
        if (srcImportance < threshold && tgtImportance < threshold) return false;

        // Viewport culling
        const bounds = viewportBoundsRef.current;
        if (!bounds) return true;
        const srcVisible = isNodeInViewport(src.x ?? 0, src.y ?? 0, bounds);
        const tgtVisible = isNodeInViewport(tgt.x ?? 0, tgt.y ?? 0, bounds);
        return srcVisible || tgtVisible;
      },
      [isLargeGraph, filteredData.nodes.length]
    );

    const commonProps = {
      graphRef: fgRef,
      graphData: filteredData as any,
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: is3D ? bgColor3d : bgColor2d,
      nodeRelSize: NODE_BASE_SIZE,
      nodeVal: (node: ForceGraphNode) => getNodeSize(node),
      nodeColor: is3D ? get3DNodeColor : getNodeColor,
      nodeLabel: (node: ForceGraphNode) =>
        `${node.label}\n${node.type}${node.community_id !== null ? ` | Cluster ${node.community_id}` : ''}`,
      nodeVisibility: isLargeGraph ? nodeVisibility : undefined,
      linkColor: getLinkColor,
      linkWidth: getLinkWidth,
      linkVisibility: isLargeGraph ? linkVisibility : undefined,
      linkDirectionalArrowLength: 4,
      linkDirectionalArrowRelPos: 1,
      onNodeClick: handleNodeClick,
      onLinkClick: handleLinkClick,
      onNodeRightClick: handleNodeRightClick,
      onLinkRightClick: handleLinkRightClick,
      onBackgroundClick: handleBackgroundClick,
      onBackgroundRightClick: handleBackgroundRightClick,
      onNodeHover: handleNodeHover,
      onLinkHover: handleLinkHover,
      onNodeDrag: handleNodeDrag,
      onNodeDragEnd: handleNodeDragEnd,
      cooldownTime: settings.enablePhysics ? scaledCooldownTime : 0,
      d3AlphaDecay: alphaDecay,
      d3VelocityDecay: velocityDecay,
      d3AlphaMin: 0.001,
      warmupTicks: scaledWarmupTicks,
      enableNodeDrag: true,
      enableZoomInteraction: true,
      enablePanInteraction: true,
    };

    return (
      <div
        ref={containerRef}
        className="relative h-full min-h-0 w-full overflow-hidden"
        style={{ minHeight: 300 }}
      >
        {/* 2D/3D toggle */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-gray-0/80 dark:bg-gray-50/80 backdrop-blur-sm rounded-md border border-muted p-0.5">
          <button
            onClick={() => switchGraphMode(false)}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded transition-colors',
              !is3D ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200'
            )}
          >
            2D
          </button>
          <button
            onClick={() => switchGraphMode(true)}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded transition-colors',
              is3D ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200'
            )}
          >
            3D
          </button>
        </div>

        {/* Engine recommendation banner */}
        {engineRecommendation === 'webgl' && !is3D && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 bg-orange-50 dark:bg-orange-950/50 border border-orange-300 dark:border-orange-800 rounded-md px-3 py-1.5 text-xs text-orange-700 dark:text-orange-300">
            <span>⚡</span>
            <span>{filteredData.nodes.length.toLocaleString()} nodes — 3D mode recommended for better performance</span>
            <button
              onClick={() => switchGraphMode(true)}
              className="ml-1 px-2 py-0.5 bg-orange-200 dark:bg-orange-900 rounded text-orange-800 dark:text-orange-200 hover:bg-orange-300 dark:hover:bg-orange-800 transition-colors font-medium"
            >
              Switch to 3D
            </button>
          </div>
        )}

        {/* Status panel */}
        <StatusPanel
          pinnedNodes={pinnedNodes}
          lockedNodes={lockedNodes}
          hiddenNodes={hiddenNodes}
          multiSelectedNodes={multiSelectedNodes}
          nodes={filteredData.nodes}
          onUnpinNode={doUnpinNode}
          onUnlockNode={doUnlockNode}
          onUnhideNode={doUnhideNode}
          onUnpinAll={doUnpinAll}
          onUnlockAll={doUnlockAll}
          onUnhideAll={doUnhideAll}
          onClearSelection={() => setMultiSelectedNodes(new Set())}
          isPaused={isPaused}
        />

        {/* Render stats overlay (only for large graphs) */}
        {isLargeGraph && (
          <div className="absolute bottom-2 right-2 z-10 bg-gray-0/80 dark:bg-gray-50/80 backdrop-blur-sm rounded-md border border-muted px-2 py-1 text-[10px] font-mono text-gray-500 dark:text-gray-400 space-y-0.5">
            <div>LOD: {LODLevel[currentLOD]} | FPS: {renderStats.fps}</div>
            <div>Nodes: {renderStats.visibleNodes}/{renderStats.nodeCount} | Links: {renderStats.visibleLinks}/{renderStats.linkCount}</div>
          </div>
        )}

        {/* Graph */}
        {is3D ? (
          <ForceGraph3D key="graph-3d" {...(commonProps as any)} linkOpacity={0.6} />
        ) : (
          <ForceGraph2D
            key="graph-2d"
            {...(commonProps as any)}
            nodeCanvasObject={paintNode as any}
            nodeCanvasObjectMode={() => 'replace'}
            linkCanvasObject={paintLink as any}
            linkCanvasObjectMode={() => 'replace'}
            onRenderFramePost={(ctx: CanvasRenderingContext2D, globalScale: number) => {
              // ── Sync refs for use in nodeVisibility/linkVisibility callbacks ──
              globalScaleRef.current = globalScale;
              const bounds = getViewportBounds(fgRef.current, dimensions.width, dimensions.height);
              if (bounds) {
                viewportBoundsRef.current = bounds;
              }

              // ── Track render stats (FPS, LOD level) ──────────────────────────
              renderStatsRef.current.tick();
              const lod = getLODLevelAdaptive(globalScale, filteredData.nodes.length);
              currentLODRef.current = lod;
              if (lod !== currentLOD) {
                setCurrentLOD(lod);
              }

              // ── Update render stats periodically (every ~60 frames) ───────────
              // WHY frame-based throttle: Counting visible nodes iterates all 10K+
              // nodes. Doing this on every FPS fluctuation kills perf. Every 60
              // frames (~1s) is enough for a stats display.
              const frameNum = renderStatsRef.current.getFrameCount();
              if (frameNum % 60 === 0) {
                const fps = renderStatsRef.current.getFPS();
                const threshold = getVisibilityThreshold(globalScale, filteredData.nodes.length);
                let visNodes = 0;
                const importanceMap = nodeImportanceRef.current;
                for (let i = 0; i < filteredData.nodes.length; i++) {
                  if ((importanceMap.get(filteredData.nodes[i].id) ?? 0) >= threshold) visNodes++;
                }
                setRenderStats({
                  fps,
                  nodeCount: filteredData.nodes.length,
                  linkCount: filteredData.links.length,
                  visibleNodes: visNodes,
                  visibleLinks: filteredData.links.length,
                  renderTime: 0,
                });
              }

              // ── Draw cluster hulls (skip at extreme zoom-out) ────────────────
              if (lod !== LODLevel.BLOB) {
                drawClusterHulls(ctx, filteredData.nodes, globalScale);
              }


            }}
          />
        )}
      </div>
    );
  }
);

GraphCanvas.displayName = 'GraphCanvas';

export default GraphCanvas;
