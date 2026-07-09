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
      const res = await gatewayClient.get<{
        stats: {
          total_students: number;
          completed_assessments: number;
          in_progress_assessments: number;
          average_completion_percent: number;
          dimension_averages: Array<{
            dimension: string;
            label: string;
            raw_score: number;
            normalized_score: number;
          }>;
        };
        students: Array<{
          session_id: string;
          student_id: string;
          student_name: string;
          age_band: string;
          test_type: 'holland' | 'mbti' | 'combined';
          status: 'in_progress' | 'completed' | 'abandoned';
          progress_percent: number;
          top_code?: string;
          updated_at: string;
          latest_report_id?: string;
          latest_confidence_score?: number;
          confidence_delta?: number;
          compare_report_id?: string;
        }>;
      }>('/counselor/dashboard');
      return {
        stats: {
          totalStudents: res.data.stats.total_students,
          completedAssessments: res.data.stats.completed_assessments,
          inProgressAssessments: res.data.stats.in_progress_assessments,
          averageCompletionPercent: res.data.stats.average_completion_percent,
          dimensionAverages: res.data.stats.dimension_averages.map((dim) => ({
            dimension: dim.dimension,
            label: dim.label,
            rawScore: dim.raw_score,
            normalizedScore: dim.normalized_score,
          })),
        },
        students: res.data.students.map((student) => ({
          sessionId: student.session_id,
          studentId: student.student_id,
          studentName: student.student_name,
          ageBand: student.age_band as CounselorDashboardData['students'][number]['ageBand'],
          testType: student.test_type,
          status: student.status,
          progressPercent: student.progress_percent,
          topCode: student.top_code,
          updatedAt: student.updated_at,
          latestReportId: student.latest_report_id,
          latestConfidenceScore: student.latest_confidence_score,
          confidenceDelta: student.confidence_delta,
          compareReportId: student.compare_report_id,
        })),
      };
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      console.warn('[CounselorService] Backend unavailable — returning mock dashboard.', error);
      return buildMockCounselorDashboard();
    }
  },
};
