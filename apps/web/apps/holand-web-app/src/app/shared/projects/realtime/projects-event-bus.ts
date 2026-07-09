import type { ProjectsRealtimeEvent } from './projects-realtime.types';
import { broadcastProjectsEvent, subscribeProjectsBroadcast } from './projects-broadcast';

type Listener = (event: ProjectsRealtimeEvent) => void;

const listeners = new Set<Listener>();

export function subscribeProjectsEvents(listener: Listener): () => void {
  listeners.add(listener);
  const unsubBc = subscribeProjectsBroadcast((event) => listener(event));
  return () => {
    listeners.delete(listener);
    unsubBc();
  };
}

export function emitProjectsEvent(event: ProjectsRealtimeEvent): void {
  const enriched: ProjectsRealtimeEvent = { ...event, ts: Date.now() };
  listeners.forEach((fn) => fn(enriched));
  broadcastProjectsEvent(enriched);
}
