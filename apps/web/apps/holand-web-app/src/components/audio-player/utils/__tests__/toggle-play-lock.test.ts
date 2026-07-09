import { describe, expect, it } from 'vitest';
import { createTogglePlayLock } from '@/components/audio-player/utils/toggle-play-lock';

describe('createTogglePlayLock', () => {
  it('serializes concurrent toggle calls', async () => {
    const lock = createTogglePlayLock();
    const order: number[] = [];

    lock.run(async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 20));
      order.push(2);
    });
    lock.run(() => {
      order.push(3);
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(order).toEqual([1, 2, 3]);
  });
});
