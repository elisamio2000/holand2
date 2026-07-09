// ============================================
// Holand Report Service
// Fetches the full explainable report (dimensions, careers/majors,
// action plan) for a completed assessment session.
// ============================================

import { gatewayClient } from '@/lib/api-client';
import type { AssessmentReport } from '@/types/assessment.types';
import { buildMockReport } from './assessment-mock-data';

function isBackendUnavailable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === undefined || status === 404 || status === 501;
}

export const reportService = {
  /**
   * Fetch the full report for a session.
   *
   * @endpoint GET /reports/{sessionId}
   */
  async getReport(sessionId: string): Promise<AssessmentReport> {
    console.info('[ReportService] Fetching report:', { sessionId });
    try {
      const res = await gatewayClient.get<AssessmentReport>(`/reports/${sessionId}`);
      return res.data;
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      console.warn('[ReportService] Backend unavailable — returning mock report.', error);
      return buildMockReport(sessionId, 'combined', '18-24');
    }
  },

  /**
   * Request a downloadable PDF/HTML export of the report.
   *
   * @endpoint GET /reports/{sessionId}/export
   */
  async exportReport(sessionId: string, format: 'pdf' | 'html' = 'pdf'): Promise<Blob> {
    console.info('[ReportService] Exporting report:', { sessionId, format });
    const res = await gatewayClient.get(`/reports/${sessionId}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return res.data;
  },
};
