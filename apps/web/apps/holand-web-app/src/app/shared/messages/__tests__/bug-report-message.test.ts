import { describe, expect, it } from 'vitest';
import { BUG_REPORT_KIND } from '@/app/shared/bug-reporter/types';
import type { MessageItem } from '@/types/messages.types';
import {
  embedBugReportPayload,
  isBugReportMessage,
  parseBugReportPayloadFromBody,
  parseSeverityFromSubject,
} from '../utils/bug-report-message';

const baseMessage: MessageItem = {
  id: 'msg-1',
  from: { id: 'user-a', name: 'Reporter' },
  to: { id: 'user-b', name: 'Support' },
  subject: 'Hello',
  preview: 'Hi',
  read: true,
  priority: 'normal',
  folder: 'inbox',
  created_at: new Date().toISOString(),
};

describe('bug-report-message utils', () => {
  it('detects bug report by content_type', () => {
    expect(isBugReportMessage({ ...baseMessage, content_type: 'bug_report' })).toBe(true);
  });

  it('detects bug report by subject prefix', () => {
    expect(
      isBugReportMessage({ ...baseMessage, subject: '[BUG MEDIUM] /one-search — today' })
    ).toBe(true);
  });

  it('detects bug report by embedded payload', () => {
    const body = embedBugReportPayload('<p>report</p>', {
      kind: BUG_REPORT_KIND,
      schemaVersion: 2,
      session: {
        id: 'bug-1',
        startTime: 1,
        actions: [],
        rrwebEvents: [],
        screenshots: [],
        consoleLog: [],
        networkLog: [],
        errorLog: [],
        clickLog: [],
        navigationLog: [],
        captureMode: 'manual',
        bufferDuration: 30,
        metadata: {
          userAgent: 'x',
          viewport: { width: 1, height: 1 },
          url: 'http://localhost',
          pathname: '/',
        },
      },
      description: 'broken',
      severity: 'high',
      delivery: { channel: 'email', recipientId: 'r1', sentAt: 1 },
    });
    expect(isBugReportMessage({ ...baseMessage, body })).toBe(true);
    expect(parseBugReportPayloadFromBody(body)?.description).toBe('broken');
  });

  it('parses severity from subject', () => {
    expect(parseSeverityFromSubject('[BUG CRITICAL] /x')).toBe('critical');
    expect(parseSeverityFromSubject('normal subject')).toBeNull();
  });

  it('embeds payload safely in HTML body', () => {
    const out = embedBugReportPayload('<div>card</div>', {
      kind: BUG_REPORT_KIND,
      schemaVersion: 2,
      session: {
        id: 'bug-2',
        startTime: 1,
        actions: [],
        rrwebEvents: [],
        screenshots: [],
        consoleLog: [],
        networkLog: [],
        errorLog: [],
        clickLog: [],
        navigationLog: [],
        captureMode: 'manual',
        bufferDuration: 30,
        metadata: {
          userAgent: 'x',
          viewport: { width: 1, height: 1 },
          url: 'http://localhost',
          pathname: '/',
        },
      },
      description: 'x',
      severity: 'low',
      delivery: { channel: 'chat', recipientId: 'r1', sentAt: 1 },
    });
    expect(out).toContain('data-bug-report');
    expect(out).toContain('card');
  });
});
