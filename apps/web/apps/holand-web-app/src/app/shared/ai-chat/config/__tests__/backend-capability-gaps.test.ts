import { describe, expect, it } from 'vitest';
import {
  CHAT_BACKEND_CAPABILITY_GAPS,
  chatGapsByPriority,
  chatGapsBySurface,
} from '../backend-capability-gaps';

describe('CHAT_BACKEND_CAPABILITY_GAPS', () => {
  it('has unique ids', () => {
    const ids = CHAT_BACKEND_CAPABILITY_GAPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each gap has request and response samples', () => {
    for (const gap of CHAT_BACKEND_CAPABILITY_GAPS) {
      expect(gap.feRequest.trim().length).toBeGreaterThan(0);
      expect(gap.expectedResponse.trim().length).toBeGreaterThan(0);
      expect(gap.requiredApi.trim().length).toBeGreaterThan(0);
      expect(gap.acceptance.trim().length).toBeGreaterThan(0);
    }
  });

  it('priorities are P0, P1, or P2', () => {
    for (const gap of CHAT_BACKEND_CAPABILITY_GAPS) {
      expect(['P0', 'P1', 'P2']).toContain(gap.priority);
    }
  });

  it('filters by surface and priority', () => {
    expect(chatGapsBySurface('memory').every((g) => g.uiSurface === 'memory')).toBe(true);
    expect(chatGapsBySurface('share').every((g) => g.uiSurface === 'share')).toBe(true);
    expect(chatGapsByPriority('P0').every((g) => g.priority === 'P0')).toBe(true);
  });

  it('includes six share capability gaps', () => {
    const shareGaps = chatGapsBySurface('share');
    expect(shareGaps).toHaveLength(6);
    expect(shareGaps.map((g) => g.id)).toEqual([
      'share-public-no-expiry',
      'share-with-users',
      'share-list-recipients',
      'share-revoke-user',
      'share-shared-with-me',
      'share-public-viewer',
    ]);
  });

  it('has 30 total gaps', () => {
    expect(CHAT_BACKEND_CAPABILITY_GAPS).toHaveLength(30);
  });

  it('includes new roadmap gaps', () => {
    const ids = CHAT_BACKEND_CAPABILITY_GAPS.map((g) => g.id);
    expect(ids).toContain('chat-enabled-models');
    expect(ids).toContain('chat-search-cross-session');
    expect(ids).toContain('session-fork');
    expect(ids).toContain('chat-projects');
    expect(ids).toContain('chat-import-restore');
    expect(ids).toContain('sessions-export-all');
  });
});
