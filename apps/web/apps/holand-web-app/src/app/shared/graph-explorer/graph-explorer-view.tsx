'use client';

/**
 * GraphExplorerView — Main orchestrator for the Knowledge Graph Explorer.
 *
 * Integrates: GraphToolbar, FilterSidebar, GraphCanvas, InspectorPanel,
 * ContextMenu, LegendPanel, StatsBar.
 *
 * Key node actions:
 *   pin  — fix position; unaffected by physics simulation
 *   lock — pin + resist layout algorithm repositioning
 *   hide — remove from visible graph (recoverable via status panel)
 *
 * @requires graphService — for API calls to backend graph endpoints
 * @requires GraphCanvas — core D3/react-force-graph rendering
 *
 * @example
 * ```tsx
 * <GraphExplorerView />
 * ```
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { formatGraphPluginError } from '@/utils/graph-plugin-errors';
import {
  PiSidebarSimpleBold,
  PiSidebarSimpleFill,
} from 'react-icons/pi';

import GraphCanvas, { GraphCanvasHandle } from './graph-canvas';
import GraphToolbar from './graph-toolbar';
import FilterSidebar from './filter-sidebar';
import InspectorPanel from './inspector-panel';
import StatsBar from './stats-bar';
import ContextMenu from './context-menu';
import LegendPanel from './legend-panel';
import DataSourceConnector from './data-source-connector';
import GraphDataProcessor from './graph-data-processor';
import QueryBuilder from './query-builder';
import PathfindingPanel from './pathfinding-panel';
import PathResultsStrip from './path-results-strip';
import GraphExportModal from './graph-export-modal';
import { createPathfindingLayerId, type PathfindingLayerState } from './pathfinding-layer-state';
import { buildPathHighlightColorMaps } from './path-layer-colors';
import { type PathfindingMode, resolveNodeElementId } from './graph-pathfinding';
import { graphService, mergeGraphData } from '@/services/graph-explorer.service';

import { DEFAULT_GRAPH_FILTER, DEFAULT_GRAPH_SETTINGS } from '@/config/graph-config';
import cn from '@core/utils/class-names';

import type {
  GraphData,
  GraphFilter,
  GraphSettings,
  GraphNode,
  InspectorTarget,
  ContextMenuState,
  NodeAction,
  LinkAction,
  PathfindingComputation,
  CommunityReport,
} from '@/types/graph-explorer.types';

// ─── Component ────────────────────────────────────────────────────────────────

export default function GraphExplorerView() {
  /* ─── Refs ─────────────────────────────────────────────────────────────── */
  const canvasRef = useRef<GraphCanvasHandle>(null);

  /* ─── Core state ────────────────────────────────────────────────────────── */
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [rawGraphData, setRawGraphData] = useState<GraphData | null>(null); // Raw data before processing
  const [showProcessor, setShowProcessor] = useState(false); // Whether to show processor step
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<GraphFilter>(DEFAULT_GRAPH_FILTER);
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    target: null,
  });

  /* ─── Panel visibility ──────────────────────────────────────────────────── */
  const [filterOpen, setFilterOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);

  /* ─── Physics / simulation ──────────────────────────────────────────────── */
  const [isPaused, setIsPaused] = useState(false);

  /* ─── Query Builder filter IDs ──────────────────────────────────────────── */
  const [queryFilterNodeIds, setQueryFilterNodeIds] = useState<Set<string> | null>(null);
  const [queryFilterLinkIds, setQueryFilterLinkIds] = useState<Set<string> | null>(null);
  /** True when the visible node/link subset was narrowed by "Isolate" on a path result. */
  const [pathIsolateFilterActive, setPathIsolateFilterActive] = useState(false);
  const pathIsolateFilterActiveRef = useRef(false);
  pathIsolateFilterActiveRef.current = pathIsolateFilterActive;

  const [pathfindingOpen, setPathfindingOpen] = useState(false);
  /** User hid the floating path summary — session (highlight / isolate) stays until cleared. */
  const [pathResultsStripDismissed, setPathResultsStripDismissed] = useState(false);
  const [pickedDestinationFromGraph, setPickedDestinationFromGraph] = useState<string | null>(null);
  const [pathSourceNode, setPathSourceNode] = useState<GraphNode | null>(null);
  /** Stacked pathfinding results; each can toggle highlight and expand details independently. */
  const [pathLayers, setPathLayers] = useState<PathfindingLayerState[]>([]);
  /** When isolate is on, which layer’s path narrowed the graph (if from this tool). */
  const [pathIsolateLayerId, setPathIsolateLayerId] = useState<string | null>(null);
  const [exportHtmlOpen, setExportHtmlOpen] = useState(false);
  const [schemaLabels, setSchemaLabels] = useState<string[]>([]);

  useEffect(() => {
    void graphService.fetchSchema(true).then(
      (schema) => {
        if (schema?.labels?.length) setSchemaLabels(schema.labels);
      },
      (err) => {
        console.warn('[GraphExplorerView] schema plugin failed:', err);
        toast.error(formatGraphPluginError(err, 'schema'), { duration: 6000 });
      }
    );
  }, []);

  /* ─── Stats ─────────────────────────────────────────────────────────────── */
  const [visibleStats, setVisibleStats] = useState({
    visibleNodes: 0,
    visibleLinks: 0,
  });

  /* ─── Derived selections ────────────────────────────────────────────────── */
  const selectedNodeId = useMemo(() => {
    if (inspectorTarget?.kind === 'node') return inspectorTarget.item.id;
    return null;
  }, [inspectorTarget]);

  const selectedLinkId = useMemo(() => {
    if (inspectorTarget?.kind === 'link') return inspectorTarget.item.id;
    return null;
  }, [inspectorTarget]);

  const highlightedNodeIds = useMemo<Set<string>>(() => {
    if (!selectedNodeId || !filter.highlightPath || !graphData) return new Set();
    const neighbors = new Set<string>();
    graphData.links.forEach((l) => {
      const srcId = typeof l.source === 'string' ? l.source : l.source.id;
      const tgtId = typeof l.target === 'string' ? l.target : l.target.id;
      if (srcId === selectedNodeId) neighbors.add(tgtId);
      if (tgtId === selectedNodeId) neighbors.add(srcId);
    });
    return neighbors;
  }, [selectedNodeId, graphData, filter.highlightPath]);

  const nodeIdLabelMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    if (!graphData) return m;
    graphData.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graphData]);

  const pathHighlightMaps = useMemo(
    () => buildPathHighlightColorMaps(graphData, pathLayers),
    [graphData, pathLayers]
  );

  /** Toolbar chip + panel "Clear session" — path result and/or path isolate still applied. */
  const pathSessionActive = useMemo(
    () =>
      pathIsolateFilterActive ||
      pathLayers.some((layer) => layer.results.some((r) => r.found)),
    [pathIsolateFilterActive, pathLayers]
  );

  const pathResultsSummaryAvailable = useMemo(
    () => pathLayers.some((layer) => layer.results.some((r) => r.found)),
    [pathLayers]
  );

  const pathResultsStripVisible = useMemo(
    () =>
      pathResultsSummaryAvailable &&
      !pathResultsStripDismissed &&
      pathLayers.some((layer) => {
        const r = layer.results[layer.activeResultIndex];
        return r?.found;
      }),
    [pathResultsSummaryAvailable, pathResultsStripDismissed, pathLayers]
  );

  const handlePathfindingComplete = useCallback(
    (results: PathfindingComputation[], mode: PathfindingMode, target: GraphNode) => {
      if (!pathSourceNode) return;
      const newLayer: PathfindingLayerState = {
        id: createPathfindingLayerId(),
        sourceNode: pathSourceNode,
        targetNode: target,
        mode,
        results,
        activeResultIndex: 0,
        highlightEnabled: true,
        expanded: true,
      };
      setPathLayers((prev) => prev.map((l) => ({ ...l, expanded: false })).concat(newLayer));
      setPathResultsStripDismissed(false);
    },
    [pathSourceNode]
  );

  const clearPathHighlight = useCallback(() => {
    if (pathIsolateFilterActiveRef.current) {
      setQueryFilterNodeIds(null);
      setQueryFilterLinkIds(null);
    }
    setPathIsolateFilterActive(false);
    setPathIsolateLayerId(null);
    setPathLayers([]);
    setPathSourceNode(null);
    setPathfindingOpen(false);
    setPathResultsStripDismissed(false);
  }, []);

  const dismissPathResultsStrip = useCallback(() => {
    setPathResultsStripDismissed(true);
  }, []);

  const releasePathIsolateOnly = useCallback(() => {
    if (!pathIsolateFilterActive) return;
    setQueryFilterNodeIds(null);
    setQueryFilterLinkIds(null);
    setPathIsolateFilterActive(false);
    setPathIsolateLayerId(null);
    toast.success('Isolate released — full graph visible again');
  }, [pathIsolateFilterActive]);

  const removePathLayer = useCallback(
    (layerId: string) => {
      setPathLayers((prev) => prev.filter((l) => l.id !== layerId));
      if (pathIsolateLayerId === layerId) {
        setQueryFilterNodeIds(null);
        setQueryFilterLinkIds(null);
        setPathIsolateFilterActive(false);
        setPathIsolateLayerId(null);
      }
    },
    [pathIsolateLayerId]
  );

  const onLayerActiveResultChange = useCallback((layerId: string, index: number) => {
    setPathLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, activeResultIndex: index } : l))
    );
  }, []);

  const onLayerHighlightToggle = useCallback((layerId: string, enabled: boolean) => {
    setPathLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, highlightEnabled: enabled } : l))
    );
  }, []);

  const onLayerExpandedChange = useCallback((layerId: string, expanded: boolean) => {
    setPathLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, expanded } : l))
    );
  }, []);

  const handlePathResultsSummaryToolbarToggle = useCallback(() => {
    if (!pathResultsSummaryAvailable) return;
    setPathResultsStripDismissed((d) => !d);
  }, [pathResultsSummaryAvailable]);

  const handlePathfindingToolbarClick = useCallback(() => {
    if (pathSessionActive) {
      setPathfindingOpen((o) => !o);
      return;
    }
    if (pathSourceNode) {
      setPathfindingOpen(true);
      return;
    }
    if (inspectorTarget?.kind === 'node') {
      setPathSourceNode(inspectorTarget.item);
      setPathfindingOpen(true);
      return;
    }
    toast.error('Select a node in the inspector or on the graph first');
  }, [pathSessionActive, pathSourceNode, inspectorTarget]);

  useEffect(() => {
    if (!pathfindingOpen) {
      setPickedDestinationFromGraph(null);
    }
  }, [pathfindingOpen]);

  const handleFitPathOnCanvas = useCallback((nodeIds: string[]) => {
    canvasRef.current?.fitToNodes(nodeIds);
  }, []);

  const handleIsolatePath = useCallback((layerId: string, nodeIds: string[], linkIds: string[]) => {
    setQueryFilterNodeIds(new Set(nodeIds));
    setQueryFilterLinkIds(new Set(linkIds));
    setPathIsolateFilterActive(true);
    setPathIsolateLayerId(layerId);
    toast.success('Filter narrowed to this path');
  }, []);

  /* ─── Data loading ──────────────────────────────────────────────────────── */
  // WHY: DataSourceConnector handles all data source types (backend, file,
  // URL, path) and returns parsed GraphData. This callback receives the result.
  const [sourceLabel, setSourceLabel] = useState<string>('');

  const handleDataLoaded = useCallback((data: GraphData, label: string) => {
    console.info('[GraphExplorer] Graph data loaded from connector:', {
      source: label,
      nodes: data.nodes.length,
      links: data.links.length,
    });
    setRawGraphData(data);
    setSourceLabel(label);
    setShowProcessor(true); // Show processing step
    setVisibleStats({
      visibleNodes: data.nodes.length,
      visibleLinks: data.links.length,
    });
  }, []);

  /**
   * Handle processed data from GraphDataProcessor.
   * Final step before visualization.
   */
  const handleDataProcessed = useCallback((data: GraphData) => {
    console.info('[GraphExplorer] Processed data ready for visualization:', {
      nodes: data.nodes.length,
      links: data.links.length,
    });
    
    // WHY auto-detect strength range: default filter has maxStrength=1 which
    // filters out links with strength > 1. We detect actual min/max from data
    // to ensure all links are visible by default.
    if (data.links.length > 0) {
      const strengths = data.links.map((l) => l.strength).filter((s) => s !== undefined) as number[];
      if (strengths.length > 0) {
        const minStrength = Math.min(...strengths);
        const maxStrength = Math.max(...strengths);
        console.info('[GraphExplorer] Auto-detected strength range:', {
          min: minStrength,
          max: maxStrength,
          count: strengths.length,
        });
        setFilter((prev) => ({
          ...prev,
          minStrength,
          maxStrength,
        }));
      }
    }
    
    setGraphData(data);
    setShowProcessor(false);
    setVisibleStats({
      visibleNodes: data.nodes.length,
      visibleLinks: data.links.length,
    });
  }, []);

  /**
   * Handle back from processor to source selection.
   */
  const handleProcessorBack = useCallback(() => {
    setRawGraphData(null);
    setShowProcessor(false);
  }, []);

  /**
   * Handle query builder filter results.
   * When query matches specific nodes/links, only those are shown.
   * Passing empty sets clears the query filter.
   */
  const handleQueryFilter = useCallback(
    (matchedNodeIds: Set<string>, matchedLinkIds: Set<string>) => {
      if (matchedNodeIds.size === 0 && matchedLinkIds.size === 0) {
        // Clear query filter
        setQueryFilterNodeIds(null);
        setQueryFilterLinkIds(null);
        setPathIsolateFilterActive(false);
        setPathIsolateLayerId(null);
        console.info('[GraphExplorer] Query filter cleared');
      } else {
        setQueryFilterNodeIds(matchedNodeIds);
        setQueryFilterLinkIds(matchedLinkIds);
        setPathIsolateFilterActive(false);
        setPathIsolateLayerId(null);
        console.info('[GraphExplorer] Query filter applied:', {
          nodes: matchedNodeIds.size,
          links: matchedLinkIds.size,
        });
      }
    },
    []
  );

  /* ─── Callbacks: stats ──────────────────────────────────────────────────── */
  const handleStatsUpdate = useCallback((nodes: number, links: number) => {
    setVisibleStats({ visibleNodes: nodes, visibleLinks: links });
  }, []);

  /* ─── Callbacks: focus node ─────────────────────────────────────────────── */
  const handleFocusNode = useCallback(
    (nodeId: string) => {
      if (!graphData) return;
      const node = graphData.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setInspectorTarget({ kind: 'node', item: node });
      canvasRef.current?.focusNode(nodeId);
    },
    [graphData]
  );

  /* ─── Callbacks: physics toggle ─────────────────────────────────────────── */
  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      canvasRef.current?.resumeSimulation();
    } else {
      canvasRef.current?.pauseSimulation();
    }
    setIsPaused((v) => !v);
  }, [isPaused]);

  /* ─── Callbacks: node actions (context menu) ────────────────────────────── */
  const handleNodeAction = useCallback(
    (nodeId: string, action: NodeAction) => {
      console.debug('[GraphExplorer] nodeAction:', { action, nodeId });

      switch (action) {
        case 'focus':
          handleFocusNode(nodeId);
          break;
        case 'show_neighbors':
        case 'expand': {
          if (!graphData) break;
          const node = graphData.nodes.find((n) => n.id === nodeId);
          if (!node) break;
          const elementId = resolveNodeElementId(node);
          const caseId =
            node.case_id?.trim() ||
            graphData.nodes.find((n) => n.case_id?.trim())?.case_id?.trim() ||
            'local';
          if (!elementId) {
            toast.error('No Neo4j elementId on this node — cannot expand via subgraph plugin');
            break;
          }
          void (async () => {
            const loading = toast.loading('Expanding neighbors…');
            try {
              const expanded = await graphService.expandSubgraph(elementId, caseId);
              setGraphData((prev) => (prev ? mergeGraphData(prev, expanded) : expanded));
              toast.success('Neighbors expanded', { id: loading });
            } catch (err) {
              toast.error(formatGraphPluginError(err, 'subgraph'), { id: loading });
            }
          })();
          break;
        }
        case 'hide_neighbors':
        case 'collapse':
          toast('Collapse neighbors — local view only', { icon: '📦' });
          break;
        case 'pin':
          canvasRef.current?.pinNode(nodeId);
          toast.success('Node pinned');
          break;
        case 'unpin':
          canvasRef.current?.unpinNode(nodeId);
          toast.success('Node unpinned');
          break;
        case 'lock':
          canvasRef.current?.lockNode(nodeId);
          toast.success('Node locked');
          break;
        case 'unlock':
          canvasRef.current?.unlockNode(nodeId);
          toast.success('Node unlocked');
          break;
        case 'hide':
          canvasRef.current?.hideNode(nodeId);
          toast('Node hidden');
          break;
        case 'show':
          toast('Show hidden neighbors — requires API');
          break;
        case 'copy_id':
          navigator.clipboard.writeText(nodeId).then(() => {
            toast.success('ID copied');
          });
          break;
        case 'copy_label': {
          if (!graphData) break;
          const node = graphData.nodes.find((n) => n.id === nodeId);
          if (node) {
            navigator.clipboard.writeText(node.label).then(() => {
              toast.success('Label copied');
            });
          }
          break;
        }
        case 'select_cluster': {
          if (!graphData) break;
          const clusterNode = graphData.nodes.find((n) => n.id === nodeId);
          if (clusterNode && clusterNode.community_id !== null) {
            const clusterIds = graphData.nodes
              .filter((n) => n.community_id === clusterNode.community_id)
              .map((n) => n.id);
            canvasRef.current?.selectMultiple(clusterIds);
            toast.success(`Selected ${clusterIds.length} nodes in cluster`);
          }
          break;
        }
        case 'inspect_cluster': {
          if (!graphData) break;
          const cn = graphData.nodes.find((n) => n.id === nodeId);
          const cid = cn?.community_id;
          if (cid == null) break;
          const found = graphData.community_reports.find((r) => r.community_id === cid);
          const item: CommunityReport =
            found ??
            ({
              community_id: cid,
              title: `Cluster ${cid}`,
              summary: '',
              rating: 0,
              rating_explanation: '',
              findings: [],
            } as CommunityReport);
          setInspectorTarget({ kind: 'community', item, fromNodeId: nodeId });
          break;
        }
        case 'expand_cluster':
        case 'collapse_cluster':
          toast(`Cluster ${action} — requires API`);
          break;
        case 'find_path': {
          const n = graphData?.nodes.find((x) => x.id === nodeId);
          if (n) {
            setPathSourceNode(n);
            setPathfindingOpen(true);
          }
          break;
        }
        case 'hide_unselected':
          canvasRef.current?.hideUnselected();
          break;
        case 'hide_unconnected':
          canvasRef.current?.hideUnconnected(nodeId);
          break;
        default:
          console.warn('[GraphExplorer] Unhandled node action:', action);
      }
    },
    [graphData, handleFocusNode]
  );

  /* ─── Callbacks: link actions ───────────────────────────────────────────── */
  const handleLinkAction = useCallback(
    (linkId: string, action: LinkAction) => {
      console.debug('[GraphExplorer] linkAction:', { action, linkId });

      switch (action) {
        case 'focus': {
          if (!graphData) break;
          const link = graphData.links.find((l) => l.id === linkId);
          if (link) setInspectorTarget({ kind: 'link', item: link });
          break;
        }
        case 'copy_id':
          navigator.clipboard.writeText(linkId).then(() => {
            toast.success('Link ID copied');
          });
          break;
        case 'hide':
          toast('Link hidden');
          break;
        case 'highlight':
          toast('Link highlighted');
          break;
        case 'goto_source':
        case 'goto_target': {
          if (!graphData) break;
          const link = graphData.links.find((l) => l.id === linkId);
          if (link) {
            const targetNodeId =
              action === 'goto_source'
                ? typeof link.source === 'string'
                  ? link.source
                  : link.source.id
                : typeof link.target === 'string'
                  ? link.target
                  : link.target.id;
            handleFocusNode(targetNodeId);
          }
          break;
        }
        default:
          console.warn('[GraphExplorer] Unhandled link action:', action);
      }
    },
    [graphData, handleFocusNode]
  );

  /* ─── Callbacks: canvas-level actions ───────────────────────────────────── */
  const handleCanvasAction = useCallback((action: string) => {
    console.debug('[GraphExplorer] canvasAction:', action);

    // Layout actions come as "layout_<name>"
    if (action.startsWith('layout_')) {
      const layout = action.replace('layout_', '');
      setSettings((prev) => ({ ...prev, layout: layout as GraphSettings['layout'] }));
      return;
    }

    switch (action) {
      case 'fit_view':
        canvasRef.current?.fitView();
        break;
      case 'reset_view':
        canvasRef.current?.resetView();
        break;
      case 'show_all':
        canvasRef.current?.unhideAllNodes();
        toast.success('All hidden nodes restored');
        break;
      case 'unpin_all':
        canvasRef.current?.unpinAllNodes();
        toast.success('All nodes unpinned');
        break;
      case 'unlock_all':
        canvasRef.current?.unlockAllNodes();
        toast.success('All nodes unlocked');
        break;
      case 'select_all':
        canvasRef.current?.selectAll();
        break;
      case 'clear_selection':
        canvasRef.current?.clearMultiSelection();
        break;
      case 'hide_unselected':
        canvasRef.current?.hideUnselected();
        break;
      case 'export_png':
        canvasRef.current?.exportPNG();
        toast.success('PNG export started');
        break;
      case 'reheat_simulation':
        canvasRef.current?.reheatSimulation();
        toast.success('Simulation reheated');
        break;
      case 'export_interactive_html':
        setExportHtmlOpen(true);
        break;
      default:
        console.warn('[GraphExplorer] Unhandled canvas action:', action);
    }
  }, []);

  /* ─── Close context menu on scroll ──────────────────────────────────────── */
  useEffect(() => {
    const dismiss = () =>
      setContextMenu({ visible: false, x: 0, y: 0, target: null });
    window.addEventListener('scroll', dismiss);
    return () => window.removeEventListener('scroll', dismiss);
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════════
   *  RENDER — Data source connector (no data loaded yet)
   * ═══════════════════════════════════════════════════════════════════════════ */
  if (!graphData && !isLoading && !rawGraphData) {
    return (
      <div className="mx-auto max-w-2xl py-4">
        <DataSourceConnector onLoad={handleDataLoaded} />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   *  RENDER — Data processor (data loaded, awaiting processing)
   * ═══════════════════════════════════════════════════════════════════════════ */
  if (showProcessor && rawGraphData) {
    return (
      <div className="mx-auto max-w-7xl py-4 px-4">
        <GraphDataProcessor
          rawData={rawGraphData}
          onProcessed={handleDataProcessed}
          onBack={handleProcessorBack}
          sourceLabel={sourceLabel}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading graph data…</p>
        </div>
      </div>
    );
  }

  if (!graphData) return null;

  /* ═══════════════════════════════════════════════════════════════════════════
   *  RENDER — Graph loaded
   * ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-0 flex-col h-[calc(100vh-140px)] w-full overflow-hidden rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
      {/* Toolbar */}
      <div className="shrink-0">
        <GraphToolbar
        settings={settings}
        onSettingsChange={setSettings}
        canvasRef={canvasRef as React.RefObject<GraphCanvasHandle>}
        isPaused={isPaused}
        onPauseToggle={handleTogglePause}
        nodeCount={visibleStats.visibleNodes}
        linkCount={visibleStats.visibleLinks}
        showQueryBuilder={showQueryBuilder}
        queryFilterActive={queryFilterNodeIds !== null || queryFilterLinkIds !== null}
        onToggleQueryBuilder={() => setShowQueryBuilder((v) => !v)}
        onPathfindingToolbarClick={handlePathfindingToolbarClick}
        pathfindingDisabled={!pathSessionActive && !pathSourceNode && inspectorTarget?.kind !== 'node'}
        pathSessionActive={pathSessionActive}
        pathfindingPanelOpen={pathfindingOpen}
        pathResultsSummaryAvailable={pathResultsSummaryAvailable}
        pathResultsStripVisible={pathResultsStripVisible}
        onPathResultsSummaryToggle={handlePathResultsSummaryToolbarToggle}
        onOpenInteractiveExport={() => setExportHtmlOpen(true)}
      />
      </div>

      {/* Query Builder panel — collapsible below toolbar */}
      {graphData && (
        <div
          className={cn(
            'shrink-0 border-b border-muted bg-gray-0 dark:bg-gray-50 max-h-[50vh] overflow-y-auto',
            !showQueryBuilder && 'hidden'
          )}
          aria-hidden={!showQueryBuilder}
        >
          <QueryBuilder
            graphData={graphData}
            onApplyFilter={handleQueryFilter}
            className="border-0 rounded-none"
          />
        </div>
      )}

      {/* Main area */}
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* Left: Filter sidebar */}
        <div
          className="flex-shrink-0 overflow-hidden border-r border-muted transition-all duration-200"
          style={{ width: filterOpen ? 280 : 0 }}
        >
          <div className="w-[280px] h-full overflow-hidden">
            <FilterSidebar
              filter={filter}
              data={graphData}
              onFilterChange={setFilter}
              schemaEntityTypes={schemaLabels}
            />
          </div>
        </div>

        {/* Center: Canvas + pathfinding sidebar (non-blocking) */}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="relative min-h-0 min-w-0 flex-1">
            <GraphCanvas
              ref={canvasRef}
              data={graphData}
              settings={settings}
              filter={filter}
              selectedNodeId={selectedNodeId}
              selectedLinkId={selectedLinkId}
              highlightedNodeIds={highlightedNodeIds}
              queryFilterNodeIds={queryFilterNodeIds}
              queryFilterLinkIds={queryFilterLinkIds}
              pathHighlightNodeColors={pathHighlightMaps?.nodeColors ?? null}
              pathHighlightLinkColors={pathHighlightMaps?.linkColors ?? null}
              pathfindingPanelOpen={pathfindingOpen && !!pathSourceNode}
              pathfindingSourceNodeId={pathSourceNode?.id ?? null}
              onPathfindingDestinationPicked={(id) => {
                setPickedDestinationFromGraph(id);
              }}
              onSelectTarget={setInspectorTarget}
              onContextMenu={setContextMenu}
              onStatsUpdate={handleStatsUpdate}
              onNodeAction={handleNodeAction}
              onLinkAction={handleLinkAction}
            />

            {pathLayers.length > 0 &&
              !pathResultsStripDismissed &&
              pathLayers.some((l) => l.results[l.activeResultIndex]?.found) && (
              <PathResultsStrip
                layers={pathLayers}
                graphData={graphData}
                nodeMap={nodeIdLabelMap}
                onLayerActiveResultChange={onLayerActiveResultChange}
                onLayerHighlightToggle={onLayerHighlightToggle}
                onLayerExpandedChange={onLayerExpandedChange}
                onRemoveLayer={removePathLayer}
                onDismissStrip={dismissPathResultsStrip}
                isolateFilterActive={pathIsolateFilterActive}
                isolateLayerId={pathIsolateLayerId}
                onReleaseIsolate={releasePathIsolateOnly}
                onClearSession={clearPathHighlight}
                onFitPath={handleFitPathOnCanvas}
                onIsolatePath={handleIsolatePath}
              />
            )}

            {showLegend && (
              <LegendPanel
                data={graphData}
                visible={showLegend}
                onToggle={() => setShowLegend((v) => !v)}
              />
            )}

            <button
              type="button"
              className="absolute bottom-4 left-4 z-10 rounded border border-muted bg-gray-0/80 px-2 py-1 text-[9px] text-gray-500 backdrop-blur-sm transition-colors hover:text-gray-900 dark:bg-gray-50/80 dark:hover:text-gray-700"
              onClick={() => setShowLegend((v) => !v)}
            >
              {showLegend ? 'Hide legend' : 'Show legend'}
            </button>

            <button
              type="button"
              className="absolute left-2 top-1/2 z-20 flex h-8 w-5 -translate-y-1/2 items-center justify-center rounded border border-muted bg-gray-0/90 text-gray-500 shadow-md transition-colors hover:bg-gray-100 hover:text-gray-900 dark:bg-gray-50/90 dark:hover:bg-gray-200 dark:hover:text-gray-700"
              onClick={() => setFilterOpen((v) => !v)}
            >
              <PiSidebarSimpleBold className="w-3 h-3" />
            </button>

            <button
              type="button"
              className="absolute right-2 top-1/2 z-20 flex h-8 w-5 -translate-y-1/2 items-center justify-center rounded border border-muted bg-gray-0/90 text-gray-500 shadow-md transition-colors hover:bg-gray-100 hover:text-gray-900 dark:bg-gray-50/90 dark:hover:bg-gray-200 dark:hover:text-gray-700"
              onClick={() => setInspectorOpen((v) => !v)}
            >
              <PiSidebarSimpleFill className="w-3 h-3" />
            </button>
          </div>

          {pathSourceNode && (
            <PathfindingPanel
              open={pathfindingOpen}
              graphData={graphData}
              sourceNode={pathSourceNode}
              onClose={() => setPathfindingOpen(false)}
              onComplete={handlePathfindingComplete}
              pickedDestinationId={pickedDestinationFromGraph}
              onConsumePickedDestination={() => setPickedDestinationFromGraph(null)}
              pathSessionActive={pathSessionActive}
              pathIsolateFilterActive={pathIsolateFilterActive}
              onReleaseIsolate={releasePathIsolateOnly}
              onClearSession={clearPathHighlight}
            />
          )}
        </div>

        {/* Right: Inspector */}
        <div
          className="flex-shrink-0 overflow-hidden border-l border-muted transition-all duration-200"
          style={{ width: inspectorOpen ? 300 : 0 }}
        >
          <div className="w-[300px] h-full overflow-hidden">
            <InspectorPanel
              target={inspectorTarget}
              data={graphData}
              onClose={() => setInspectorTarget(null)}
              onNodeAction={handleNodeAction}
              onLinkAction={handleLinkAction}
              onSelectNode={handleFocusNode}
            />
          </div>
        </div>
      </div>

      {/* Bottom stats bar */}
      <div className="shrink-0">
        <StatsBar
          stats={graphData.stats}
          visibleNodes={visibleStats.visibleNodes}
          visibleLinks={visibleStats.visibleLinks}
        />
      </div>

      {/* Context menu */}
      <ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu({ visible: false, x: 0, y: 0, target: null })}
        onNodeAction={handleNodeAction}
        onLinkAction={handleLinkAction}
        onCanvasAction={handleCanvasAction}
      />

      {exportHtmlOpen && (
        <GraphExportModal
          open={exportHtmlOpen}
          graphData={graphData}
          onClose={() => setExportHtmlOpen(false)}
        />
      )}
    </div>
  );
}
