'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ActionIcon } from 'rizzui';
import { PiCornersOutBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import GraphCanvas, { type GraphCanvasHandle } from '@/app/shared/graph-explorer/graph-canvas';
import GraphToolbar from '@/app/shared/graph-explorer/graph-toolbar';
import FilterSidebar from '@/app/shared/graph-explorer/filter-sidebar';
import InspectorPanel from '@/app/shared/graph-explorer/inspector-panel';
import StatsBar from '@/app/shared/graph-explorer/stats-bar';
import ContextMenu from '@/app/shared/graph-explorer/context-menu';
import LegendPanel from '@/app/shared/graph-explorer/legend-panel';
import QueryBuilder from '@/app/shared/graph-explorer/query-builder';
import PathfindingPanel from '@/app/shared/graph-explorer/pathfinding-panel';
import PathResultsStrip from '@/app/shared/graph-explorer/path-results-strip';
import { createPathfindingLayerId, type PathfindingLayerState } from '@/app/shared/graph-explorer/pathfinding-layer-state';
import { buildPathHighlightColorMaps } from '@/app/shared/graph-explorer/path-layer-colors';
import { boardSnapshotToGraphData } from '../lib/canvas/board-to-graph-data';
import { BoardGraphHeader } from './components/board-graph-header';
import { BoardGraphInspectorExtras } from './components/board-graph-inspector-extras';
import { BoardGraphSideToggles } from './components/board-graph-side-toggles';
import { BoardPanelShell } from './components/board-panel-shell';
import {
  readBoardGraphPanelPrefs,
  writeBoardGraphPanelPrefs,
  type BoardGraphPanelId,
  type BoardGraphPanelPrefs,
} from '../lib/board-graph-panel-prefs';
import type { BoardPanelMode } from '../lib/board-panel-prefs';
import type {
  BoardSnapshot,
} from '../lib/board-types';
import type {
  GraphFilter,
  GraphNode,
  GraphSettings,
  InspectorTarget,
  ContextMenuState,
  NodeAction,
  LinkAction,
  PathfindingComputation,
} from '@/types/graph-explorer.types';
import type { PathfindingMode } from '@/app/shared/graph-explorer/graph-pathfinding';

export interface BoardGraphSidePanelSlot {
  id: string;
  title: string;
  visible: boolean;
  mode: BoardPanelMode;
  onModeChange: (mode: BoardPanelMode) => void;
  onClose: () => void;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  children: ReactNode;
}

export interface BoardGraphExplorerViewProps {
  snapshot: BoardSnapshot;
  readOnly?: boolean;
  graphSettings: GraphSettings;
  onGraphSettingsChange: (settings: GraphSettings) => void;
  graphFilter: GraphFilter;
  onGraphFilterChange: (filter: GraphFilter) => void;
  onNodeMove?: (id: string, x: number, y: number) => void;
  onLayoutChange?: (layout: Record<string, { x: number; y: number }>) => void;
  onApplyToCanvas?: () => void;
  onSelectBoardObject?: (objectId: string) => void;
  onDragGestureStart?: () => void;
  onDragGestureEnd?: () => void;
  autoLayoutToken?: number;
  className?: string;
  /** Selection / board settings panels docked in graph workspace right rail (desktop). */
  selectionSidePanel?: BoardGraphSidePanelSlot | null;
  settingsSidePanel?: BoardGraphSidePanelSlot | null;
}

export function BoardGraphExplorerView({
  snapshot,
  readOnly = false,
  graphSettings,
  onGraphSettingsChange,
  graphFilter,
  onGraphFilterChange,
  onNodeMove,
  onLayoutChange,
  onApplyToCanvas,
  onSelectBoardObject,
  onDragGestureStart,
  onDragGestureEnd,
  autoLayoutToken = 0,
  className,
  selectionSidePanel,
  settingsSidePanel,
}: BoardGraphExplorerViewProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<Record<string, { x: number; y: number }>>(snapshot.graphLayout ?? {});

  const graphData = useMemo(
    () => boardSnapshotToGraphData(snapshot),
    [snapshot, snapshot.graphTopologyFingerprint, snapshot.objects, snapshot.graphLayout]
  );

  const settings = graphSettings;
  const filter = graphFilter;
  const setSettings = onGraphSettingsChange;
  const setFilter = onGraphFilterChange;

  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    target: null,
  });
  const [panelPrefs, setPanelPrefs] = useState<BoardGraphPanelPrefs>(() => readBoardGraphPanelPrefs());
  const [showLegend, setShowLegend] = useState(true);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [queryFilterNodeIds, setQueryFilterNodeIds] = useState<Set<string> | null>(null);
  const [queryFilterLinkIds, setQueryFilterLinkIds] = useState<Set<string> | null>(null);
  const [visibleStats, setVisibleStats] = useState({ visibleNodes: 0, visibleLinks: 0 });
  const [pathfindingOpen, setPathfindingOpen] = useState(false);
  const [pathResultsStripDismissed, setPathResultsStripDismissed] = useState(false);
  const [pickedDestinationFromGraph, setPickedDestinationFromGraph] = useState<string | null>(null);
  const [pathSourceNode, setPathSourceNode] = useState<GraphNode | null>(null);
  const [pathLayers, setPathLayers] = useState<PathfindingLayerState[]>([]);
  const [pathIsolateFilterActive, setPathIsolateFilterActive] = useState(false);
  const [pathIsolateLayerId, setPathIsolateLayerId] = useState<string | null>(null);

  useEffect(() => {
    writeBoardGraphPanelPrefs(panelPrefs);
  }, [panelPrefs]);

  const setGraphPanelMode = useCallback((id: BoardGraphPanelId, mode: BoardPanelMode) => {
    setPanelPrefs((prev) => ({ ...prev, [id]: { ...prev[id], mode } }));
  }, []);

  const setGraphPanelVisible = useCallback((id: BoardGraphPanelId, visible: boolean) => {
    setPanelPrefs((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        visible,
        ...(visible ? { mode: 'docked' as BoardPanelMode } : {}),
      },
    }));
  }, []);

  const toggleGraphPanelVisible = useCallback((id: BoardGraphPanelId) => {
    setPanelPrefs((prev) => {
      const nextVisible = !prev[id].visible;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          visible: nextVisible,
          mode: nextVisible ? 'docked' : prev[id].mode,
        },
      };
    });
  }, []);

  const filterPanel = panelPrefs.filter;
  const inspectorPanel = panelPrefs.inspector;

  const inspectorTargetKey = useMemo(() => {
    if (!inspectorTarget) return null;
    if (inspectorTarget.kind === 'node' || inspectorTarget.kind === 'link') {
      return `${inspectorTarget.kind}:${inspectorTarget.item.id}`;
    }
    if (inspectorTarget.kind === 'community') {
      return `community:${inspectorTarget.item.community_id ?? 'unknown'}`;
    }
    return null;
  }, [inspectorTarget]);

  const prevInspectorTargetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!inspectorTargetKey) {
      prevInspectorTargetKeyRef.current = null;
      return;
    }
    if (inspectorTargetKey !== prevInspectorTargetKeyRef.current) {
      prevInspectorTargetKeyRef.current = inspectorTargetKey;
      setGraphPanelVisible('inspector', true);
    }
  }, [inspectorTargetKey, setGraphPanelVisible]);

  const selectedNodeId = inspectorTarget?.kind === 'node' ? inspectorTarget.item.id : null;
  const selectedLinkId = inspectorTarget?.kind === 'link' ? inspectorTarget.item.id : null;

  const pathHighlightMaps = useMemo(
    () => buildPathHighlightColorMaps(graphData, pathLayers),
    [graphData, pathLayers]
  );

  const pathSessionActive = pathLayers.some((l) => l.results[l.activeResultIndex]?.found);
  const pathResultsSummaryAvailable = pathSessionActive;
  const pathResultsStripVisible = pathSessionActive && !pathResultsStripDismissed;

  const nodeIdLabelMap = useMemo(
    () => new Map(graphData.nodes.map((n) => [n.id, n])),
    [graphData.nodes]
  );

  const highlightedNodeIds = useMemo(() => {
    if (!filter.highlightPath || !selectedNodeId) return new Set<string>();
    const ids = new Set<string>([selectedNodeId]);
    for (const link of graphData.links) {
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      if (src === selectedNodeId) ids.add(tgt);
      if (tgt === selectedNodeId) ids.add(src);
    }
    return ids;
  }, [filter.highlightPath, selectedNodeId, graphData.links]);

  useEffect(() => {
    layoutRef.current = snapshot.graphLayout ?? {};
    requestAnimationFrame(() => {
      for (const node of graphData.nodes) {
        const pos = snapshot.graphLayout?.[node.id];
        if (pos) canvasRef.current?.pinNode(node.id);
      }
      canvasRef.current?.fitView();
    });
  }, [autoLayoutToken, graphData.nodes, snapshot.graphLayout]);

  const handleStatsUpdate = useCallback((visibleNodes: number, visibleLinks: number) => {
    setVisibleStats({ visibleNodes, visibleLinks });
  }, []);

  const handleQueryFilter = useCallback((nodeIds: Set<string>, linkIds: Set<string>) => {
    setQueryFilterNodeIds(nodeIds);
    setQueryFilterLinkIds(linkIds);
  }, []);

  const handleSelectTarget = useCallback(
    (target: InspectorTarget) => {
      setInspectorTarget(target);
      if (target?.kind === 'node') {
        onSelectBoardObject?.(target.item.id);
      }
    },
    [onSelectBoardObject]
  );

  const handleNodeDragEnd = useCallback(
    (nodeId: string, x: number, y: number) => {
      layoutRef.current = { ...layoutRef.current, [nodeId]: { x, y } };
      onNodeMove?.(nodeId, x, y);
      onLayoutChange?.(layoutRef.current);
      onDragGestureEnd?.();
    },
    [onNodeMove, onLayoutChange, onDragGestureEnd]
  );

  const handlePathComplete = useCallback(
    (results: PathfindingComputation[], mode: PathfindingMode, target: GraphNode) => {
      if (!pathSourceNode) return;
      const layer: PathfindingLayerState = {
        id: createPathfindingLayerId(),
        sourceNode: pathSourceNode,
        targetNode: target,
        mode,
        results,
        activeResultIndex: 0,
        highlightEnabled: true,
        expanded: true,
      };
      setPathLayers((prev) => prev.map((l) => ({ ...l, expanded: false })).concat(layer));
      setPathResultsStripDismissed(false);
    },
    [pathSourceNode]
  );

  const handleNodeAction = useCallback(
    (nodeId: string, action: NodeAction) => {
      switch (action) {
        case 'focus':
          canvasRef.current?.focusNode(nodeId);
          break;
        case 'pin':
          canvasRef.current?.pinNode(nodeId);
          toast.success(t('boards.graph.nodePinned', 'Node pinned'));
          break;
        case 'unpin':
          canvasRef.current?.unpinNode(nodeId);
          toast.success(t('boards.graph.nodeUnpinned', 'Node unpinned'));
          break;
        case 'hide':
          canvasRef.current?.hideNode(nodeId);
          break;
        case 'find_path': {
          const n = graphData.nodes.find((x) => x.id === nodeId);
          if (n) {
            setPathSourceNode(n);
            setPathfindingOpen(true);
          }
          break;
        }
        case 'copy_id':
          navigator.clipboard.writeText(nodeId).then(() => toast.success(t('boards.graph.idCopied', 'ID copied')));
          break;
        case 'copy_label': {
          const node = graphData.nodes.find((n) => n.id === nodeId);
          if (node) navigator.clipboard.writeText(node.label).then(() => toast.success(t('boards.graph.labelCopied', 'Label copied')));
          break;
        }
        default:
          break;
      }
    },
    [graphData.nodes, t]
  );

  const handleLinkAction = useCallback((linkId: string, action: LinkAction) => {
    if (action === 'copy_id') {
      navigator.clipboard.writeText(linkId).then(() => toast.success('ID copied'));
    }
  }, []);

  const handleCanvasAction = useCallback((action: string) => {
    if (action.startsWith('layout_')) {
      const layout = action.replace('layout_', '');
      setSettings({ ...settings, layout: layout as GraphSettings['layout'] });
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
        break;
      default:
        break;
    }
  }, [settings, setSettings]);

  const handlePathfindingToolbarClick = useCallback(() => {
    if (pathSessionActive) {
      setPathfindingOpen((v) => !v);
      return;
    }
    if (inspectorTarget?.kind === 'node') {
      setPathSourceNode(inspectorTarget.item);
      setPathfindingOpen(true);
    }
  }, [pathSessionActive, inspectorTarget]);

  useEffect(() => {
    const dismiss = () => setContextMenu({ visible: false, x: 0, y: 0, target: null });
    window.addEventListener('scroll', dismiss);
    return () => window.removeEventListener('scroll', dismiss);
  }, []);

  if (graphData.nodes.length === 0) {
    return (
      <div className={`flex h-full flex-col ${className ?? ''}`}>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-muted bg-white px-2 py-1.5 dark:bg-gray-100 sm:gap-2 sm:px-3 sm:py-2">
          <BoardGraphHeader nodeCount={0} edgeCount={0} inline />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-gray-500">
          <p>{t('boards.graph.empty', 'Add nodes on the canvas to see the graph view')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col ${className ?? ''}`}>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-muted bg-white px-2 py-1.5 dark:bg-gray-100 sm:gap-2 sm:px-3 sm:py-2">
        <BoardGraphHeader
          nodeCount={graphData.stats.entity_count}
          edgeCount={graphData.stats.relationship_count}
          inline
        />
        <GraphToolbar
          embedded
          hideDisplaySettings
          className="min-w-0 flex-1"
          settings={settings}
          onSettingsChange={setSettings}
          canvasRef={canvasRef as React.RefObject<GraphCanvasHandle>}
          isPaused={isPaused}
          onPauseToggle={() => {
            if (isPaused) canvasRef.current?.resumeSimulation?.();
            else canvasRef.current?.pauseSimulation?.();
            setIsPaused((v) => !v);
          }}
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
          onPathResultsSummaryToggle={() => setPathResultsStripDismissed((v) => !v)}
          filterPanelOpen={filterPanel.visible}
          onToggleFilterPanel={() => toggleGraphPanelVisible('filter')}
          inspectorPanelOpen={inspectorPanel.visible}
          onToggleInspectorPanel={() => toggleGraphPanelVisible('inspector')}
        />
        {!readOnly && onApplyToCanvas ? (
          <Tooltip content={t('boards.graph.applyToCanvasHint', 'Apply graph positions to canvas nodes')} placement="bottom">
            <ActionIcon
              size="sm"
              variant="outline"
              onClick={onApplyToCanvas}
              className="shrink-0"
              aria-label={t('boards.graph.applyToCanvas', 'Apply to canvas')}
            >
              <PiCornersOutBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        ) : null}
      </div>

      <div className={cn('shrink-0 border-b border-muted', !showQueryBuilder && 'hidden')}>
        <QueryBuilder graphData={graphData} onApplyFilter={handleQueryFilter} className="border-0 rounded-none" />
      </div>

      <div ref={workspaceRef} className="relative flex min-h-0 flex-1 overflow-hidden">
        {filterPanel.visible && filterPanel.mode === 'docked' ? (
          <BoardPanelShell
            id="board-graph-filter"
            title={t('boards.graph.filterPanel', 'Graph filter')}
            visible
            mode="docked"
            side="left"
            defaultWidth={280}
            minWidth={240}
            maxWidth={400}
            supportsPopout={false}
            onModeChange={(mode) => setGraphPanelMode('filter', mode)}
            onClose={() => setGraphPanelVisible('filter', false)}
          >
            <FilterSidebar filter={filter} data={graphData} onFilterChange={setFilter} />
          </BoardPanelShell>
        ) : null}

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
            onPathfindingDestinationPicked={setPickedDestinationFromGraph}
            onSelectTarget={handleSelectTarget}
            onContextMenu={setContextMenu}
            onStatsUpdate={handleStatsUpdate}
            onNodeAction={handleNodeAction}
            onLinkAction={handleLinkAction}
            persistDragPositions={!readOnly}
            onNodeDragGestureStart={onDragGestureStart}
            onNodeDragGestureEnd={handleNodeDragEnd}
          />
          {pathResultsStripVisible ? (
            <PathResultsStrip
              layers={pathLayers}
              graphData={graphData}
              nodeMap={nodeIdLabelMap}
              onLayerActiveResultChange={(layerId, index) =>
                setPathLayers((prev) =>
                  prev.map((l) => (l.id === layerId ? { ...l, activeResultIndex: index } : l))
                )
              }
              onLayerHighlightToggle={(layerId, enabled) =>
                setPathLayers((prev) =>
                  prev.map((l) => (l.id === layerId ? { ...l, highlightEnabled: enabled } : l))
                )
              }
              onLayerExpandedChange={(layerId, expanded) =>
                setPathLayers((prev) =>
                  prev.map((l) => (l.id === layerId ? { ...l, expanded } : l))
                )
              }
              onRemoveLayer={(layerId) => setPathLayers((prev) => prev.filter((l) => l.id !== layerId))}
              onDismissStrip={() => setPathResultsStripDismissed(true)}
              isolateFilterActive={pathIsolateFilterActive}
              isolateLayerId={pathIsolateLayerId}
              onReleaseIsolate={() => setPathIsolateFilterActive(false)}
              onClearSession={() => {
                setPathLayers([]);
                setPathIsolateFilterActive(false);
              }}
              onFitPath={(nodeIds) => canvasRef.current?.fitToNodes?.(nodeIds)}
              onIsolatePath={(layerId, nodeIds, linkIds) => {
                setPathIsolateFilterActive(true);
                setPathIsolateLayerId(layerId);
                setQueryFilterNodeIds(new Set(nodeIds));
                setQueryFilterLinkIds(new Set(linkIds));
              }}
            />
          ) : null}
          {showLegend ? (
            <LegendPanel data={graphData} visible={showLegend} onToggle={() => setShowLegend((v) => !v)} />
          ) : null}
          <BoardGraphSideToggles
            showLegend={showLegend}
            onToggleLegend={() => setShowLegend((v) => !v)}
          />
          {pathfindingOpen && pathSourceNode ? (
            <PathfindingPanel
              open={pathfindingOpen}
              graphData={graphData}
              sourceNode={pathSourceNode}
              onClose={() => setPathfindingOpen(false)}
              onComplete={handlePathComplete}
              pickedDestinationId={pickedDestinationFromGraph}
              onConsumePickedDestination={() => setPickedDestinationFromGraph(null)}
              pathSessionActive={pathSessionActive}
              onClearSession={() => setPathLayers([])}
              pathIsolateFilterActive={pathIsolateFilterActive}
              onReleaseIsolate={() => setPathIsolateFilterActive(false)}
            />
          ) : null}
        </div>

        {inspectorPanel.visible && inspectorPanel.mode === 'docked' ? (
          <BoardPanelShell
            id="board-graph-inspector"
            title={t('boards.graph.inspectorPanel', 'Graph inspector')}
            visible
            mode="docked"
            side="right"
            defaultWidth={300}
            minWidth={260}
            maxWidth={420}
            supportsPopout={false}
            onModeChange={(mode) => setGraphPanelMode('inspector', mode)}
            onClose={() => setGraphPanelVisible('inspector', false)}
            className="!overflow-hidden"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <BoardGraphInspectorExtras
                node={inspectorTarget?.kind === 'node' ? inspectorTarget.item : null}
                onShowOnCanvas={
                  inspectorTarget?.kind === 'node' && onSelectBoardObject
                    ? () => onSelectBoardObject(inspectorTarget.item.id)
                    : undefined
                }
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                <InspectorPanel
                  target={inspectorTarget}
                  data={graphData}
                  onClose={() => setInspectorTarget(null)}
                  onNodeAction={handleNodeAction}
                  onLinkAction={handleLinkAction}
                  onSelectNode={(id) => {
                    const node = graphData.nodes.find((n) => n.id === id);
                    if (node) handleSelectTarget({ kind: 'node', item: node });
                  }}
                />
              </div>
            </div>
          </BoardPanelShell>
        ) : null}

        {selectionSidePanel?.visible && selectionSidePanel.mode === 'docked' ? (
          <div className="hidden shrink-0 lg:flex">
            <BoardPanelShell
              id={selectionSidePanel.id}
              title={selectionSidePanel.title}
              visible
              mode="docked"
              side="right"
              defaultWidth={selectionSidePanel.defaultWidth ?? 280}
              minWidth={selectionSidePanel.minWidth ?? 240}
              maxWidth={selectionSidePanel.maxWidth ?? 420}
              onModeChange={selectionSidePanel.onModeChange}
              onClose={selectionSidePanel.onClose}
            >
              {selectionSidePanel.children}
            </BoardPanelShell>
          </div>
        ) : null}

        {settingsSidePanel?.visible && settingsSidePanel.mode === 'docked' ? (
          <div className="hidden shrink-0 lg:flex">
            <BoardPanelShell
              id={settingsSidePanel.id}
              title={settingsSidePanel.title}
              visible
              mode="docked"
              side="right"
              defaultWidth={settingsSidePanel.defaultWidth ?? 280}
              minWidth={settingsSidePanel.minWidth ?? 240}
              maxWidth={settingsSidePanel.maxWidth ?? 420}
              onModeChange={settingsSidePanel.onModeChange}
              onClose={settingsSidePanel.onClose}
            >
              {settingsSidePanel.children}
            </BoardPanelShell>
          </div>
        ) : null}

        {filterPanel.visible && filterPanel.mode !== 'docked' ? (
          <BoardPanelShell
            id="board-graph-filter-float"
            title={t('boards.graph.filterPanel', 'Graph filter')}
            visible
            mode={filterPanel.mode}
            side="left"
            defaultWidth={280}
            minWidth={240}
            maxWidth={400}
            supportsPopout={false}
            floatAnchorRef={workspaceRef}
            onModeChange={(mode) => setGraphPanelMode('filter', mode)}
            onClose={() => setGraphPanelVisible('filter', false)}
          >
            <FilterSidebar filter={filter} data={graphData} onFilterChange={setFilter} />
          </BoardPanelShell>
        ) : null}

        {inspectorPanel.visible && inspectorPanel.mode !== 'docked' ? (
          <BoardPanelShell
            id="board-graph-inspector-float"
            title={t('boards.graph.inspectorPanel', 'Graph inspector')}
            visible
            mode={inspectorPanel.mode}
            side="right"
            defaultWidth={300}
            minWidth={260}
            maxWidth={420}
            supportsPopout={false}
            floatAnchorRef={workspaceRef}
            onModeChange={(mode) => setGraphPanelMode('inspector', mode)}
            onClose={() => setGraphPanelVisible('inspector', false)}
          >
            <div className="flex min-h-0 flex-col">
              <BoardGraphInspectorExtras
                node={inspectorTarget?.kind === 'node' ? inspectorTarget.item : null}
                onShowOnCanvas={
                  inspectorTarget?.kind === 'node' && onSelectBoardObject
                    ? () => onSelectBoardObject(inspectorTarget.item.id)
                    : undefined
                }
              />
              <InspectorPanel
                target={inspectorTarget}
                data={graphData}
                onClose={() => setInspectorTarget(null)}
                onNodeAction={handleNodeAction}
                onLinkAction={handleLinkAction}
                onSelectNode={(id) => {
                  const node = graphData.nodes.find((n) => n.id === id);
                  if (node) handleSelectTarget({ kind: 'node', item: node });
                }}
              />
            </div>
          </BoardPanelShell>
        ) : null}

        {selectionSidePanel?.visible && selectionSidePanel.mode === 'floating' ? (
          <BoardPanelShell
            id={`${selectionSidePanel.id}-float`}
            title={selectionSidePanel.title}
            visible
            mode="floating"
            side="right"
            defaultWidth={selectionSidePanel.defaultWidth ?? 280}
            minWidth={selectionSidePanel.minWidth ?? 240}
            maxWidth={selectionSidePanel.maxWidth ?? 420}
            floatAnchorRef={workspaceRef}
            onModeChange={selectionSidePanel.onModeChange}
            onClose={selectionSidePanel.onClose}
          >
            {selectionSidePanel.children}
          </BoardPanelShell>
        ) : null}

        {settingsSidePanel?.visible && settingsSidePanel.mode === 'floating' ? (
          <BoardPanelShell
            id={`${settingsSidePanel.id}-float`}
            title={settingsSidePanel.title}
            visible
            mode="floating"
            side="right"
            defaultWidth={settingsSidePanel.defaultWidth ?? 280}
            minWidth={settingsSidePanel.minWidth ?? 240}
            maxWidth={settingsSidePanel.maxWidth ?? 420}
            floatAnchorRef={workspaceRef}
            onModeChange={settingsSidePanel.onModeChange}
            onClose={settingsSidePanel.onClose}
          >
            {settingsSidePanel.children}
          </BoardPanelShell>
        ) : null}
      </div>

      <StatsBar
        stats={graphData.stats}
        visibleNodes={visibleStats.visibleNodes}
        visibleLinks={visibleStats.visibleLinks}
      />

      <ContextMenu
        state={contextMenu}
        onNodeAction={handleNodeAction}
        onLinkAction={handleLinkAction}
        onCanvasAction={handleCanvasAction}
        onClose={() => setContextMenu({ visible: false, x: 0, y: 0, target: null })}
      />
    </div>
  );
}
