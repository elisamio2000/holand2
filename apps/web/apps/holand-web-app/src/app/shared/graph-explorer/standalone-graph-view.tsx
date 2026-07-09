// ============================================
// StandaloneGraphView — Step 3 of 3: Graph visualization
// Reads processedData from session, renders full graph explorer UI
// ============================================

'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button, Text, Title } from 'rizzui';
import {
  PiArrowLeftBold,
  PiGraphBold,
  PiSidebarSimpleBold,
  PiSidebarSimpleFill,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { formatGraphPluginError } from '@/utils/graph-plugin-errors';
import GraphCanvas, { type GraphCanvasHandle } from './graph-canvas';
import GraphToolbar from './graph-toolbar';
import FilterSidebar from './filter-sidebar';
import InspectorPanel from './inspector-panel';
import StatsBar from './stats-bar';
import ContextMenu from './context-menu';
import LegendPanel from './legend-panel';
import QueryBuilder from './query-builder';
import PathfindingPanel from './pathfinding-panel';
import PathResultsStrip from './path-results-strip';
import GraphExportModal from './graph-export-modal';
import { createPathfindingLayerId, type PathfindingLayerState } from './pathfinding-layer-state';
import { buildPathHighlightColorMaps } from './path-layer-colors';
import { resolveNodeElementId, type PathfindingMode } from './graph-pathfinding';
import FloatingGraphAiChat from './floating-graph-ai-chat';
import { loadProcessedData, saveProcessedData, saveRawData } from './graph-session';
import { graphService, mergeGraphData, mergeMultipleCaseGraphs } from '@/services/graph-explorer.service';
import { DEFAULT_GRAPH_FILTER, DEFAULT_GRAPH_SETTINGS } from '@/config/graph-config';
import cn from '@core/utils/class-names';
import type {
  GraphData,
  GraphFilter,
  GraphSettings,
  GraphNode,
  InspectorTarget,
  CommunityReport,
  ContextMenuState,
  NodeAction,
  LinkAction,
  PathfindingComputation,
} from '@/types/graph-explorer.types';

/**
 * StandaloneGraphView — Step-3 graph visualization (route-based).
 *
 * Reads processedData from sessionStorage (written by /graph/edit-data).
 * If no session data: redirects to /graph/add-data.
 *
 * @example
 * ```tsx
 * <StandaloneGraphView />
 * ```
 */

export interface StandaloneGraphViewProps {
  /** Parsed from `/graph/visual-explorer/<caseIds>` — loads graph from gateway like Backend tab */
  caseIdsFromRoute?: string[];
}

export default function StandaloneGraphView({ caseIdsFromRoute }: StandaloneGraphViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const canvasRef = useRef<GraphCanvasHandle>(null);

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [routeLoadError, setRouteLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GraphFilter>(DEFAULT_GRAPH_FILTER);
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, target: null,
  });
  const [filterOpen, setFilterOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [queryFilterNodeIds, setQueryFilterNodeIds] = useState<Set<string> | null>(null);
  const [queryFilterLinkIds, setQueryFilterLinkIds] = useState<Set<string> | null>(null);
  const [pathIsolateFilterActive, setPathIsolateFilterActive] = useState(false);
  const pathIsolateFilterActiveRef = useRef(false);
  pathIsolateFilterActiveRef.current = pathIsolateFilterActive;
  const [visibleStats, setVisibleStats] = useState({ visibleNodes: 0, visibleLinks: 0 });

  const [pathfindingOpen, setPathfindingOpen] = useState(false);
  const [pathResultsStripDismissed, setPathResultsStripDismissed] = useState(false);
  const [pickedDestinationFromGraph, setPickedDestinationFromGraph] = useState<string | null>(null);
  const [pathSourceNode, setPathSourceNode] = useState<GraphNode | null>(null);
  const [pathLayers, setPathLayers] = useState<PathfindingLayerState[]>([]);
  const [pathIsolateLayerId, setPathIsolateLayerId] = useState<string | null>(null);
  const [exportHtmlOpen, setExportHtmlOpen] = useState(false);
  const [schemaLabels, setSchemaLabels] = useState<string[]>([]);

  useEffect(() => {
    void graphService.fetchSchema(true).then(
      (schema) => {
        if (schema?.labels?.length) setSchemaLabels(schema.labels);
      },
      (err) => {
        console.warn('[StandaloneGraphView] schema plugin failed:', err);
        toast.error(formatGraphPluginError(err, 'schema'), { duration: 6000 });
      }
    );
  }, []);

  const applyGraphAndFilter = useCallback((data: GraphData, source: 'session' | 'route') => {
    if (data.links.length > 0) {
      const strengths = data.links.map((l) => l.strength).filter((s) => s !== undefined) as number[];
      if (strengths.length > 0) {
        const minStrength = Math.min(...strengths);
        const maxStrength = Math.max(...strengths);
        setFilter((f) => ({ ...f, minStrength, maxStrength }));
      }
    }
    setGraphData(data);
    setVisibleStats({ visibleNodes: data.nodes.length, visibleLinks: data.links.length });
    console.info('[StandaloneGraphView] Graph ready:', { source, nodes: data.nodes.length, links: data.links.length });
  }, []);

  useEffect(() => {
    const fromRoute = caseIdsFromRoute?.filter(Boolean) ?? [];
    if (fromRoute.length === 0) {
      console.info('[StandaloneGraphView] Loading processed data from session…');
      const data = loadProcessedData();
      if (!data) {
        console.warn('[StandaloneGraphView] No processed data in session');
        setNotFound(true);
      } else {
        applyGraphAndFilter(data, 'session');
      }
      return;
    }

    let cancelled = false;
    setNotFound(false);
    setRouteLoadError(null);
    setGraphData(null);

    (async () => {
      console.info('[StandaloneGraphView] Loading graph from route case ids:', fromRoute);
      try {
        const results = await Promise.allSettled(fromRoute.map((id) => graphService.getCaseGraph(id)));
        const successData: GraphData[] = [];
        const failedIds: string[] = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') successData.push(r.value);
          else failedIds.push(fromRoute[i]);
        });

        if (cancelled) return;

        if (successData.length === 0) {
          setNotFound(true);
          setRouteLoadError(failedIds.length ? `Failed to load: ${failedIds.join(', ')}` : 'No graph data returned');
          return;
        }

        if (failedIds.length > 0) {
          toast.error(`Some cases failed to load: ${failedIds.join(', ')}`);
        }

        const merged = mergeMultipleCaseGraphs(successData);
        const label =
          fromRoute.length > 1 ? `Cases: ${fromRoute.join(', ')}` : `Case: ${fromRoute[0]}`;
        saveRawData(merged, label, fromRoute);
        saveProcessedData(merged);
        applyGraphAndFilter(merged, 'route');
        toast.success('Graph loaded');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[StandaloneGraphView] Route case load failed:', e);
        setNotFound(true);
        setRouteLoadError(msg);
        toast.error('Could not load graph for this URL');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [caseIdsFromRoute, applyGraphAndFilter]);

  const graphChatDataSource = useMemo<'route' | 'session'>(() => {
    const ids = caseIdsFromRoute?.filter(Boolean) ?? [];
    return ids.length > 0 ? 'route' : 'session';
  }, [caseIdsFromRoute]);

  const selectedNodeId = useMemo(() =>
    inspectorTarget?.kind === 'node' ? inspectorTarget.item.id : null,
    [inspectorTarget]
  );
  const selectedLinkId = useMemo(() =>
    inspectorTarget?.kind === 'link' ? inspectorTarget.item.id : null,
    [inspectorTarget]
  );
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

  const lastPathLayer = useMemo(
    () => (pathLayers.length ? pathLayers[pathLayers.length - 1] : null),
    [pathLayers]
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

  const handleStatsUpdate = useCallback((nodes: number, links: number) => {
    setVisibleStats({ visibleNodes: nodes, visibleLinks: links });
  }, []);

  const handleFocusNode = useCallback((nodeId: string) => {
    if (!graphData) return;
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setInspectorTarget({ kind: 'node', item: node });
    canvasRef.current?.focusNode(nodeId);
  }, [graphData]);

  const handleTogglePause = useCallback(() => {
    if (isPaused) canvasRef.current?.resumeSimulation();
    else canvasRef.current?.pauseSimulation();
    setIsPaused((v) => !v);
  }, [isPaused]);

  const handleQueryFilter = useCallback(
    (matchedNodeIds: Set<string>, matchedLinkIds: Set<string>) => {
      setQueryFilterNodeIds(matchedNodeIds.size > 0 ? matchedNodeIds : null);
      setQueryFilterLinkIds(matchedLinkIds.size > 0 ? matchedLinkIds : null);
      setPathIsolateFilterActive(false);
      setPathIsolateLayerId(null);
    },
    []
  );

  const handleNodeAction = useCallback((nodeId: string, action: NodeAction) => {
    switch (action) {
      case 'focus': handleFocusNode(nodeId); break;
      case 'show_neighbors':
      case 'expand': {
        if (!graphData) break;
        const node = graphData.nodes.find((n) => n.id === nodeId);
        if (!node) break;
        const elementId = resolveNodeElementId(node);
        const caseId =
          node.case_id?.trim() ||
          caseIdsFromRoute?.find(Boolean) ||
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
      case 'collapse':
      case 'hide_neighbors':
        toast('Collapse neighbors — local view only', { icon: '📦' });
        break;
      case 'pin': canvasRef.current?.pinNode(nodeId); toast.success('Node pinned'); break;
      case 'unpin': canvasRef.current?.unpinNode(nodeId); toast.success('Node unpinned'); break;
      case 'lock': canvasRef.current?.lockNode(nodeId); toast.success('Node locked'); break;
      case 'unlock': canvasRef.current?.unlockNode(nodeId); toast.success('Node unlocked'); break;
      case 'hide': canvasRef.current?.hideNode(nodeId); toast('Node hidden'); break;
      case 'hide_unconnected': canvasRef.current?.hideUnconnected(nodeId); break;
      case 'hide_unselected': canvasRef.current?.hideUnselected(); break;
      case 'copy_id': navigator.clipboard.writeText(nodeId).then(() => toast.success('ID copied')); break;
      case 'copy_label': {
        if (!graphData) break;
        const node = graphData.nodes.find((n) => n.id === nodeId);
        if (node) navigator.clipboard.writeText(node.label).then(() => toast.success('Label copied'));
        break;
      }
      case 'select_cluster': {
        if (!graphData) break;
        const clusterNode = graphData.nodes.find((n) => n.id === nodeId);
        if (clusterNode?.community_id !== null) {
          const ids = graphData.nodes
            .filter((n) => n.community_id === clusterNode?.community_id)
            .map((n) => n.id);
          canvasRef.current?.selectMultiple(ids);
          toast.success(`Selected ${ids.length} nodes in cluster`);
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
      case 'find_path': {
        const n = graphData?.nodes.find((x) => x.id === nodeId);
        if (n) {
          setPathSourceNode(n);
          setPathfindingOpen(true);
        }
        break;
      }
      default: break;
    }
  }, [graphData, handleFocusNode, caseIdsFromRoute]);

  const handleLinkAction = useCallback((linkId: string, action: LinkAction) => {
    switch (action) {
      case 'focus': {
        if (!graphData) break;
        const link = graphData.links.find((l) => l.id === linkId);
        if (link) setInspectorTarget({ kind: 'link', item: link });
        break;
      }
      case 'copy_id': navigator.clipboard.writeText(linkId).then(() => toast.success('ID copied')); break;
      default: break;
    }
  }, [graphData]);

  const handleCanvasAction = useCallback((action: string) => {
    if (action.startsWith('layout_')) {
      const layout = action.replace('layout_', '');
      setSettings((prev) => ({ ...prev, layout: layout as GraphSettings['layout'] }));
      return;
    }
    switch (action) {
      case 'fit_view': canvasRef.current?.fitView(); break;
      case 'reset_view': canvasRef.current?.resetView(); break;
      case 'show_all': canvasRef.current?.unhideAllNodes(); toast.success('All nodes restored'); break;
      case 'unpin_all': canvasRef.current?.unpinAllNodes(); toast.success('All unpinned'); break;
      case 'unlock_all': canvasRef.current?.unlockAllNodes(); toast.success('All unlocked'); break;
      case 'select_all': canvasRef.current?.selectAll(); break;
      case 'clear_selection': canvasRef.current?.clearMultiSelection(); break;
      case 'hide_unselected': canvasRef.current?.hideUnselected(); break;
      case 'export_png': canvasRef.current?.exportPNG(); toast.success('PNG export started'); break;
      case 'reheat_simulation': canvasRef.current?.reheatSimulation(); toast.success('Simulation reheated'); break;
      case 'export_interactive_html': setExportHtmlOpen(true); break;
    }
  }, []);

  useEffect(() => {
    const dismiss = () => setContextMenu({ visible: false, x: 0, y: 0, target: null });
    window.addEventListener('scroll', dismiss);
    return () => window.removeEventListener('scroll', dismiss);
  }, []);

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <PiGraphBold className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <Title as="h3" className="text-lg font-semibold mb-2">
          No Graph Data
        </Title>
        <Text className="text-sm text-gray-500 mb-6">
          {routeLoadError
            ? routeLoadError
            : 'Load data from the backend or a file, run the edit steps, then open the visualizer again.'}
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={() => router.push('/graph/load-data')} className="gap-2">
            <PiGraphBold className="h-4 w-4" />
            Load from backend
          </Button>
          <Button onClick={() => router.push('/graph/add-data')} className="flex items-center gap-2">
            <PiArrowLeftBold className="h-4 w-4" />
            Start from upload
          </Button>
        </div>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
    <div className="flex min-h-0 flex-col h-[calc(100vh-140px)] w-full overflow-hidden rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
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

      <div className="flex min-h-0 flex-1 overflow-hidden relative">
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
              className="absolute left-2 top-1/2 z-20 flex h-8 w-5 -translate-y-1/2 items-center justify-center rounded border border-muted bg-gray-0/90 shadow-md transition-colors hover:bg-gray-100 dark:bg-gray-50/90 dark:hover:bg-gray-200"
              title={filterOpen ? 'Hide filters' : 'Show filters'}
              onClick={() => setFilterOpen((v) => !v)}
            >
              <PiSidebarSimpleBold className="h-3 w-3 text-gray-500 dark:text-gray-600" />
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 z-20 flex h-8 w-5 -translate-y-1/2 items-center justify-center rounded border border-muted bg-gray-0/90 shadow-md transition-colors hover:bg-gray-100 dark:bg-gray-50/90 dark:hover:bg-gray-200"
              title={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
              onClick={() => setInspectorOpen((v) => !v)}
            >
              <PiSidebarSimpleFill className="h-3 w-3 text-gray-500 dark:text-gray-600" />
            </button>
            <button
              type="button"
              onClick={() => {
                const href =
                  caseIdsFromRoute && caseIdsFromRoute.length > 0
                    ? `/graph/edit-entities/${encodeURIComponent(caseIdsFromRoute.join('&'))}`
                    : '/graph/edit-entities';
                router.push(href);
              }}
              className="absolute left-10 top-3 flex items-center gap-1.5 rounded-md border border-muted bg-gray-0 px-2.5 py-1.5 text-xs text-gray-600 shadow-sm transition-colors hover:border-primary dark:bg-gray-100 dark:text-gray-400 hover:text-primary"
              title="Go back to pre-processing"
            >
              <PiArrowLeftBold className="h-3.5 w-3.5" />
              Edit Data
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

        <div
          className={cn(
            'flex-shrink-0 border-l border-muted transition-all duration-200 overflow-hidden',
            inspectorOpen ? 'w-[300px]' : 'w-0'
          )}
        >
          <div className="h-full w-[300px] overflow-hidden">
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

      <div className="shrink-0">
        <StatsBar
          stats={graphData?.stats ?? null}
          visibleNodes={visibleStats.visibleNodes}
          visibleLinks={visibleStats.visibleLinks}
        />
      </div>

      {contextMenu.visible && contextMenu.target && (
        <ContextMenu
          state={contextMenu}
          onNodeAction={handleNodeAction}
          onLinkAction={handleLinkAction}
          onCanvasAction={handleCanvasAction}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, target: null })}
        />
      )}

      {exportHtmlOpen && (
        <GraphExportModal open={exportHtmlOpen} graphData={graphData} onClose={() => setExportHtmlOpen(false)} />
      )}
    </div>
    <FloatingGraphAiChat
      pathname={pathname ?? '/graph/visual-explorer'}
      caseIdsFromRoute={caseIdsFromRoute}
      dataSource={graphChatDataSource}
      graphData={graphData}
      inspectorTarget={inspectorTarget}
      visibleNodes={visibleStats.visibleNodes}
      visibleLinks={visibleStats.visibleLinks}
      queryFilterActive={queryFilterNodeIds !== null || queryFilterLinkIds !== null}
      pathfindingOpen={pathfindingOpen}
      pathMode={lastPathLayer?.mode ?? null}
      pathSourceNode={pathSourceNode}
      pathTargetNode={lastPathLayer?.targetNode ?? null}
      pathLayers={pathLayers}
    />
    </>
  );
}
