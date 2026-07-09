import { describe, expect, it } from 'vitest';
import {
  MESSAGES_BACKEND_CAPABILITY_GAPS,
  messagesGapsByLane,
  messagesGapsByPriority,
  messagesGapsBySurface,
} from '../backend-capability-gaps';

describe('MESSAGES_BACKEND_CAPABILITY_GAPS', () => {
  it('has unique ids', () => {
    const ids = MESSAGES_BACKEND_CAPABILITY_GAPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each gap has request and response samples', () => {
    for (const gap of MESSAGES_BACKEND_CAPABILITY_GAPS) {
      expect(gap.feRequest.trim().length).toBeGreaterThan(0);
      expect(gap.expectedResponse.trim().length).toBeGreaterThan(0);
      expect(gap.requiredApi.trim().length).toBeGreaterThan(0);
      expect(gap.acceptance.trim().length).toBeGreaterThan(0);
    }
  });

  it('priorities are P0, P1, or P2', () => {
    for (const gap of MESSAGES_BACKEND_CAPABILITY_GAPS) {
      expect(['P0', 'P1', 'P2']).toContain(gap.priority);
    }
  });

  it('filters by lane, surface, and priority', () => {
    expect(messagesGapsByLane('mailbox').every((g) => g.lane === 'mailbox')).toBe(true);
    expect(messagesGapsByLane('people').every((g) => g.lane === 'people')).toBe(true);
    expect(messagesGapsBySurface('timeline').every((g) => g.uiSurface === 'timeline')).toBe(
      true
    );
    expect(messagesGapsByPriority('P0').every((g) => g.priority === 'P0')).toBe(true);
  });

  it('includes benchmarkRef on shipped gaps', () => {
    const forward = MESSAGES_BACKEND_CAPABILITY_GAPS.find((g) => g.id === 'forward-tool');
    expect(forward?.benchmarkRef).toBe('gmail');
    expect(forward?.resolved).toBe(true);
    const conversations = MESSAGES_BACKEND_CAPABILITY_GAPS.find((g) => g.id === 'conversations-grouped');
    expect(conversations?.resolved).toBe(true);
  });

  it('marks resolved infra blockers', () => {
    const resolvedIds = MESSAGES_BACKEND_CAPABILITY_GAPS.filter((g) => g.resolved).map(
      (g) => g.id
    );
    expect(resolvedIds).toContain('storage-500');
    expect(resolvedIds).toContain('replies-404');
    expect(resolvedIds).toContain('send-cc-bcc');
  });

  it('includes future mail and chat gaps', () => {
    const ids = MESSAGES_BACKEND_CAPABILITY_GAPS.map((g) => g.id);
    expect(ids).toContain('plugin-split-mail-chat');
    expect(ids).toContain('conversations-grouped');
    expect(ids).toContain('forward-tool');
    expect(ids).toContain('list-since');
  });

  it('has at least 20 capability gaps', () => {
    expect(MESSAGES_BACKEND_CAPABILITY_GAPS.length).toBeGreaterThanOrEqual(20);
  });
});
