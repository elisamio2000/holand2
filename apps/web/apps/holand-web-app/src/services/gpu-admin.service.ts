// ============================================
// GPU Admin Service — Tool-runner VRAM (/gpu/*)
// ============================================

import { gatewayClient } from '@/lib/api-client';

const LOG_TAG = '[GpuAdminService]';

export interface GpuLoadedModel {
  tool_id?: string;
  model_name?: string;
  name?: string;
  vram_usage?: number;
  vram_mb?: number;
  last_used?: string;
  loaded_at?: string;
  [key: string]: unknown;
}

export interface GpuStatus {
  vram_total?: number;
  vram_budget?: number;
  vram_allocated?: number;
  vram_free?: number;
  loaded_models?: GpuLoadedModel[];
  queue?: Record<string, unknown>;
  performance?: Record<string, unknown>;
  [key: string]: unknown;
}

export const gpuAdminService = {
  async fetchStatus(): Promise<GpuStatus | null> {
    try {
      const res = await gatewayClient.get<GpuStatus>('/gpu/status');
      return res.data ?? null;
    } catch (e) {
      console.error(LOG_TAG, 'fetchStatus failed', e);
      return null;
    }
  },

  async fetchModels(): Promise<GpuLoadedModel[]> {
    try {
      const res = await gatewayClient.get<unknown>('/gpu/models');
      const data = res.data;
      if (Array.isArray(data)) return data as GpuLoadedModel[];
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.models)) return obj.models as GpuLoadedModel[];
        if (Array.isArray(obj.loaded_models)) return obj.loaded_models as GpuLoadedModel[];
      }
      return [];
    } catch (e) {
      console.warn(LOG_TAG, 'fetchModels failed', e);
      return [];
    }
  },

  async evictModel(toolId: string): Promise<void> {
    await gatewayClient.post(`/gpu/evict/${encodeURIComponent(toolId)}`);
  },

  async evictAll(): Promise<void> {
    await gatewayClient.post('/gpu/evict-all');
  },

  async evictIdle(): Promise<void> {
    await gatewayClient.post('/gpu/evict-idle');
  },
};
