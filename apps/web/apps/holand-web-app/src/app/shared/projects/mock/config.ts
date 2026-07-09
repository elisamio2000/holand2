// ============================================
// Projects & Tasks — mock layer config
// REMOVABLE: delete mock/ + MOCK_LAYER in projects.service.ts when BE is live
// ============================================

import type { ProjectsMockMode, ProjectsModePref } from '@/types/projects.types';

export const MOCK_ID_PREFIXES = ['proj-mock-', 'task-mock-', 'case-mock-', 'user-mock-'] as const;

export const MOCK_LIMITS = {
  maxProjects: 5,
  maxTasks: 40,
  maxMembers: 8,
} as const;

/**
 * Controls mock behaviour for Projects & Tasks UI.
 *
 * Default: **off** — use gateway when mode=real (shows API errors until BE exists).
 *
 * - `NEXT_PUBLIC_PROJECTS_MOCK=true` → mock only (zero gateway calls)
 * - `NEXT_PUBLIC_PROJECTS_MOCK=fallback` → try gateway, sample data on failure
 * - `NEXT_PUBLIC_PROJECTS_MOCK=false` or unset → gateway only (unless mode forces mock)
 */
export function getProjectsMockMode(): ProjectsMockMode {
  const flag = process.env.NEXT_PUBLIC_PROJECTS_MOCK?.trim().toLowerCase();
  if (flag === 'true' || flag === 'only') return 'only';
  if (flag === 'fallback') return 'fallback';
  return 'off';
}

export function getProjectsModePref(): ProjectsModePref {
  const raw = process.env.NEXT_PUBLIC_PROJECTS_MODE?.trim().toLowerCase();
  if (raw === 'mock' || raw === 'real' || raw === 'auto') return raw;
  return 'auto';
}

/** Production builds require explicit opt-in for mock. */
export function isProjectsMockAllowedByEnvironment(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return getProjectsMockMode() === 'only';
}

export function resolveProjectsUsesMock(): boolean {
  const mode = getProjectsModePref();
  const mockFlag = getProjectsMockMode();

  if (mode === 'mock') return isProjectsMockAllowedByEnvironment() || mockFlag === 'only';
  if (mode === 'real') return false;
  if (mockFlag === 'only') return isProjectsMockAllowedByEnvironment();
  if (mockFlag === 'fallback') return false;
  if (process.env.NODE_ENV === 'development') {
    return !process.env.NEXT_PUBLIC_API_GATEWAY_URL && !process.env.API_GATEWAY_URL;
  }
  return false;
}

export function getDefaultMockProjectId(): string {
  return (
    process.env.NEXT_PUBLIC_PROJECTS_DEFAULT_PROJECT_ID?.trim() || 'proj-mock-001'
  );
}

export function isMockProjectsId(id: string): boolean {
  return MOCK_ID_PREFIXES.some((p) => id.startsWith(p));
}
