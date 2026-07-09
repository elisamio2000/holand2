/** Mock transport — CRUD in mock-projects-api emits via projects-event-bus. */
import { subscribeProjectsEvents } from './projects-event-bus';

export function startMockRealtimeTransport(): () => void {
  return subscribeProjectsEvents(() => {
    /* events flow to useProjectsRealtime subscribers */
  });
}
