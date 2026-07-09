'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { modelHealthKind, type ModelHealthKind } from '@/utils/model-health';
import type { LlmModel, LlmModelHealth } from '@/types/pipeline-admin.types';
import { resolveLogicalId, findModelByEntityId } from '../../helpers/logical-model-options';
import { TopologyEdge, TopologyNode, parseEntityNodeId } from '../helpers/topology-board-types';

export type EdgePulseKind = ModelHealthKind | 'pulse';

export interface HealthPulseState {
  edgePulse: Record<string, EdgePulseKind>;
  modelHealth: Record<string, ModelHealthKind>;
  isPolling: boolean;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000;

function resolveHealthForModel(
  model: LlmModel,
  healthMap: Record<string, LlmModelHealth | null | undefined>
): ModelHealthKind {
  const byName = healthMap[model.name];
  if (byName) return byName.healthy === false ? 'unhealthy' : 'healthy';
  const logicalId = resolveLogicalId(model);
  if (logicalId) {
    const byLogical = healthMap[logicalId];
    if (byLogical) return byLogical.healthy === false ? 'unhealthy' : 'healthy';
  }
  return modelHealthKind(model);
}

function buildEdgePulseMap(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  models: LlmModel[],
  healthMap?: Record<string, LlmModelHealth | null | undefined>
): { edgePulse: Record<string, EdgePulseKind>; modelHealth: Record<string, ModelHealthKind> } {
  const modelHealth: Record<string, ModelHealthKind> = {};
  models.forEach((m) => {
    const kind = healthMap ? resolveHealthForModel(m, healthMap) : modelHealthKind(m);
    modelHealth[m.name] = kind;
    const logicalId = resolveLogicalId(m);
    if (logicalId) modelHealth[logicalId] = kind;
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edgePulse: Record<string, EdgePulseKind> = {};

  edges.forEach((edge) => {
    const targetNode = nodeById.get(edge.target);
    const parsed = targetNode ? parseEntityNodeId(targetNode.id) : null;
    let kind: EdgePulseKind = 'unknown';

    if (parsed?.kind === 'model') {
      const model = findModelByEntityId(models, parsed.entityId);
      const keys = [parsed.entityId, model ? resolveLogicalId(model) : null].filter(Boolean) as string[];
      kind =
        keys.map((k) => modelHealth[k]).find((v) => v && v !== 'unknown') ??
        modelHealth[parsed.entityId] ??
        'unknown';
      if (kind === 'healthy') kind = 'pulse';
    } else if (parsed?.kind === 'endpoint') {
      const ep = targetNode?.data.endpoint;
      const healthy = ep?.is_active !== false;
      kind = healthy ? 'pulse' : 'unhealthy';
    } else if (targetNode?.data.healthKind) {
      kind = targetNode.data.healthKind === 'healthy' ? 'pulse' : targetNode.data.healthKind;
    }

    edgePulse[edge.id] = kind;
  });

  return { edgePulse, modelHealth };
}

export function useHealthPulse(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  models: LlmModel[],
  enabled = true
): HealthPulseState {
  const [edgePulse, setEdgePulse] = useState<Record<string, EdgePulseKind>>({});
  const [modelHealth, setModelHealth] = useState<Record<string, ModelHealthKind>>({});
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const modelsRef = useRef(models);

  modelsRef.current = models;

  const applyLocal = useCallback(() => {
    const { edgePulse: ep, modelHealth: mh } = buildEdgePulseMap(nodes, edges, modelsRef.current);
    setEdgePulse(ep);
    setModelHealth(mh);
  }, [nodes, edges]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsPolling(true);
    try {
      const health = await pipelineAdminService.fetchLlmHealth();
      const healthMap = health?.models ?? {};
      const enriched = modelsRef.current.map((m) => {
        const h =
          healthMap[m.name] ??
          (resolveLogicalId(m) ? healthMap[resolveLogicalId(m)!] : undefined);
        return h ? { ...m, health: { ...m.health, ...h } } : m;
      });
      modelsRef.current = enriched;
      const { edgePulse: ep, modelHealth: mh } = buildEdgePulseMap(
        nodes,
        edges,
        enriched,
        healthMap
      );
      setEdgePulse(ep);
      setModelHealth(mh);
      setLastUpdated(Date.now());
    } catch {
      applyLocal();
    } finally {
      setIsPolling(false);
    }
  }, [enabled, nodes, edges, applyLocal]);

  useEffect(() => {
    applyLocal();
  }, [applyLocal]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  return { edgePulse, modelHealth, isPolling, lastUpdated, refresh };
}
