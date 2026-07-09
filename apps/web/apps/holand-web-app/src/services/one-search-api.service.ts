// ============================================
// One Search — STT + metrics API helpers
// ============================================

import { gatewayClient } from '@/lib/api-client';

export interface SearchSttResponse {
  transcript: string;
  confidence?: number;
  language?: string;
}

export interface SearchMetricsResponse {
  window: string;
  query_count: number;
  latency_ms: { p50: number; p95: number; p99?: number };
  by_mode: Record<string, number>;
  error_rate?: number;
  rate_limit_count?: number;
}

export const oneSearchApi = {
  /** Voice query transcription — POST /search/stt (P2). */
  async transcribeAudio(blob: Blob, language = 'auto'): Promise<SearchSttResponse> {
    const form = new FormData();
    form.append('audio', blob, 'voice.webm');
    form.append('language', language);
    form.append('max_duration_sec', '30');
    const res = await gatewayClient.post<SearchSttResponse>('/search/stt', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** Admin search metrics — GET /search/metrics (P2). */
  async getMetrics(window = '24h'): Promise<SearchMetricsResponse> {
    const res = await gatewayClient.get<SearchMetricsResponse>('/search/metrics', {
      params: { window },
    });
    return res.data;
  },
};
