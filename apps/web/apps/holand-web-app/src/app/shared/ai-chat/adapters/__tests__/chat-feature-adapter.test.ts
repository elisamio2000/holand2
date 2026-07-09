import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  canUseDevFallback,
  isChatDevFallbackEnabled,
} from '@/app/shared/ai-chat/adapters/chat-feature-adapter';

describe('chat-feature-adapter', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.stubEnv('NODE_ENV', originalEnv);
  });

  it('canUseDevFallback only in development when unavailable', () => {
    const health = {
      folders: 'unavailable',
      projects: 'unavailable',
      search: 'unavailable',
      import: 'unavailable',
      exportAll: 'unavailable',
    } as const;
    expect(isChatDevFallbackEnabled()).toBe(true);
    expect(canUseDevFallback('folders', health)).toBe(true);
  });

  it('does not use dev fallback when feature is available', () => {
    const health = {
      folders: 'available',
      projects: 'available',
      search: 'available',
      import: 'available',
      exportAll: 'available',
    } as const;
    expect(canUseDevFallback('search', health)).toBe(false);
  });
});
