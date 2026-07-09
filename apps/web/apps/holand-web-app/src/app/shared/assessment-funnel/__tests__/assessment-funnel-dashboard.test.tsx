// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
}));

vi.mock('../use-funnel-summary', () => ({
  useFunnelSummary: () => ({
    isLoading: false,
    error: null,
    summary: {
      total_sessions: 3,
      steps: [
        { step: 'start', event_count: 3, unique_sessions: 3, avg_duration_ms: 10 },
        { step: 'complete', event_count: 2, unique_sessions: 2, avg_duration_ms: 20 },
      ],
      drop_off_rate: { 'start->in_progress': 50 },
    },
  }),
}));

import { AssessmentFunnelDashboard } from '../index';

describe('AssessmentFunnelDashboard', () => {
  it('renders rows and drop-off cards', () => {
    render(<AssessmentFunnelDashboard />);
    expect(screen.getByText('analyticsDashboard.title')).toBeTruthy();
    expect(screen.getAllByTestId('funnel-step-row')).toHaveLength(2);
    expect(screen.getByText('50%')).toBeTruthy();
  });
});
