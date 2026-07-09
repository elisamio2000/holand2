import { describe, expect, it } from 'vitest';
import type { eventWithTime } from '@rrweb/types';
import { RollingBuffer } from '../capture/rolling-buffer';

describe('RollingBuffer', () => {
  it('stores and returns items within time window', () => {
    const buffer = new RollingBuffer(30, true);
    buffer.addError({
      level: 'error',
      message: 'test error',
      timestamp: Date.now(),
    });
    buffer.addNavigation({
      timestamp: Date.now(),
      from: '/a',
      to: '/b',
      type: 'push',
    });

    const snapshot = buffer.getLastNSeconds(30);
    expect(snapshot.errors).toHaveLength(1);
    expect(snapshot.navigationLog).toHaveLength(1);
  });

  it('clears when disabled', () => {
    const buffer = new RollingBuffer(30, true);
    buffer.addError({ level: 'error', message: 'x', timestamp: Date.now() });
    buffer.setEnabled(false);
    expect(buffer.getLastNSeconds(30).errors).toHaveLength(0);
  });

  it('getSessionSince filters by start time', () => {
    const buffer = new RollingBuffer(30, true);
    const old = Date.now() - 60_000;
    buffer.addError({ level: 'error', message: 'old', timestamp: old });
    buffer.addError({ level: 'error', message: 'new', timestamp: Date.now() });

    const since = buffer.getSessionSince(Date.now() - 5000);
    expect(since.errors.every((e) => e.timestamp >= Date.now() - 5000)).toBe(true);
  });

  it('preserves FullSnapshot when trimming by memory pressure', () => {
    const buffer = new RollingBuffer(30, true);
    const now = Date.now();

    buffer.addRrwebEvent({
      type: 2,
      timestamp: now - 5000,
      data: { node: { type: 0, childNodes: [] }, initialOffset: { top: 0, left: 0 } },
    } as unknown as eventWithTime);

    for (let i = 0; i < 200; i++) {
      buffer.addRrwebEvent({
        type: 3,
        timestamp: now - 4000 + i,
        data: { source: 0, texts: [], attributes: [], removes: [], adds: [] },
      } as unknown as eventWithTime);
    }

    const snapshot = buffer.getLastNSeconds(30);
    expect(snapshot.rrwebEvents.some((e) => e.type === 2)).toBe(true);
  });
});
