import { eventWithTime, EventType } from '@rrweb/types';


/** rrweb EventType.FullSnapshot */
const FULL_SNAPSHOT = EventType.FullSnapshot;
/** rrweb EventType.Meta */
const META = EventType.Meta;

function isBaselineEvent(event: eventWithTime): boolean {
  return event.type === FULL_SNAPSHOT || event.type === META;
}

/** Latest FullSnapshot or Meta index in chronological order. */
export function findLatestBaselineIndex(events: eventWithTime[]): number {
  for (let i = events.length - 1; i >= 0; i--) {
    if (isBaselineEvent(events[i])) return i;
  }
  return -1;
}

/** Merge rrweb streams (buffer + live ref) without duplicates. */
export function mergeRrwebEvents(...sources: eventWithTime[][]): eventWithTime[] {
  const byKey = new Map<string, eventWithTime>();

  for (const events of sources) {
    for (const event of events) {
      byKey.set(`${event.timestamp}:${event.type}`, event);
    }
  }

  return [...byKey.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export type ReplayEventStats = {
  total: number;
  playable: number;
  fullSnapshots: number;
  incremental: number;
  hasBaseline: boolean;
};

export function getReplayEventStats(events: eventWithTime[]): ReplayEventStats {
  const fullSnapshots = events.filter((e) => e.type === FULL_SNAPSHOT).length;
  const incremental = events.filter((e) => e.type === 3).length;
  const playable = normalizeReplayEvents(events).length;

  return {
    total: events.length,
    playable,
    fullSnapshots,
    incremental,
    hasBaseline: events.some(isBaselineEvent),
  };
}

/**
 * rrweb replay requires a baseline (FullSnapshot or Meta) before incremental events.
 * Pre-capture buffer events without a snapshot break the player — trim them here.
 */
export function normalizeReplayEvents(events: eventWithTime[]): eventWithTime[] {
  if (!events?.length) return [];

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const baselineIdx = sorted.findIndex((e) => e.type === FULL_SNAPSHOT || e.type === META);

  if (baselineIdx === -1) return [];

  return sorted.slice(baselineIdx);
}

/** Viewport from rrweb Meta event (matches the recorded browser size). */
export function extractRecordedViewport(
  events: eventWithTime[],
  fallback?: { width: number; height: number }
): { width: number; height: number } {
  const sorted = normalizeReplayEvents(events);
  const meta = sorted.find((e) => e.type === META);
  const data = meta?.data as { width?: number; height?: number } | undefined;

  if (data?.width && data?.height) {
    return { width: data.width, height: data.height };
  }

  return fallback ?? { width: 1280, height: 720 };
}
