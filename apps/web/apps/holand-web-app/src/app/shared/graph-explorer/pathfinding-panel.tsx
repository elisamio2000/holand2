'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { Badge, Button, Input, Text, Title } from 'rizzui';
import {
  PiCaretDownBold,
  PiCaretRightBold,
  PiLightningBold,
  PiPathBold,
  PiTreeStructureBold,
  PiXBold,
  PiTrashBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { formatGraphPluginError } from '@/utils/graph-plugin-errors';
import { getEntityConfig } from '@/config/graph-config';
import type { EntityType, GraphData, GraphNode, PathConstraints } from '@/types/graph-explorer.types';
import { GRAPH_ENTITY_ICONS } from './graph-entity-icons';
import {
  findShortestPath,
  findStrongestPath,
  findKShortestPaths,
  resolveNodeElementId,
  serverPathsToComputations,
  type PathfindingMode,
} from './graph-pathfinding';
import { graphService } from '@/services/graph-explorer.service';

export interface PathfindingPanelProps {
  open: boolean;
  graphData: GraphData;
  sourceNode: GraphNode;
  onClose: () => void;
  onComplete: (
    results: import('@/types/graph-explorer.types').PathfindingComputation[],
    mode: PathfindingMode,
    target: GraphNode
  ) => void;
  /** When set (e.g. after a graph click), applies as destination then clears via onConsumePickedDestination */
  pickedDestinationId?: string | null;
  onConsumePickedDestination?: () => void;
  /** Parent has a finished path and/or path isolate filter — show clear-session control. */
  pathSessionActive?: boolean;
  /** Clear path highlight, isolate filter, and source (toolbar chip hides after this). */
  onClearSession?: () => void;
  /** Graph is narrowed by path isolate — offer release without ending the whole session. */
  pathIsolateFilterActive?: boolean;
  onReleaseIsolate?: () => void;
}

export default function PathfindingPanel({
  open,
  graphData,
  sourceNode,
  onClose,
  onComplete,
  pickedDestinationId,
  onConsumePickedDestination,
  pathSessionActive,
  onClearSession,
  pathIsolateFilterActive,
  onReleaseIsolate,
}: PathfindingPanelProps) {
  const [mode, setMode] = useState<PathfindingMode>('shortest');
  const [k, setK] = useState(3);
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [allowedRelations, setAllowedRelations] = useState<string[]>([]);
  const [allowedNodeTypes, setAllowedNodeTypes] = useState<string[]>([]);
  const [pathEngine, setPathEngine] = useState<'client' | 'server'>('client');
  const [serverRunning, setServerRunning] = useState(false);

  const reset = useCallback(() => {
    setMode('shortest');
    setK(3);
    setSearch('');
    setTargetId(null);
    setConstraintsOpen(false);
    setAllowedRelations([]);
    setAllowedNodeTypes([]);
  }, []);

  /** Reset form when the graph source node changes — not when the panel opens/closes, so toggling the sidebar keeps destination & constraints. */
  useEffect(() => {
    reset();
  }, [sourceNode.id, reset]);

  useEffect(() => {
    if (!pickedDestinationId) return;
    if (pickedDestinationId === sourceNode.id) {
      toast.error('Pick a node other than the source');
      onConsumePickedDestination?.();
      return;
    }
    const node = graphData.nodes.find((n) => n.id === pickedDestinationId);
    if (!node) {
      onConsumePickedDestination?.();
      return;
    }
    setTargetId(pickedDestinationId);
    onConsumePickedDestination?.();
    toast.success(`Destination: ${node.label}`);
  }, [pickedDestinationId, sourceNode.id, graphData.nodes, onConsumePickedDestination]);

  const uniqueRelations = useMemo(() => {
    const s = new Set<string>();
    graphData.links.forEach((l) => s.add(String(l.relation)));
    return [...s].sort();
  }, [graphData.links]);

  const uniqueTypes = useMemo(() => {
    const s = new Set<string>();
    graphData.nodes.forEach((n) => s.add(n.type));
    return [...s].sort();
  }, [graphData.nodes]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return graphData.nodes
      .filter((n) => n.id !== sourceNode.id)
      .filter((n) => {
        if (!q) return true;
        return (
          n.label.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 80);
  }, [graphData.nodes, sourceNode.id, search]);

  const targetNode = useMemo(
    () => (targetId ? graphData.nodes.find((n) => n.id === targetId) ?? null : null),
    [graphData.nodes, targetId]
  );

  const handleDismiss = () => {
    onClose();
  };

  const handleClearSession = () => {
    onClearSession?.();
    onClose();
  };

  const handleRun = () => {
    if (!targetId || !targetNode) {
      toast.error('Select a destination node');
      return;
    }

    if (pathEngine === 'server') {
      void (async () => {
        const fromEid = resolveNodeElementId(sourceNode);
        const toEid = resolveNodeElementId(targetNode);
        if (!fromEid || !toEid) {
          toast.error('Server pathfinding requires Neo4j elementId on both nodes');
          return;
        }
        setServerRunning(true);
        try {
          const { paths } = await graphService.findPathBetweenElements(fromEid, toEid, {
            maxHops: 8,
            allPaths: mode === 'k_shortest',
          });
          const results = serverPathsToComputations(paths, graphData, sourceNode.id, targetId);
          if (!results.length) {
            toast.error('No path found on server (Neo4j path_find)');
            return;
          }
          onComplete(results, mode, targetNode);
          toast.success(results.length > 1 ? `${results.length} paths found (server)` : 'Path found (server)');
          onClose();
        } catch (err) {
          toast.error(formatGraphPluginError(err, 'path_find'));
        } finally {
          setServerRunning(false);
        }
      })();
      return;
    }

    const constraints: PathConstraints = {};
    if (allowedRelations.length) constraints.allowedRelations = allowedRelations;
    if (allowedNodeTypes.length) constraints.allowedNodeTypes = allowedNodeTypes;

    let results: import('@/types/graph-explorer.types').PathfindingComputation[] = [];
    if (mode === 'shortest') {
      const r = findShortestPath(graphData, sourceNode.id, targetId, true, constraints);
      results = r.found ? [r] : [];
    } else if (mode === 'strongest') {
      const r = findStrongestPath(graphData, sourceNode.id, targetId, constraints);
      results = r.found ? [r] : [];
    } else {
      results = findKShortestPaths(graphData, sourceNode.id, targetId, k, constraints);
    }

    if (!results.length || !results[0]?.found) {
      toast.error('No path found with the current constraints');
      return;
    }
    onComplete(results, mode, targetNode);
    toast.success(results.length > 1 ? `${results.length} paths found` : 'Path found');
    onClose();
  };

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  if (!open) {
    return null;
  }

  const sourceCfg = getEntityConfig(sourceNode.type as EntityType);

  return (
    <aside
      className="flex h-full w-[min(100%,340px)] shrink-0 flex-col overflow-hidden border-l border-muted bg-gray-0 shadow-[inset_1px_0_0_0] shadow-muted/30 dark:bg-gray-50"
      aria-labelledby="pathfinding-title"
    >
      <div className="flex items-start justify-between border-b border-muted px-3 py-2.5">
        <div className="min-w-0 flex-1 pr-2">
          <Title as="h3" id="pathfinding-title" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
            Pathfinding
          </Title>
          <Text className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Source
          </Text>
          <div className="mt-1.5 flex min-w-0 items-center gap-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: sourceCfg.bgColor, color: sourceCfg.color }}
              aria-hidden
            >
              {GRAPH_ENTITY_ICONS[sourceNode.type as EntityType] ?? GRAPH_ENTITY_ICONS.unknown}
            </div>
            <div className="min-w-0 flex-1">
              <Text className="truncate text-sm font-semibold text-gray-900 dark:text-gray-700">
                {sourceNode.label}
              </Text>
              <Badge size="sm" className="mt-0.5" style={{ backgroundColor: sourceCfg.bgColor, color: sourceCfg.color }}>
                {sourceCfg.label}
              </Badge>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200"
          onClick={handleDismiss}
          aria-label="Close"
        >
          <PiXBold className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <div className="space-y-2">
          <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">Engine</Text>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPathEngine('client')}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors',
                pathEngine === 'client'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-200'
              )}
            >
              Client (canvas)
            </button>
            <button
              type="button"
              onClick={() => setPathEngine('server')}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors',
                pathEngine === 'server'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-200'
              )}
            >
              Server (Neo4j)
            </button>
          </div>
          {pathEngine === 'server' && (
            <Text className="text-[10px] text-gray-500 leading-relaxed">
              Uses `plugin_graph_explorer_path_find` — both nodes need Neo4j elementId in properties.
            </Text>
          )}
        </div>

        <div className="space-y-2">
          <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">Algorithm</Text>
          <div className="grid gap-2">
            <AlgoCard
              active={mode === 'shortest'}
              onClick={() => setMode('shortest')}
              icon={<PiPathBold className="h-4 w-4 text-blue-500" />}
              title="Shortest (weighted)"
              hint="Dijkstra — minimize inverted edge strength along the route."
            />
            <AlgoCard
              active={mode === 'strongest'}
              onClick={() => setMode('strongest')}
              icon={<PiLightningBold className="h-4 w-4 text-amber-500" />}
              title="Strongest (bottleneck)"
              hint="Maximize the weakest link on the path."
            />
            <AlgoCard
              active={mode === 'k_shortest'}
              onClick={() => setMode('k_shortest')}
              icon={<PiTreeStructureBold className="h-4 w-4 text-purple-500" />}
              title="K shortest (Yen)"
              hint="Alternative routes for comparison."
            />
            {mode === 'k_shortest' && (
              <div className="flex items-center gap-2 pt-1">
                <Text className="text-xs text-gray-500">K</Text>
                <input
                  type="range"
                  min={2}
                  max={5}
                  value={k}
                  onChange={(e) => setK(Number(e.target.value))}
                  className="h-1.5 flex-1 accent-purple-600"
                />
                <span className="w-6 text-center font-mono text-xs">{k}</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-muted">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-200/80"
            onClick={() => setConstraintsOpen((v) => !v)}
          >
            <span>Traversal constraints</span>
            {constraintsOpen ? (
              <PiCaretDownBold className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
            ) : (
              <PiCaretRightBold className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
            )}
          </button>
          {constraintsOpen && (
            <div className="space-y-3 border-t border-muted px-3 pb-3 pt-2">
              <Text className="text-[10px] uppercase tracking-wide text-gray-500">Allowed relations (optional)</Text>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {uniqueRelations.map((rel) => (
                  <button
                    key={rel}
                    type="button"
                    onClick={() => toggle(allowedRelations, rel, setAllowedRelations)}
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[10px]',
                      allowedRelations.includes(rel)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-200'
                    )}
                  >
                    {rel}
                  </button>
                ))}
              </div>
              <Text className="text-[10px] uppercase tracking-wide text-gray-500">Allowed node types (optional)</Text>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {uniqueTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggle(allowedNodeTypes, t, setAllowedNodeTypes)}
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[10px]',
                      allowedNodeTypes.includes(t)
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-muted text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-200'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <Text className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">Destination</Text>
          <Text className="mb-2 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
            Search below, or left-click any node on the graph (except the source) to set the destination. Hold Ctrl/Cmd
            to multi-select without changing destination.
          </Text>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by label, id, or type…"
            className="mb-2"
          />
          {targetNode && (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-2 py-1.5 text-xs">
              <span className="truncate font-medium">{targetNode.label}</span>
              <button type="button" className="text-gray-500 hover:text-gray-800" onClick={() => setTargetId(null)}>
                <PiXBold className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="max-h-40 overflow-y-auto rounded-lg border border-muted">
            {candidates.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">No nodes match</div>
            ) : (
              candidates.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setTargetId(n.id)}
                  className={cn(
                    'flex w-full items-center gap-2 border-b border-muted px-2.5 py-2 text-left text-xs last:border-0 hover:bg-gray-100 dark:hover:bg-gray-200',
                    targetId === n.id && 'bg-primary/5'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{n.label}</span>
                  <span className="flex-shrink-0 text-[10px] text-gray-400">{n.type}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-muted bg-gray-0/90 px-3 py-2.5 dark:bg-gray-50/90">
        {pathIsolateFilterActive && onReleaseIsolate && (
          <Button
            variant="outline"
            size="sm"
            className="mr-auto border-amber-400 text-amber-800 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-950/40"
            onClick={() => {
              onReleaseIsolate();
            }}
          >
            Exit isolate
          </Button>
        )}
        {pathSessionActive && onClearSession && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40',
              pathIsolateFilterActive && onReleaseIsolate ? '' : 'mr-auto'
            )}
            onClick={handleClearSession}
          >
            <PiTrashBold className="mr-1 inline h-3.5 w-3.5" />
            Clear session
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleDismiss}>
          Close
        </Button>
        <Button size="sm" onClick={handleRun} disabled={!targetId || serverRunning} isLoading={serverRunning}>
          Find path
        </Button>
      </div>
    </aside>
  );
}

function AlgoCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full gap-3 rounded-lg border-2 p-2.5 text-left transition-colors',
        active ? 'border-primary bg-primary/5' : 'border-muted hover:border-gray-300 dark:hover:border-gray-500'
      )}
    >
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-xs font-semibold text-gray-900 dark:text-gray-700">{title}</div>
        <div className="mt-0.5 text-[10px] leading-snug text-gray-500">{hint}</div>
      </div>
    </button>
  );
}
