// ============================================
// Holand Permissions API Hook
// Fetches fine-grained permission data from backend API.
// Use this when you need deny-list / override data.
// For quick section / role checks, use use-permissions.ts instead.
// ============================================

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminService } from '@/services/admin.service';
import type { UserPermissionsResponse } from '@/types/auth.types';

interface PermissionsState {
  permissions: string[];
  roles: string[];
  customGrants: string[];
  customDenies: string[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * usePermissionsApi â€” API-based permission checking hook.
 *
 * Fetches and caches the current user's fine-grained permissions from the
 * backend (GET /admin/rbac/user/{id}/effective). Exposes deny-list awareness
 * via `isDenied()`, which the session-based `usePermissions` hook does not.
 *
 * NOTE: For quick section / role checks backed by the NextAuth session (no
 * extra API call), use `use-permissions.ts` â†’ `usePermissions` instead.
 * This hook is intended for admin UIs that must respect per-user overrides.
 *
 * @returns Permission state + helper methods (can, canAll, canAny, isDenied)
 *
 * @example
 * ```tsx
 * const { can, isDenied, loading } = usePermissionsApi();
 *
 * if (can('admin:users:delete')) {
 *   // show delete button
 * }
 * if (isDenied('admin:users:delete')) {
 *   // show "explicitly denied" badge
 * }
 * ```
 */
export function usePermissionsApi(): PermissionsState & {
  can: (permission: string) => boolean;
  canAll: (permissions: string[]) => boolean;
  canAny: (permissions: string[]) => boolean;
  isDenied: (permission: string) => boolean;
} {
  const [permissionsData, setPermissionsData] =
    useState<UserPermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPermissions = useCallback(async () => {
    console.info('[usePermissionsApi] Fetching current user permissions from API...');
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getCurrentUserPermissions();
      console.info('[usePermissionsApi] Permissions loaded:', {
        permissionCount: data.permissions.length,
        roles: data.roles,
        customGrantCount: data.custom_grants?.length ?? 0,
        customDenyCount: data.custom_denies?.length ?? 0,
      });
      setPermissionsData(data);
    } catch (err: unknown) {
      const normalized =
        err instanceof Error ? err : new Error('Failed to fetch permissions');
      setError(normalized);
      console.error('[usePermissionsApi] Failed to fetch permissions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Memoized Sets for O(1) lookups instead of O(n) Array.includes()
  const permissionSet = useMemo(
    () => new Set(permissionsData?.permissions || []),
    [permissionsData?.permissions]
  );

  const denySet = useMemo(
    () => new Set(permissionsData?.custom_denies || []),
    [permissionsData?.custom_denies]
  );

  const can = useCallback(
    (permission: string): boolean => {
      // Explicit deny takes precedence over grant
      if (denySet.has(permission)) return false;
      return permissionSet.has(permission);
    },
    [permissionSet, denySet]
  );

  const canAll = useCallback(
    (permissions: string[]): boolean => permissions.every((p) => can(p)),
    [can]
  );

  const canAny = useCallback(
    (permissions: string[]): boolean => permissions.some((p) => can(p)),
    [can]
  );

  const isDenied = useCallback(
    (permission: string): boolean => denySet.has(permission),
    [denySet]
  );

  return {
    permissions: permissionsData?.permissions || [],
    roles: permissionsData?.roles || [],
    customGrants: permissionsData?.custom_grants || [],
    customDenies: permissionsData?.custom_denies || [],
    loading,
    error,
    refetch: fetchPermissions,
    can,
    canAll,
    canAny,
    isDenied,
  };
}

export default usePermissionsApi;

