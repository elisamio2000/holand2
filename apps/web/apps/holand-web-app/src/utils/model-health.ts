import type { LlmModel } from '@/types/pipeline-admin.types';

export type ModelHealthKind = 'healthy' | 'unhealthy' | 'disabled' | 'unknown';

/** Map registry + runtime health per admin-remote-nodes-api.md */
export function modelHealthKind(model: LlmModel): ModelHealthKind {
  if (!model.is_active || model.health?.enabled === false) return 'disabled';
  if (model.health?.healthy === true) return 'healthy';
  if (model.health?.healthy === false) return 'unhealthy';
  return 'unknown';
}

export function statusDotColor(kind: ModelHealthKind): 'green' | 'red' | 'gray' | 'amber' {
  switch (kind) {
    case 'healthy':
      return 'green';
    case 'unhealthy':
      return 'red';
    case 'disabled':
      return 'gray';
    default:
      return 'amber';
  }
}

export function countHealthyModels(models: LlmModel[]): number {
  return models.filter((m) => modelHealthKind(m) === 'healthy').length;
}
