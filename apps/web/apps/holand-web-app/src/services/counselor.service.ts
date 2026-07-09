// ============================================
// Holand Counselor Service
// Powers the counselor dashboard: cohort stats + per-student progress list.
// ============================================

import { gatewayClient } from '@/lib/api-client';
import type { CounselorDashboardData } from '@/types/assessment.types';
import { buildMockCounselorDashboard } from './assessment-mock-data';

function isBackendUnavailable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === undefined || status === 404 || status === 501;
}

export const counselorService = {
  /**
   * Fetch cohort stats + student list for the counselor dashboard.
   *
   * @endpoint GET /counselor/dashboard
   */
  async getDashboard(): Promise<CounselorDashboardData> {
    console.info('[CounselorService] Fetching dashboard...');
    try {
      const res = await gatewayClient.get<CounselorDashboardData>('/counselor/dashboard');
      return res.data;
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      console.warn('[CounselorService] Backend unavailable — returning mock dashboard.', error);
      return buildMockCounselorDashboard();
    }
  },
};
