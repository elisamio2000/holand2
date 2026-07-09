import { describe, expect, it } from 'vitest';
import { dedupeAsync } from '@/utils/async-dedup';

describe('search fetch dedupe pattern', () => {
  it('coalesces concurrent calls with same key', async () => {
    let runs = 0;
    const fn = () =>
      dedupeAsync('search:test', async () => {
        runs += 1;
        await new Promise((r) => setTimeout(r, 10));
        return { ok: true };
      });

    const [a, b] = await Promise.all([fn(), fn()]);
    expect(runs).toBe(1);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
  });
});
