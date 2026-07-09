// ============================================
// Holand Permissions Hook
// Access session RBAC data in client components
// ============================================

'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useMemo } from 'react';

export function usePermissions() {
  const { data: session, status } = useSession();
  const user = session?.user;

  const roles = useMemo(() => user?.roles || [], [user?.roles]);
  const permissions = useMemo(
    () => user?.permissions || [],
    [user?.permissions]
  );
  const allowedSections = useMemo(
    () => user?.allowedSections || [],
    [user?.allowedSections]
  );
  const groups = useMemo(() => user?.groups || {}, [user?.groups]);

  /** Check if user has a specific permission (e.g. "chat:read") */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (user?.isSuperAdmin) return true;
      return permissions.includes(permission);
    },
    [permissions, user?.isSuperAdmin]
  );

  /** Check if user has ANY of the given permissions */
  const hasAnyPermission = useCallback(
    (...perms: string[]): boolean => {
      if (user?.isSuperAdmin) return true;
      return perms.some((p) => permissions.includes(p));
    },
    [permissions, user?.isSuperAdmin]
  );

  /** Check if user has ALL of the given permissions */
  const hasAllPermissions = useCallback(
    (...perms: string[]): boolean => {
      if (user?.isSuperAdmin) return true;
      return perms.every((p) => permissions.includes(p));
    },
    [permissions, user?.isSuperAdmin]
  );

  /** Check if user has a specific role */
  const hasRole = useCallback(
    (role: string): boolean => roles.includes(role),
    [roles]
  );

  /** Check if user can access a specific section */
  const canAccessSection = useCallback(
    (section: string): boolean => {
      if (user?.isSuperAdmin) return true;
      return allowedSections.includes(section);
    },
    [allowedSections, user?.isSuperAdmin]
  );

  return {
    // State
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    user,

    // RBAC data
    roles,
    permissions,
    allowedSections,
    groups,
    isAdmin: user?.isAdmin || false,
    isSuperAdmin: user?.isSuperAdmin || false,

    // Check functions
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccessSection,
  };
}

