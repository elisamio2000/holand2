import type { ProjectsRealtimeConfig } from './projects-realtime.types';

export function getProjectsRealtimeConfig(): ProjectsRealtimeConfig {
  const enabled =
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_PROJECTS_REALTIME !== 'false';
  const pollMs = Number(process.env.NEXT_PUBLIC_PROJECTS_POLL_MS ?? 30_000);
  return { enabled, pollMs };
}
