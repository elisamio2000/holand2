/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const postMock = vi.fn();
const getMock = vi.fn();

vi.mock('./holand-api-client', () => ({
  holandApiClient: {
    post: (...args: unknown[]) => postMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
}));

import { analyticsService } from './analytics.service';

describe('analyticsService', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
  });

  it('trackEvent posts to /analytics/events', async () => {
    postMock.mockResolvedValue({ data: { id: '1', session_id: 's1', event_name: 'e', step: 'start', duration_ms: null, created_at: '2024-01-01' } });

    const result = await analyticsService.trackEvent({ session_id: 's1', event_name: 'e', step: 'start' });

    expect(postMock).toHaveBeenCalledWith('/analytics/events', { session_id: 's1', event_name: 'e', step: 'start' });
    expect(result.id).toBe('1');
  });

  it('getFunnelSummary fetches /analytics/funnel', async () => {
    getMock.mockResolvedValue({ data: { total_sessions: 0, steps: [], drop_off_rate: {} } });

    const result = await analyticsService.getFunnelSummary();

    expect(getMock).toHaveBeenCalledWith('/analytics/funnel');
    expect(result.total_sessions).toBe(0);
  });

  it('getReportQualitySummary fetches /analytics/report-quality', async () => {
    getMock.mockResolvedValue({ data: { total_sessions: 2, steps: [] } });

    const result = await analyticsService.getReportQualitySummary();

    expect(getMock).toHaveBeenCalledWith('/analytics/report-quality');
    expect(result.total_sessions).toBe(2);
  });
});
