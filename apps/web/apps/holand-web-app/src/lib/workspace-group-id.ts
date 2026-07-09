/**
 * Resolve the active workspace (group) ID for API scoping.
 * Used by gatewayClient interceptor and services that build auth headers manually.
 *
 * Priority:
 * 1. localStorage `Holand_active_workspace` if still valid in session groups
 * 2. First group key from session (fallback)
 */

export const WORKSPACE_STORAGE_KEY = 'Holand_active_workspace';

export const WORKSPACE_CHANGED_EVENT = 'Holand:workspace-changed';

export type SessionGroups =
  | Record<string, Record<string, unknown>>
  | undefined
  | null;

/** Read persisted workspace id from localStorage (browser only). */
export function readStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Return group ids from session.groups map or array-shaped groups. */
export function getSessionGroupIds(
  groups: SessionGroups | unknown[] | unknown
): string[] {
  if (!groups || typeof groups !== 'object') return [];
  if (Array.isArray(groups)) {
    return groups
      .map((g) => (g as { id?: string }).id)
      .filter((id): id is string => Boolean(id));
  }
  return Object.keys(groups as Record<string, unknown>);
}

/**
 * Resolve which group_id to send as X-Group-Id or body.group_id.
 */
export function resolveActiveGroupId(
  groups: SessionGroups | unknown[] | unknown
): string | undefined {
  const groupIds = getSessionGroupIds(groups);
  if (groupIds.length === 0) return undefined;

  const stored = readStoredWorkspaceId();
  if (stored && groupIds.includes(stored)) {
    return stored;
  }

  return groupIds[0];
}

export function dispatchWorkspaceChanged(groupId: string | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_CHANGED_EVENT, { detail: { groupId } })
  );
}

/** Role name for a group from session.user.groups map. */
export function getWorkspaceRoleFromSession(
  groups: SessionGroups | unknown,
  workspaceId: string
): string | null {
  if (!groups || typeof groups !== 'object' || Array.isArray(groups)) return null;
  const entry = (groups as Record<string, Record<string, unknown>>)[workspaceId];
  if (!entry) return null;
  const role = entry.role ?? entry.role_name;
  return typeof role === 'string' ? role : null;
}

export function isWorkspaceAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return normalized === 'admin' || normalized === 'owner';
}

