import { describe, expect, it } from 'vitest';
import { countHealthyModels, modelHealthKind } from '@/utils/model-health';
import type { LlmModel } from '@/types/pipeline-admin.types';

describe('model-health', () => {
  it('treats health.healthy separately from is_active', () => {
    const models: LlmModel[] = [
      { id: '1', name: 'a', task: 'chat', backend_kind: 'external', is_active: true, health: { healthy: true } },
      { id: '2', name: 'b', task: 'chat', backend_kind: 'external', is_active: true, health: { healthy: false } },
      { id: '3', name: 'c', task: 'chat', backend_kind: 'external', is_active: false, health: { healthy: false, source: 'registry' } },
    ];
    expect(countHealthyModels(models)).toBe(1);
    expect(modelHealthKind(models[0])).toBe('healthy');
    expect(modelHealthKind(models[1])).toBe('unhealthy');
    expect(modelHealthKind(models[2])).toBe('disabled');
  });
});
