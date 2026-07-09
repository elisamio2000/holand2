import type { ProjectsListParams, TasksListParams } from '@/types/projects.types';

/** Stable JSON key for cache/dedupe — avoids infinite loops from inline `{}` deps. */
export function stableParamsKey(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const v = params[key];
      if (v !== undefined && v !== null && v !== '') acc[key] = v;
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

export const EMPTY_TASKS_PARAMS: TasksListParams = Object.freeze({});

export const PERSONAL_TASKS_PARAMS: TasksListParams = Object.freeze({ personal_only: true });

export const DEFAULT_PROJECTS_LIST_PARAMS: ProjectsListParams = Object.freeze({});

export function tasksCacheKey(params: TasksListParams, userId?: string): string {
  return `tasks:mine:${stableParamsKey(params as Record<string, unknown>)}:${userId ?? ''}`;
}

export function projectsListCacheKey(params: ProjectsListParams): string {
  return `projects:list:${stableParamsKey(params as Record<string, unknown>)}`;
}
