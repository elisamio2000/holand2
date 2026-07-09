// ============================================
// Analytics service — funnel event tracking client
// ============================================

import { holandApiClient } from './holand-api-client';
import type {
  FunnelEvent,
  FunnelEventCreateInput,
  FunnelSummaryResponse,
  ReportQualitySummaryResponse,
} from '@/types/analytics.types';

export const analyticsService = {
  async trackEvent(payload: FunnelEventCreateInput): Promise<FunnelEvent> {
    const { data } = await holandApiClient.post<FunnelEvent>('/analytics/events', payload);
    return data;
  },

  async getFunnelSummary(): Promise<FunnelSummaryResponse> {
    const { data } = await holandApiClient.get<FunnelSummaryResponse>('/analytics/funnel');
    return data;
  },

  async getReportQualitySummary(): Promise<ReportQualitySummaryResponse> {
    const { data } = await holandApiClient.get<ReportQualitySummaryResponse>(
      '/analytics/report-quality'
    );
    return data;
  },
};
