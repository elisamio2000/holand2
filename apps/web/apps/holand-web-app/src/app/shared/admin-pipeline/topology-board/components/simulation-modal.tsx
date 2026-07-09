'use client';

import { useCallback, useMemo, useState } from 'react';
import { Badge, Button, Input, Modal, Text, Title, Loader } from 'rizzui';
import { PiPlayBold, PiFlowArrowBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { toApiToolId } from '@/utils/tool-id';
import type { LlmModel, LlmRoute, ToolRegistryEntry } from '@/types/pipeline-admin.types';
import { TopologyEdge, TopologyNode, parseEntityNodeId } from '../helpers/topology-board-types';

interface SimulationResult {
  input: string;
  resolvedModel: string | null;
  routeKey: string | null;
  fallbackUsed: boolean;
  resolvedVia: 'route' | 'binding' | 'role' | 'subgraph' | 'none';
  subgraphNodes: string[];
}

interface SimulationModalProps {
  open: boolean;
  onClose: () => void;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  routes: LlmRoute[];
  models: LlmModel[];
  tools: ToolRegistryEntry[];
  selectedNodeIds?: string[];
}

function collectSubgraph(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  seedIds: string[]
): { nodeIds: Set<string>; routeKeys: string[] } {
  const nodeIds = new Set<string>(seedIds.filter(Boolean));
  if (nodeIds.size === 0) return { nodeIds, routeKeys: [] };

  let changed = true;
  while (changed) {
    changed = false;
    edges.forEach((e) => {
      if (nodeIds.has(e.source) && !nodeIds.has(e.target)) {
        nodeIds.add(e.target);
        changed = true;
      }
      if (nodeIds.has(e.target) && !nodeIds.has(e.source)) {
        nodeIds.add(e.source);
        changed = true;
      }
    });
  }

  const routeKeys: string[] = [];
  nodes.forEach((n) => {
    if (!nodeIds.has(n.id)) return;
    if (n.data.kind === 'route' || n.data.kind === 'role') {
      routeKeys.push(n.data.entityId);
    }
    if (n.data.route?.route_key) routeKeys.push(n.data.route.route_key);
  });

  return { nodeIds, routeKeys: [...new Set(routeKeys)] };
}

async function runSubgraphSimulation(
  query: string,
  routes: LlmRoute[],
  models: LlmModel[],
  subgraphRouteKeys: string[],
  subgraphNodeIds: string[]
): Promise<SimulationResult> {
  const scopedRoutes =
    subgraphRouteKeys.length > 0
      ? routes.filter((r) => subgraphRouteKeys.includes(r.route_key))
      : routes;

  const normalized = toApiToolId(query.trim());

  const toolRoute = scopedRoutes.find(
    (r) =>
      r.is_active &&
      (r.route_key === `tool.${normalized}` || r.route_key === `tool.${query.trim()}`)
  );
  if (toolRoute) {
    const primary = models.find((m) => m.name === toolRoute.model_name && m.is_active);
    if (primary) {
      return {
        input: query,
        resolvedModel: toolRoute.model_name,
        routeKey: toolRoute.route_key,
        fallbackUsed: false,
        resolvedVia: 'binding',
        subgraphNodes: subgraphNodeIds,
      };
    }
    if (toolRoute.fallback_model_name) {
      return {
        input: query,
        resolvedModel: toolRoute.fallback_model_name,
        routeKey: toolRoute.route_key,
        fallbackUsed: true,
        resolvedVia: 'binding',
        subgraphNodes: subgraphNodeIds,
      };
    }
  }

  const exactRoute = scopedRoutes.find((r) => r.is_active && r.route_key === query.trim());
  if (exactRoute) {
    const primary = models.some((m) => m.name === exactRoute.model_name && m.is_active);
    return {
      input: query,
      resolvedModel: primary
        ? exactRoute.model_name
        : exactRoute.fallback_model_name || null,
      routeKey: exactRoute.route_key,
      fallbackUsed: !primary,
      resolvedVia: subgraphRouteKeys.length ? 'subgraph' : 'route',
      subgraphNodes: subgraphNodeIds,
    };
  }

  if (subgraphRouteKeys.length === 1) {
    const only = scopedRoutes.find((r) => r.is_active && r.route_key === subgraphRouteKeys[0]);
    if (only) {
      return {
        input: query,
        resolvedModel: only.model_name,
        routeKey: only.route_key,
        fallbackUsed: false,
        resolvedVia: 'subgraph',
        subgraphNodes: subgraphNodeIds,
      };
    }
  }

  try {
    const suggestion = await pipelineAdminService.suggestToolModel(query.trim());
    if (suggestion?.model_name) {
      return {
        input: query,
        resolvedModel: suggestion.model_name,
        routeKey: suggestion.route_key || null,
        fallbackUsed: false,
        resolvedVia: 'binding',
        subgraphNodes: subgraphNodeIds,
      };
    }
  } catch {
    // fallthrough
  }

  return {
    input: query,
    resolvedModel: null,
    routeKey: null,
    fallbackUsed: false,
    resolvedVia: 'none',
    subgraphNodes: subgraphNodeIds,
  };
}

export default function SimulationModal({
  open,
  onClose,
  nodes,
  edges,
  routes,
  models,
  tools,
  selectedNodeIds = [],
}: SimulationModalProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const seeds = useMemo(() => {
    const fromSelection = selectedNodeIds.length
      ? selectedNodeIds
      : nodes.filter((n) => n.selected).map((n) => n.id);
    if (fromSelection.length) return fromSelection;
    const route = nodes.find((n) => n.data.kind === 'route' || n.data.kind === 'role');
    return route ? [route.id] : [];
  }, [nodes, selectedNodeIds]);

  const subgraph = useMemo(
    () => collectSubgraph(nodes, edges, seeds),
    [nodes, edges, seeds]
  );

  const subgraphLabels = useMemo(() => {
    return [...subgraph.nodeIds]
      .map((id) => {
        const n = nodes.find((node) => node.id === id);
        if (!n) return id;
        const parsed = parseEntityNodeId(id);
        return parsed ? `${n.data.kind}:${parsed.entityId}` : n.data.label;
      })
      .slice(0, 8);
  }, [subgraph.nodeIds, nodes]);

  const defaultQuery = useMemo(() => {
    const routeNode = nodes.find(
      (n) => subgraph.nodeIds.has(n.id) && (n.data.kind === 'route' || n.data.kind === 'role')
    );
    if (routeNode) return routeNode.data.entityId;
    const toolNode = nodes.find(
      (n) => subgraph.nodeIds.has(n.id) && n.data.kind === 'tool'
    );
    if (toolNode) return toolNode.data.entityId;
    return tools[0]?.tool_id ?? '';
  }, [nodes, subgraph.nodeIds, tools]);

  const handleRun = useCallback(async () => {
    const query = input.trim() || defaultQuery;
    if (!query) return;
    setRunning(true);
    try {
      const sim = await runSubgraphSimulation(
        query,
        routes,
        models,
        subgraph.routeKeys,
        [...subgraph.nodeIds]
      );
      setResult(sim);
    } finally {
      setRunning(false);
    }
  }, [input, defaultQuery, routes, models, subgraph]);

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <div className="flex max-h-[85vh] flex-col overflow-hidden">
        <Title as="h4" className="border-b border-muted px-6 py-4">
          {t('pipeline.topology.board.simulateSubgraph', 'Simulate subgraph')}
        </Title>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">
              {t('pipeline.topology.board.simScope', 'Scope')}
            </Text>
            <div className="flex flex-wrap gap-1">
              {subgraphLabels.map((label) => (
                <Badge key={label} variant="outline" size="sm" className="font-mono text-[10px]">
                  {label}
                </Badge>
              ))}
              {subgraph.nodeIds.size > 8 && (
                <Badge variant="flat" size="sm">
                  +{subgraph.nodeIds.size - 8}
                </Badge>
              )}
            </div>
            <Text className="mt-1 text-[10px] text-gray-500">
              {t('pipeline.topology.board.simScopeHint', {
                nodes: subgraph.nodeIds.size,
                routes: subgraph.routeKeys.length,
                defaultValue: `${subgraph.nodeIds.size} nodes · ${subgraph.routeKeys.length} routes in subgraph`,
              })}
            </Text>
          </div>

          <Input
            label={t('pipeline.simulator.inputLabel', 'Tool or route key')}
            placeholder={defaultQuery || t('pipeline.simulator.inputPlaceholder', 'e.g. search or chat.default')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          {result && (
            <div className="rounded-lg border border-muted bg-gray-50/50 p-3 dark:bg-gray-100/30">
              <div className="mb-2 flex items-center gap-2">
                <PiFlowArrowBold className="h-4 w-4 text-primary" />
                <Text className="text-sm font-semibold">
                  {t('pipeline.simulator.result', 'Result')}
                </Text>
              </div>
              <Text className="font-mono text-sm">
                {result.resolvedModel ?? t('pipeline.simulator.noResult', 'No model resolved')}
              </Text>
              {result.routeKey && (
                <Text className="mt-1 text-xs text-gray-500">
                  {t('pipeline.simulator.routeUsed', 'Route')}: {result.routeKey}
                </Text>
              )}
              {result.fallbackUsed && (
                <Badge color="warning" size="sm" className="mt-2">
                  {t('pipeline.simulator.fallbackUsed', 'Fallback used')}
                </Badge>
              )}
              <Text className="mt-1 text-[10px] text-gray-400">
                via {result.resolvedVia}
              </Text>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-muted px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
          <Button onClick={() => void handleRun()} disabled={running}>
            {running ? (
              <Loader variant="spinner" className="mr-1 h-4 w-4" />
            ) : (
              <PiPlayBold className="mr-1 h-4 w-4" />
            )}
            {running
              ? t('pipeline.simulator.running', 'Running…')
              : t('pipeline.simulator.run', 'Run simulation')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
