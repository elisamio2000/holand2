import { describe, expect, it } from 'vitest';
import {
  getEnvConfig,
  mergeConfig,
  parseAdminBugReportSettings,
  isBugReportActive,
  buildRecipientIdPool,
} from '../config/bug-report-config';

describe('bug-report-config', () => {
  it('parses env defaults', () => {
    const config = getEnvConfig();
    expect(config.recipientId).toBeTruthy();
    expect(config.recipientIds).toEqual([config.recipientId]);
    expect(['email', 'chat']).toContain(config.defaultChannel);
  });

  it('merges admin overrides over env', () => {
    const env = getEnvConfig();
    const merged = mergeConfig(env, {
      enabled: false,
      recipientId: 'user-support',
      defaultChannel: 'chat',
    });
    expect(merged.enabled).toBe(false);
    expect(merged.recipientId).toBe('user-support');
    expect(merged.recipientIds).toEqual(['user-support']);
    expect(merged.defaultChannel).toBe('chat');
  });

  it('parses admin settings object', () => {
    const admin = parseAdminBugReportSettings({
      bug_report_enabled: true,
      bug_report_recipient: 'user-admin',
      bug_report_default_channel: 'email',
      unrelated: 'value',
    });
    expect(admin.enabled).toBe(true);
    expect(admin.recipientId).toBe('user-admin');
    expect(admin.defaultChannel).toBe('email');
  });

  it('isBugReportActive requires enabled flag', () => {
    expect(
      isBugReportActive({
        enabled: true,
        recipientId: 'x',
        recipientIds: ['x'],
        defaultChannel: 'email',
        rollingBufferEnabled: true,
        bufferSeconds: 30,
        maskPii: true,
      })
    ).toBe(true);
    expect(
      isBugReportActive({
        enabled: false,
        recipientId: 'x',
        recipientIds: ['x'],
        defaultChannel: 'email',
        rollingBufferEnabled: true,
        bufferSeconds: 30,
        maskPii: true,
      })
    ).toBe(false);
  });

  it('buildRecipientIdPool returns single configured id only', () => {
    const pool = buildRecipientIdPool('user-admin', ['user-custom', 'user-support']);
    expect(pool).toEqual(['user-admin']);
  });

  it('buildRecipientIdPool returns empty when id missing', () => {
    expect(buildRecipientIdPool('', ['user-custom'])).toEqual([]);
  });

  it('ignores deprecated bug_report_recipients list', () => {
    const admin = parseAdminBugReportSettings({
      bug_report_recipients: ['user-admin', 'user-support'],
    });
    expect(admin.recipientId).toBeUndefined();
    expect(admin.recipientIds).toBeUndefined();
  });
});
