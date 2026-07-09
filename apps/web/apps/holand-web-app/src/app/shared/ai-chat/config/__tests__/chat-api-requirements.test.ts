import { describe, expect, it } from 'vitest';
import {
  CHAT_API_GROUP_ORDER,
  CHAT_API_REQUIREMENTS,
  groupChatApiRequirements,
  resolveLiveApiStatus,
} from '../chat-api-requirements';

describe('CHAT_API_REQUIREMENTS', () => {
  it('has unique ids', () => {
    const ids = CHAT_API_REQUIREMENTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least 42 entries covering all gateway domains', () => {
    expect(CHAT_API_REQUIREMENTS.length).toBeGreaterThanOrEqual(42);
    const groups = new Set(CHAT_API_REQUIREMENTS.map((r) => r.group));
    for (const g of CHAT_API_GROUP_ORDER) {
      expect(groups.has(g)).toBe(true);
    }
  });

  it('includes core live endpoints', () => {
    const liveIds = CHAT_API_REQUIREMENTS.filter((r) => r.status === 'live').map(
      (r) => r.id
    );
    expect(liveIds).toContain('stream');
    expect(liveIds).toContain('sessions-list');
    expect(liveIds).toContain('messages');
  });

  it('uses POST /upload not POST /storage/upload for simple upload', () => {
    const upload = CHAT_API_REQUIREMENTS.find((r) => r.id === 'upload-simple');
    expect(upload?.endpoint).toContain('POST /upload');
    expect(upload?.endpoint).not.toContain('/storage/upload');
  });

  it('returns live manifest status even when probe reports unavailable', () => {
    const toolsReq = CHAT_API_REQUIREMENTS.find((r) => r.id === 'tools')!;
    expect(toolsReq.status).toBe('live');
    expect(
      resolveLiveApiStatus(toolsReq, {
        memory: 'unknown',
        tools: 'unavailable',
        feedback: 'unknown',
      })
    ).toBe('live');
  });

  it('merges probe health for partial APIs with healthKey', () => {
    const memoryReq = {
      ...CHAT_API_REQUIREMENTS.find((r) => r.id === 'memory-session')!,
      status: 'partial' as const,
    };
    expect(
      resolveLiveApiStatus(memoryReq, {
        memory: 'unavailable',
        tools: 'unknown',
        feedback: 'unknown',
      })
    ).toBe('unavailable');
    expect(
      resolveLiveApiStatus(memoryReq, {
        memory: 'available',
        tools: 'unknown',
        feedback: 'unknown',
      })
    ).toBe('available');
  });

  it('includes share endpoints as live after backend extended routes', () => {
    const sharePublic = CHAT_API_REQUIREMENTS.find((r) => r.id === 'share-public');
    const shareUsers = CHAT_API_REQUIREMENTS.find((r) => r.id === 'share-users');
    expect(sharePublic?.status).toBe('live');
    expect(shareUsers?.status).toBe('live');
  });

  it('includes surface dock endpoints', () => {
    const ids = CHAT_API_REQUIREMENTS.map((r) => r.id);
    expect(ids).toContain('folders-bootstrap');
    expect(ids).toContain('sessions-dock-create');
    expect(ids).toContain('sessions-dock-get');
    expect(ids).toContain('sessions-branches');
    expect(CHAT_API_GROUP_ORDER).toContain('surface');
  });

  it('groups requirements by domain', () => {
    const grouped = groupChatApiRequirements();
    expect(grouped.get('storage')?.length).toBeGreaterThanOrEqual(5);
    expect(grouped.get('memory')?.length).toBe(5);
  });
});
