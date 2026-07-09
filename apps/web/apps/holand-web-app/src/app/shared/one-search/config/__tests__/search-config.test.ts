import { describe, expect, it, vi, afterEach } from 'vitest';
import { isOneSearchDevPanelEnabled } from '../search-config';

describe('isOneSearchDevPanelEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is enabled in non-production by default', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isOneSearchDevPanelEnabled()).toBe(true);
  });

  it('can be forced on in production via env flag', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ONE_SEARCH_DEV_PANELS', 'true');
    expect(isOneSearchDevPanelEnabled()).toBe(true);
  });

  it('is off in production without override', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ONE_SEARCH_DEV_PANELS', 'false');
    expect(isOneSearchDevPanelEnabled()).toBe(false);
  });
});
