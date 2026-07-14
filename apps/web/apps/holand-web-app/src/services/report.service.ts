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

function isNotFound(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

function isFallbackEligible(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 403 || status === 422;
}

interface BackendRecommendationItem {
  title: string;
  title_fa: string;
  fit_score: number;
  why_fa: string;
}

export interface ReportHistoryItem {
  reportId: string;
  sessionId?: string;
  hollandCode: string;
  mbtiType: string;
  ageBand: '13-17' | '18-24' | '25-30' | '30+';
  confidenceScore: number;
  createdAt: string;
  topCareersFa: string[];
  topMajorsFa: string[];
  compareToReportId?: string;
  studentId?: string;
  studentName?: string;
}

export interface GeneratedReportResponse {
  id?: string;
  holland_code: string;
  mbti_type: string;
  age_band: '13-17' | '18-24' | '25-30' | '30+';
  summary_card: {
    holland_code: string;
    mbti_type: string;
    age_band: string;
    headline_fa: string;
    top_careers_fa: string[];
    top_majors_fa: string[];
  };
  detailed_interpretation: {
    psychometric_fa: string;
    behavioral_fit_fa: string;
    career_major_fa: string;
    skill_growth_fa: string;
  };
  action_plan: {
    short_term_3_months_fa: string[];
    mid_term_6_months_fa: string[];
    long_term_12_months_fa: string[];
  };
  risk_flags: string[];
  confidence_score: number;
  recommendations: {
    careers: BackendRecommendationItem[];
    majors: BackendRecommendationItem[];
  };
}

function asRatio(percentLike: number): number {
  if (percentLike <= 1) return Math.max(percentLike, 0);
  return Math.max(Math.min(percentLike / 100, 1), 0);
}

function toLegacyAssessmentReport(
  sessionId: string,
  payload: GeneratedReportResponse
): AssessmentReport {
  return {
    sessionId,
    testType: 'combined',
    ageBand: payload.age_band,
    completedAt: new Date().toISOString(),
    strengths: [
      payload.detailed_interpretation.psychometric_fa,
      payload.detailed_interpretation.behavioral_fit_fa,
    ].filter(Boolean),
    growthAreas: payload.risk_flags ?? [],
    careers: payload.recommendations.careers.map((item) => ({
      title: item.title_fa,
      fitScore: asRatio(item.fit_score),
      why: item.why_fa,
    })),
    majors: payload.recommendations.majors.map((item) => ({
      title: item.title_fa,
      fitScore: asRatio(item.fit_score),
      why: item.why_fa,
    })),
    actionPlan: [
      {
        horizon: '3m',
        title: '۳ ماه آینده',
        description: payload.action_plan.short_term_3_months_fa.join(' '),
      },
      {
        horizon: '6m',
        title: '۶ ماه آینده',
        description: payload.action_plan.mid_term_6_months_fa.join(' '),
      },
      {
        horizon: '12m',
        title: '۱۲ ماه آینده',
        description: payload.action_plan.long_term_12_months_fa.join(' '),
      },
    ],
    disclaimer:
      payload.risk_flags?.join(' ') ||
      'این گزارش برای راهنمایی تحصیلی/شغلی است و جایگزین مشاوره تخصصی حضوری نیست.',
  };
}

async function fetchGeneratedReportBySession(sessionId: string): Promise<GeneratedReportResponse> {
  try {
    const res = await gatewayClient.get<GeneratedReportResponse>(`/reports/by-session/${sessionId}`);
    return res.data;
  } catch (bySessionError: unknown) {
    if (!isFallbackEligible(bySessionError)) throw bySessionError;
  }
  const fallback = await gatewayClient.get<GeneratedReportResponse>(`/reports/${sessionId}`);
  return fallback.data;
}

async function fetchGeneratedReportById(reportId: string): Promise<GeneratedReportResponse> {
  const res = await gatewayClient.get<GeneratedReportResponse>(`/reports/${reportId}`);
  return res.data;
}

export const reportService = {
  /**
   * Fetch canonical generated report payload for report pages.
   */
  async getGeneratedReport(sessionId: string): Promise<GeneratedReportResponse> {
    console.info('[ReportService] Fetching generated report:', { sessionId });
    return fetchGeneratedReportBySession(sessionId);
  },

  async getGeneratedReportById(reportId: string): Promise<GeneratedReportResponse> {
    console.info('[ReportService] Fetching generated report by id:', { reportId });
    return fetchGeneratedReportById(reportId);
  },

  async listHistory(): Promise<ReportHistoryItem[]> {
    const res = await gatewayClient.get<
      Array<{
        report_id: string;
        session_id?: string;
        holland_code: string;
        mbti_type: string;
        age_band: '13-17' | '18-24' | '25-30' | '30+';
        confidence_score: number;
        created_at: string;
        top_careers_fa: string[];
        top_majors_fa: string[];
        compare_to_report_id?: string;
        student_id?: string;
        student_name?: string;
      }>
    >('/reports/history');
    return res.data.map((item) => ({
      reportId: item.report_id,
      sessionId: item.session_id,
      hollandCode: item.holland_code,
      mbtiType: item.mbti_type,
      ageBand: item.age_band,
      confidenceScore: item.confidence_score,
      createdAt: item.created_at,
      topCareersFa: item.top_careers_fa ?? [],
      topMajorsFa: item.top_majors_fa ?? [],
      compareToReportId: item.compare_to_report_id,
      studentId: item.student_id,
      studentName: item.student_name,
    }));
  },

  /**
   * Fetch the full report for a session.
   *
   * Resolves by session first, then falls back to direct report id lookup.
   *
   * @endpoint GET /reports/by-session/{sessionId}
   * @fallback GET /reports/{reportId}
   */
  async getReport(sessionId: string): Promise<AssessmentReport> {
    console.info('[ReportService] Fetching report:', { sessionId });
    try {
      const payload = await fetchGeneratedReportBySession(sessionId);
      return toLegacyAssessmentReport(sessionId, payload);
    } catch (error: unknown) {
      if (!isBackendUnavailable(error)) throw error;
      console.warn('[ReportService] Backend unavailable — returning mock report.', error);
      return buildMockReport(sessionId, 'combined', '18-24');
    }
  },

  /**
   * Request a downloadable PDF/HTML export of the report.
   *
   * @endpoint GET /reports/{sessionId}/pdf
   */
  async exportReport(reportId: string, format: 'pdf' | 'html' = 'pdf'): Promise<Blob> {
    console.info('[ReportService] Exporting report:', { reportId, format });
    const res = await gatewayClient.get(`/reports/${reportId}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return res.data;
  },
};
