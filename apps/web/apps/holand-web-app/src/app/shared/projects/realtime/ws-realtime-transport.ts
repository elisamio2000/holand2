/** WebSocket transport stub — no-op until GET /projects/ws-info is available. */
import type { ProjectsRealtimeEvent } from './projects-realtime.types';
import { subscribeProjectsEvents } from './projects-event-bus';

export function startWsRealtimeTransport(): () => void {
  // Future: connect to WS and forward events to emitProjectsEvent
  return () => undefined;
}

export function initMockRealtimeTransport(): () => void {
  return subscribeProjectsEvents(() => {
    /* mock CRUD already emits via emitProjectsEvent */
  });
}
