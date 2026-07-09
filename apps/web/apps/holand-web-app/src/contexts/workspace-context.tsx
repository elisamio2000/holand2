// ============================================
// WorkspaceContext â€” Group-based workspace switching
// Provides active workspace state across the application
// ============================================
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSession } from 'next-auth/react';

import type { GroupResponse } from '@/types/auth.types';
import { isWorkspaceMockEnabled } from '@/app/shared/workspace/config/workspace-data-source';
import { workspaceApiAdapter } from '@/services/workspace-api.adapter';
import {
  WORKSPACE_STORAGE_KEY,
  dispatchWorkspaceChanged,
  getWorkspaceRoleFromSession,
  isWorkspaceAdminRole,
  readStoredWorkspaceId,
} from '@/lib/workspace-group-id';
import { invalidateWorkspaceCaches } from '@/lib/workspace-cache';

export { WORKSPACE_STORAGE_KEY, WORKSPACE_CHANGED_EVENT } from '@/lib/workspace-group-id';
export { isWorkspaceAdminRole, getWorkspaceRoleFromSession } from '@/lib/workspace-group-id';

/**
 * Workspace info derived from GroupResponse.
 * Simplified structure for UI consumption.
 */
export interface WorkspaceInfo {
  /** Group ID from backend */
  id: string;
  /** Group display name */
  name: string;
  /** Optional description */
  description?: string | null;
  /** Whether group is active */
  is_active: boolean;
  /** User role in this workspace (from session) */
  role?: string | null;
}

/**
 * Shape of the workspace context value.
 */
interface WorkspaceContextValue {
  /** All workspaces (groups) available to the current user */
  workspaces: WorkspaceInfo[];
  /** Currently active workspace, or null if none selected */
  activeWorkspace: WorkspaceInfo | null;
  /** Switch to a different workspace by ID */
  setActiveWorkspace: (workspaceId: string) => void;
  /** Clear workspace selection (show all data) */
  clearWorkspace: () => void;
  /** Whether workspaces are still loading */
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspace: () => {},
  clearWorkspace: () => {},
  isLoading: true,
});

function mapSessionGroupsToWorkspaces(
  groups: unknown
): WorkspaceInfo[] {
  if (!groups || typeof groups !== 'object') return [];

  if (Array.isArray(groups)) {
    return (groups as GroupResponse[]).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      is_active: g.is_active,
      role: null,
    }));
  }

  return Object.entries(groups as Record<string, Record<string, unknown>>).map(
    ([id, data]) => ({
      id,
      name:
        (typeof data?.group_name === 'string' && data.group_name) ||
        (typeof data?.name === 'string' && data.name) ||
        id,
      description:
        typeof data?.description === 'string' ? data.description : null,
      is_active: data?.is_active !== false,
      role: getWorkspaceRoleFromSession(groups as Record<string, unknown>, id),
    })
  );
}

/**
 * WorkspaceProvider â€” Provides group-based workspace switching.
 *
 * Reads the user's groups from the next-auth session (populated by
 * /admin/group-rbac/effective at login) and allows switching
 * between them. Selection is persisted in localStorage.
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [mockTick, setMockTick] = useState(0);

  useEffect(() => {
    const onMock = () => setMockTick((n) => n + 1);
    window.addEventListener('Holand:workspace-mock-changed', onMock);
    return () => window.removeEventListener('Holand:workspace-mock-changed', onMock);
  }, []);

  const workspaces = useMemo<WorkspaceInfo[]>(() => {
    const groups = (session?.user as Record<string, unknown>)?.groups;
    const fromSession = mapSessionGroupsToWorkspaces(groups);
    if (!isWorkspaceMockEnabled()) return fromSession;
    const mockGroups = workspaceApiAdapter.listMockGroupsForContext();
    const merged = new Map<string, WorkspaceInfo>();
    for (const ws of fromSession) merged.set(ws.id, ws);
    for (const g of mockGroups) {
      if (!merged.has(g.id)) {
        // Resolve the mock user's real per-group role (owner/admin/analyst/...)
        // instead of assuming 'admin' for every workspace â€” otherwise the
        // 'Legal Review' analyst persona and owner-only UI never activate.
        merged.set(g.id, {
          id: g.id,
          name: g.name,
          description: g.description,
          is_active: g.is_active,
          role: workspaceApiAdapter.getMockCurrentUserRole(g.id) ?? 'admin',
        });
      }
    }
    return Array.from(merged.values());
    // mockTick refreshes list after mock CRUD
  }, [session, mockTick]);

  useEffect(() => {
    if (initialized) return;
    const saved = readStoredWorkspaceId();
    if (saved && workspaces.some((w) => w.id === saved)) {
      console.info('[WorkspaceContext] Restored workspace:', { id: saved });
      setActiveId(saved);
    }
    setInitialized(true);
  }, [workspaces, initialized]);

  const setActiveWorkspace = useCallback(
    (workspaceId: string) => {
      const ws = workspaces.find((w) => w.id === workspaceId);
      if (!ws) {
        console.warn('[WorkspaceContext] Workspace not found:', { workspaceId });
        return;
      }

      console.info('[WorkspaceContext] Switching workspace:', {
        id: workspaceId,
        name: ws.name,
      });
      setActiveId(workspaceId);

      try {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
      } catch {
        // Ignore localStorage errors
      }

      dispatchWorkspaceChanged(workspaceId);
      invalidateWorkspaceCaches();
    },
    [workspaces]
  );

  const clearWorkspace = useCallback(() => {
    console.info('[WorkspaceContext] Clearing active workspace');
    setActiveId(null);
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } catch {
      // Ignore localStorage errors
    }
    dispatchWorkspaceChanged(null);
    invalidateWorkspaceCaches();
  }, []);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) || null,
    [workspaces, activeId]
  );

  const value = useMemo<WorkspaceContextValue>(() => {
    // Session may stay "loading" while mock/live workspaces are already available.
    const isLoading = status === 'loading' && workspaces.length === 0;
    return {
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      clearWorkspace,
      isLoading,
    };
  }, [workspaces, activeWorkspace, setActiveWorkspace, clearWorkspace, status]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

/** Active workspace group id for API scoping (null = all workspaces / no filter). */
export function useActiveGroupId(): string | undefined {
  const { activeWorkspace } = useWorkspace();
  return activeWorkspace?.id;
}

/** Role in a workspace from session (defaults to active workspace). */
export function useWorkspaceRole(workspaceId?: string | null): string | null {
  const { data: session } = useSession();
  const { activeWorkspace, workspaces } = useWorkspace();
  const id = workspaceId ?? activeWorkspace?.id;
  if (!id) return null;
  const groups = (session?.user as Record<string, unknown>)?.groups;
  const fromSession = getWorkspaceRoleFromSession(groups, id);
  if (fromSession) return fromSession;
  return workspaces.find((w) => w.id === id)?.role ?? null;
}

/** Whether current user is admin/owner of the given or active workspace. */
export function useIsWorkspaceAdmin(workspaceId?: string | null): boolean {
  return isWorkspaceAdminRole(useWorkspaceRole(workspaceId));
}

