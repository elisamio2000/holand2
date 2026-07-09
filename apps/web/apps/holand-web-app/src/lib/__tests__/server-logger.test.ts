import { describe, expect, it } from 'vitest';
import { isSilentMiddlewarePath } from '../edge-middleware-logger';

describe('server-logger', () => {
  it('treats session polling and static assets as silent', () => {
    expect(isSilentMiddlewarePath('/api/auth/session')).toBe(true);
    expect(isSilentMiddlewarePath('/api/auth/_log')).toBe(true);
    expect(isSilentMiddlewarePath('/_next/static/chunks/main.js')).toBe(true);
    expect(isSilentMiddlewarePath('/brand/brand-mark-4x.png')).toBe(true);
    expect(isSilentMiddlewarePath('/apple-touch-icon.png')).toBe(true);
    expect(isSilentMiddlewarePath('/icon')).toBe(true);
    expect(isSilentMiddlewarePath('/apple-icon')).toBe(true);
  });

  it('logs protected app routes', () => {
    expect(isSilentMiddlewarePath('/admin/pipeline')).toBe(false);
    expect(isSilentMiddlewarePath('/api/gateway/admin/llm/health')).toBe(false);
  });
});
