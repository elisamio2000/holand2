/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  gatewayClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

import { counselorService } from './counselor.service';

describe('counselorService', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('maps counselor dashboard payload to frontend shape', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        stats: {
          total_students: 2,
          completed_assessments: 1,
          in_progress_assessments: 1,
          average_completion_percent: 70,
          dimension_averages: [
            { dimension: 'R', label: 'R', raw_score: 2, normalized_score: 33.3 },
          ],
        },
        students: [
          {
            session_id: 's-1',
            student_id: 'u-1',
            student_name: 'Sara',
            age_band: '18-24',
            test_type: 'combined',
            status: 'completed',
            progress_percent: 100,
            top_code: 'IRC',
            updated_at: '2026-01-01T00:00:00.000Z',
            latest_report_id: 'r-1',
            latest_confidence_score: 77.2,
            confidence_delta: 2.1,
            compare_report_id: 'r-0',
          },
        ],
      },
    });

    const result = await counselorService.getDashboard();
    expect(getMock).toHaveBeenCalledWith('/counselor/dashboard');
    expect(result.stats.totalStudents).toBe(2);
    expect(result.students[0]).toMatchObject({
      sessionId: 's-1',
      studentId: 'u-1',
      latestReportId: 'r-1',
      confidenceDelta: 2.1,
    });
  });
});

