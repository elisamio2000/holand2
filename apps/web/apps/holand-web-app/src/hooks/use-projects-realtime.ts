'use client';

import { useCallback, useEffect, useRef } from 'react';
import { subscribeProjectsEvents } from '@/app/shared/projects/realtime/projects-event-bus';
import { getProjectsRealtimeConfig } from '@/app/shared/projects/realtime/projects-realtime-config';
import { invalidateProjectsCache } from '@/app/shared/projects/utils/projects-cache';
import type {
  ProjectsRealtimeEvent,
  ProjectsRealtimeScope,
} from '@/app/shared/projects/realtime/projects-realtime.types';

const DEBOUNCE_MS = 350;

export interface UseProjectsRealtimeOptions {
  scope: ProjectsRealtimeScope;
  projectId?: string;
  taskId?: string;
  onEvent?: (event: ProjectsRealtimeEvent) => void;
  enabled?: boolean;
}

function eventMatchesScope(
  event: ProjectsRealtimeEvent,
  scope: ProjectsRealtimeScope,
  projectId?: string,
  taskId?: string
): boolean {
  if (scope === 'global') return true;
  if (scope === 'project') return !projectId || event.projectId === projectId;
  if (scope === 'task') return !taskId || event.taskId === taskId;
  return true;
}

function invalidateForEvent(event: ProjectsRealtimeEvent): void {
  switch (event.type) {
    case 'task.created':
    case 'task.updated':
    case 'task.status_changed':
    case 'task.deleted':
      invalidateProjectsCache('tasks:mine');
      if (event.projectId) invalidateProjectsCache(`projects:${event.projectId}`);
      if (event.taskId) invalidateProjectsCache(`tasks:detail:${event.taskId}`);
      break;
    case 'project.updated':
      invalidateProjectsCache('projects:list');
      invalidateProjectsCache('projects:stats');
      if (event.projectId) invalidateProjectsCache(`projects:detail:${event.projectId}`);
      break;
    case 'activity.new':
      if (event.projectId) invalidateProjectsCache(`projects:${event.projectId}:activity`);
      break;
    case 'comment.new':
      if (event.taskId) invalidateProjectsCache(`tasks:detail:${event.taskId}`);
      break;
    default:
      invalidateProjectsCache('all');
  }
}

export function useProjectsRealtime({
  scope,
  projectId,
  taskId,
  onEvent,
  enabled = true,
}: UseProjectsRealtimeOptions): void {
  const config = getProjectsRealtimeConfig();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<ProjectsRealtimeEvent[]>([]);

  const flush = useCallback(() => {
    const events = pendingRef.current;
    pendingRef.current = [];
    const seen = new Set<string>();
    for (const ev of events) {
      const key = `${ev.type}:${ev.projectId ?? ''}:${ev.taskId ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      invalidateForEvent(ev);
      onEvent?.(ev);
    }
  }, [onEvent]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    if (!enabled || !config.enabled) return undefined;

    const unsub = subscribeProjectsEvents((event) => {
      if (!eventMatchesScope(event, scope, projectId, taskId)) return;
      pendingRef.current.push(event);
      scheduleFlush();
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, config.enabled, scope, projectId, taskId, scheduleFlush]);
}
