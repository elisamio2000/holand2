import type { LlmModel, LlmPool } from '@/types/pipeline-admin.types';
import { resolveLogicalId } from './logical-model-options';

export type ModelLifecycle = 'registered' | 'active' | 'deployed';

function poolKeys(pool: LlmPool): string[] {
  const keys = new Set<string>();
  if (pool.logical_id) keys.add(pool.logical_id);
  const suffix = pool.logical_id?.split(':').pop();
  if (suffix) keys.add(suffix);
  if (pool.model_name) keys.add(pool.model_name);
  for (const rep of pool.replicas ?? []) {
    if (rep.name) keys.add(rep.name);
    if (rep.node_id && pool.logical_id) keys.add(`${pool.logical_id}@${rep.node_id}`);
  }
  return [...keys];
}

/** Map model name / logical_id → node ids from pool replicas. */
export function buildModelRunsOnMap(pools: LlmPool[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();

  for (const pool of pools) {
    const nodeIds = new Set<string>();
    for (const rep of pool.replicas ?? []) {
      if (rep.node_id) nodeIds.add(rep.node_id);
    }
    if (nodeIds.size === 0) continue;

    for (const key of poolKeys(pool)) {
      const nodes = map.get(key) ?? new Set<string>();
      nodeIds.forEach((n) => nodes.add(n));
      map.set(key, nodes);
    }
  }

  const out = new Map<string, string[]>();
  map.forEach((nodes, name) => out.set(name, [...nodes]));
  return out;
}

export function computeModelLifecycle(
  model: LlmModel,
  pools: LlmPool[],
  runsOn: Map<string, string[]>
): ModelLifecycle {
  const logical = resolveLogicalId(model);
  const nodes = runsOn.get(model.name) ?? runsOn.get(logical) ?? [];
  const hasDeployedReplica = pools.some((pool) => {
    const keys = poolKeys(pool);
    if (!keys.includes(model.name) && !keys.includes(logical)) return false;
    return (pool.replicas ?? []).some(
      (r) => r.is_active !== false && !!r.inference_url
    );
  });

  if (hasDeployedReplica || nodes.length > 0) return 'deployed';
  if (model.is_active) return 'active';
  return 'registered';
}
