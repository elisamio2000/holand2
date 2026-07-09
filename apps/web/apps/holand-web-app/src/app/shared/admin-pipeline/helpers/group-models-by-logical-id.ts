import type { LlmModel, LlmPool } from '@/types/pipeline-admin.types';
import { resolveLogicalId } from './logical-model-options';
import { modelHealthKind } from '@/utils/model-health';

export interface LogicalModelGroup {
  logicalId: string;
  replicas: LlmModel[];
  replicaCount: number;
  poolReplicaCount: number;
  anyActive: boolean;
  allActive: boolean;
  healthSummary: 'healthy' | 'unhealthy' | 'mixed' | 'unknown' | 'disabled';
  origins: string[];
}

export function groupModelsByLogicalId(
  models: LlmModel[],
  pools: LlmPool[] = []
): LogicalModelGroup[] {
  const poolMap = new Map<string, number>();
  for (const p of pools) {
    if (!p.logical_id) continue;
    const count = p.replicas?.length ?? 0;
    poolMap.set(p.logical_id, count);
  }

  const map = new Map<string, LlmModel[]>();
  for (const m of models) {
    const lid = resolveLogicalId(m);
    const list = map.get(lid) ?? [];
    list.push(m);
    map.set(lid, list);
  }

  return Array.from(map.entries())
    .map(([logicalId, replicas]) => {
      const kinds = replicas.map((m) => modelHealthKind(m));
      const healthyCount = kinds.filter((k) => k === 'healthy').length;
      const unhealthyCount = kinds.filter((k) => k === 'unhealthy').length;
      const disabledCount = kinds.filter((k) => k === 'disabled').length;

      let healthSummary: LogicalModelGroup['healthSummary'] = 'unknown';
      if (disabledCount === replicas.length) healthSummary = 'disabled';
      else if (healthyCount === replicas.length) healthSummary = 'healthy';
      else if (unhealthyCount === replicas.length) healthSummary = 'unhealthy';
      else if (healthyCount > 0 || unhealthyCount > 0) healthSummary = 'mixed';

      const origins = [...new Set(replicas.map((m) => m.origin).filter(Boolean) as string[])];

      return {
        logicalId,
        replicas,
        replicaCount: replicas.length,
        poolReplicaCount: poolMap.get(logicalId) ?? replicas.length,
        anyActive: replicas.some((m) => m.is_active),
        allActive: replicas.every((m) => m.is_active),
        healthSummary,
        origins,
      };
    })
    .sort((a, b) => a.logicalId.localeCompare(b.logicalId));
}
