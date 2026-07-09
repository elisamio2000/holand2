/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const buildMockReportMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  gatewayClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

vi.mock('./assessment-mock-data', () => ({
  buildMockReport: (...args: unknown[]) => buildMockReportMock(...args),
}));

import { reportService } from './report.service';

const canonicalReport = {
  id: 'report-1',
  holland_code: 'IRC',
  mbti_type: 'INTJ',
  age_band: '18-24' as const,
  summary_card: {
    holland_code: 'IRC',
    mbti_type: 'INTJ',
    age_band: '18-24',
    headline_fa: 'headline',
    top_careers_fa: ['A'],
    top_majors_fa: ['B'],
  },
  detailed_interpretation: {
    psychometric_fa: 'psy',
    behavioral_fit_fa: 'behavior',
    career_major_fa: 'career-major',
    skill_growth_fa: 'skill',
  },
  action_plan: {
    short_term_3_months_fa: ['s1'],
    mid_term_6_months_fa: ['m1'],
    long_term_12_months_fa: ['l1'],
  },
  risk_flags: ['risk1'],
  confidence_score: 72.3,
  recommendations: {
    careers: [{ title: 'x', title_fa: 'کار A', fit_score: 87, why_fa: 'why-a' }],
    majors: [{ title: 'y', title_fa: 'رشته B', fit_score: 79, why_fa: 'why-b' }],
  },
};

describe('reportService', () => {
  beforeEach(() => {
    getMock.mockReset();
    buildMockReportMock.mockReset();
  });

  it('getGeneratedReport fetches by-session endpoint', async () => {
    getMock.mockResolvedValueOnce({ data: canonicalReport });
    const result = await reportService.getGeneratedReport('session-1');
    expect(getMock).toHaveBeenCalledWith('/reports/by-session/session-1');
    expect(result.id).toBe('report-1');
  });

  it('getGeneratedReport falls back to report id on by-session 404', async () => {
    getMock
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ data: canonicalReport });
    const result = await reportService.getGeneratedReport('session-2');
    expect(getMock).toHaveBeenNthCalledWith(1, '/reports/by-session/session-2');
    expect(getMock).toHaveBeenNthCalledWith(2, '/reports/session-2');
    expect(result.holland_code).toBe('IRC');
  });

  it('getReport maps canonical payload to legacy view model', async () => {
    getMock.mockResolvedValueOnce({ data: canonicalReport });
    const result = await reportService.getReport('session-3');
    expect(result.sessionId).toBe('session-3');
    expect(result.ageBand).toBe('18-24');
    expect(result.strengths).toContain('psy');
    expect(result.careers[0].fitScore).toBe(0.87);
    expect(result.disclaimer).toContain('risk1');
  });

  it('getReport returns mock when backend unavailable', async () => {
    buildMockReportMock.mockReturnValue({
      sessionId: 'session-4',
      testType: 'combined',
      ageBand: '18-24',
      completedAt: '2024-01-01',
      strengths: [],
      growthAreas: [],
      careers: [],
      majors: [],
      actionPlan: [],
      disclaimer: 'mock',
    });
    getMock.mockRejectedValueOnce({ response: { status: 501 } });

    const result = await reportService.getReport('session-4');
    expect(buildMockReportMock).toHaveBeenCalled();
    expect(result.disclaimer).toBe('mock');
  });

  it('listHistory maps backend history payload', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        {
          report_id: 'r-1',
          session_id: 's-1',
          holland_code: 'IRC',
          mbti_type: 'INTJ',
          age_band: '18-24',
          confidence_score: 74.2,
          created_at: '2026-01-01T00:00:00.000Z',
          top_careers_fa: ['a'],
          top_majors_fa: ['b'],
          compare_to_report_id: 'r-0',
          student_id: 'u-1',
          student_name: 'Ali',
        },
      ],
    });
    const result = await reportService.listHistory();
    expect(getMock).toHaveBeenCalledWith('/reports/history');
    expect(result[0]).toMatchObject({
      reportId: 'r-1',
      sessionId: 's-1',
      compareToReportId: 'r-0',
      studentName: 'Ali',
    });
  });

  it('exportReport uses unified export endpoint and format param', async () => {
    const blob = new Blob(['x'], { type: 'application/pdf' });
    getMock.mockResolvedValueOnce({ data: blob });
    const result = await reportService.exportReport('report-9', 'pdf');
    expect(getMock).toHaveBeenCalledWith('/reports/report-9/export', {
      params: { format: 'pdf' },
      responseType: 'blob',
    });
    expect(result).toBe(blob);
  });
});
