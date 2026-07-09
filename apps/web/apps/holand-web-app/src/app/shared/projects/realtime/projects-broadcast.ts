import type { ProjectsRealtimeEvent } from './projects-realtime.types';

const CHANNEL = 'projects-realtime-v1';

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL);
  return channel;
}

export function broadcastProjectsEvent(event: ProjectsRealtimeEvent): void {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage(event);
  } catch {
    /* ignore */
  }
}

export function subscribeProjectsBroadcast(listener: (event: ProjectsRealtimeEvent) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => undefined;

  const handler = (msg: MessageEvent<ProjectsRealtimeEvent>) => {
    if (msg.data?.type) listener(msg.data);
  };
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}
