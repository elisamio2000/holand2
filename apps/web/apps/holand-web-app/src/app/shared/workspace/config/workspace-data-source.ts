export type WorkspaceDataSourceMode = 'mock' | 'live' | 'auto';

export type WorkspaceDataStatus = 'mock' | 'live' | 'degraded';

function envSource(): WorkspaceDataSourceMode {
  const v = process.env.NEXT_PUBLIC_WORKSPACE_DATA_SOURCE?.toLowerCase();
  if (v === 'mock' || v === 'live' || v === 'auto') return v;
  return 'auto';
}

/** Production builds always use live API — mock is never allowed. */
export function isWorkspaceLiveOnly(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isWorkspaceForceMock(): boolean {
  if (isWorkspaceLiveOnly()) return false;
  if (process.env.NEXT_PUBLIC_WORKSPACE_FORCE_MOCK === 'true') return true;
  if (process.env.NEXT_PUBLIC_WORKSPACE_FORCE_MOCK === 'false') return false;
  return envSource() === 'mock';
}

/** Whether mock adapter may be used (dev / non-production only). */
export function isWorkspaceMockAllowed(): boolean {
  if (isWorkspaceLiveOnly()) return false;
  return true;
}

/** True when operations should read/write mock store instead of gateway. */
export function isWorkspaceMockEnabled(): boolean {
  if (isWorkspaceLiveOnly()) return false;
  if (isWorkspaceForceMock()) return true;
  if (envSource() === 'live') return false;
  // auto: prefer mock in development for full UX without backend
  return process.env.NODE_ENV === 'development';
}

export function isWorkspaceDevPanelEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_WORKSPACE_DEV_PANEL === 'true') return true;
  return process.env.NODE_ENV === 'development';
}

export function getWorkspaceDataStatus(useMock: boolean, hadLiveError?: boolean): WorkspaceDataStatus {
  if (isWorkspaceLiveOnly()) return hadLiveError ? 'degraded' : 'live';
  if (useMock) return 'mock';
  return hadLiveError ? 'degraded' : 'live';
}
