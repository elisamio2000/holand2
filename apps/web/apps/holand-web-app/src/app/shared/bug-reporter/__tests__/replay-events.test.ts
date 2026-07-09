import { describe, expect, it } from 'vitest';
import { EventType, type eventWithTime } from '@rrweb/types';
import {
  getReplayEventStats,
  mergeRrwebEvents,
  normalizeReplayEvents,
} from '../capture/replay-events';
import { RollingBuffer } from '../capture/rolling-buffer';

function event(type: EventType, timestamp: number): eventWithTime {
  return { type, timestamp, data: {} } as eventWithTime;
}

describe('replay-events', () => {
  it('normalizeReplayEvents drops incremental events before baseline', () => {
    const events = [
      event(EventType.IncrementalSnapshot, 100),
      event(EventType.FullSnapshot, 200),
      event(EventType.IncrementalSnapshot, 300),
    ];

    expect(normalizeReplayEvents(events)).toHaveLength(2);
    expect(normalizeReplayEvents(events)[0].type).toBe(EventType.FullSnapshot);
  });

  it('mergeRrwebEvents deduplicates and sorts', () => {
    const a = [event(EventType.Meta, 10), event(EventType.IncrementalSnapshot, 20)];
    const b = [event(EventType.Meta, 10), event(EventType.FullSnapshot, 15)];

    const merged = mergeRrwebEvents(a, b);
    expect(merged.map((e) => e.timestamp)).toEqual([10, 15, 20]);
  });

  it('getReplayEventStats reports playable events when baseline exists', () => {
    const events = [
      event(EventType.FullSnapshot, 1),
      event(EventType.IncrementalSnapshot, 2),
      event(EventType.IncrementalSnapshot, 3),
    ];

    const stats = getReplayEventStats(events);
    expect(stats.hasBaseline).toBe(true);
    expect(stats.playable).toBe(3);
    expect(stats.fullSnapshots).toBe(1);
  });
});

describe('RollingBuffer replay baseline', () => {
  it('keeps latest FullSnapshot even when outside time window', () => {
    const buffer = new RollingBuffer(30, true);
    const oldBaseline = Date.now() - 60_000;

    buffer.addRrwebEvent(event(EventType.FullSnapshot, oldBaseline));
    buffer.addRrwebEvent(event(EventType.IncrementalSnapshot, Date.now() - 1000));
    buffer.addRrwebEvent(event(EventType.IncrementalSnapshot, Date.now() - 500));

    const snapshot = buffer.getLastNSeconds(30);
    expect(snapshot.rrwebEvents.some((e) => e.type === EventType.FullSnapshot)).toBe(true);
    expect(getReplayEventStats(snapshot.rrwebEvents).playable).toBeGreaterThan(0);
  });
});
