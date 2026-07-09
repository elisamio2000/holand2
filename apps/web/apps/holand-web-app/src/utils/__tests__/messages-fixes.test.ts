import { describe, expect, it } from 'vitest';
import { cachedAsync, dedupeAsync } from '@/utils/async-dedup';
import {
  buildUrlSyncKey,
  isViewModeUrlSettled,
  shouldSyncViewFromUrl,
} from '@/utils/messages-url-sync';

describe('async-dedup', () => {
  it('coalesces concurrent calls with the same key', async () => {
    let calls = 0;
    const fn = () =>
      dedupeAsync('test-key', async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return calls;
      });

    const [a, b] = await Promise.all([fn(), fn()]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(calls).toBe(1);
  });

  it('cachedAsync returns fresh value within TTL', async () => {
    let calls = 0;
    const load = () =>
      cachedAsync('cache-key', async () => {
        calls += 1;
        return calls;
      }, 500);
    const a = await load();
    const b = await load();
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(calls).toBe(1);
  });
});

describe('messages-url-sync', () => {
  it('builds stable url sync keys', () => {
    expect(buildUrlSyncKey('people', 'abc')).toBe('people|abc');
    expect(buildUrlSyncKey(null, null)).toBe('|');
  });

  it('detects when URL matches mailbox mode', () => {
    expect(isViewModeUrlSettled('mailbox', null)).toBe(true);
    expect(isViewModeUrlSettled('mailbox', 'people')).toBe(false);
    expect(isViewModeUrlSettled('people', 'people')).toBe(true);
  });

  it('blocks URL sync while manual override is pending', () => {
    expect(shouldSyncViewFromUrl(true, 'mailbox', 'people')).toBe(false);
    expect(shouldSyncViewFromUrl(true, 'mailbox', null)).toBe(true);
    expect(shouldSyncViewFromUrl(false, 'mailbox', 'people')).toBe(true);
  });

  it('blocks Inbox switch race: override target mailbox while URL still people', () => {
    expect(shouldSyncViewFromUrl(true, 'people', 'people', 'mailbox')).toBe(false);
    expect(shouldSyncViewFromUrl(true, 'mailbox', null, 'mailbox')).toBe(true);
  });
});
