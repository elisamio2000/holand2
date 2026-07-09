import { describe, expect, it } from 'vitest';
import { buildBugReportChatBody, buildBugReportHtml } from '../services/bug-report-upload.service';
import type { BugReportSession } from '../types';

const mockSession: BugReportSession = {
  id: 'bug-test-1',
  startTime: Date.now() - 5000,
  endTime: Date.now(),
  actions: [],
  rrwebEvents: [],
  screenshots: [],
  consoleLog: [],
  networkLog: [],
  errorLog: [],
  clickLog: [],
  navigationLog: [{ timestamp: Date.now(), from: '/a', to: '/b', type: 'push' }],
  captureMode: 'rolling_buffer',
  bufferDuration: 30,
  metadata: {
    userAgent: 'test',
    viewport: { width: 1920, height: 1080 },
    url: 'http://localhost/messages',
    pathname: '/messages',
  },
};

describe('bug-report delivery formatting', () => {
  it('builds HTML email-style body', () => {
    const html = buildBugReportHtml(
      mockSession,
      'Something broke',
      'high',
      { screenshotIds: ['s1'], sessionJsonId: 'j1' },
      (_k, d) => d ?? ''
    );
    expect(html).toContain('Bug Report');
    expect(html).toContain('Something broke');
    expect(html).toContain('/messages');
  });

  it('builds chat-style plain body', () => {
    const body = buildBugReportChatBody(
      mockSession,
      'Quick issue',
      'medium',
      { screenshotIds: ['s1'] }
    );
    expect(body).toContain('[BUG MEDIUM]');
    expect(body).toContain('Quick issue');
    expect(body).toContain('Navigations: 1');
  });
});
