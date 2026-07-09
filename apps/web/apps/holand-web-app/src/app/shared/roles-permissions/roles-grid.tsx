'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Loader, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import RoleCard from '@/app/shared/roles-permissions/role-card';
import { adminService } from '@/services/admin.service';
import type { RoleResponse, UserInfo } from '@/types/auth.types';

/**
 * RolesGrid — Displays all roles in a responsive card grid.
 *
 * Data sources:
 * - GET /roles/?include_user_count=true — Roles with user_count
 * - GET /users/ — Fetched once for expandable user list per role
 *
 * @requires adminService — for API calls
 * @requires RoleCard — individual role display
 */

// Color palette for role cards
const ROLE_COLORS: Record<string, string> = {
  'super-admin': '#FF1A1A',
  admin: '#2465FF',
  analyst: '#8A63D2',
  user: '#11A849',
  pending: '#F59E0B',
  'chat-only': '#6366F1',
};
const DEFAULT_COLORS = ['#F5A623', '#0070F3', '#4E36F5', '#FF6B6B', '#00C48C', '#7B61FF'];

function getRoleColor(roleName: string, index: number): string {
  return ROLE_COLORS[roleName] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

interface RolesGridProps {
  className?: string;
  gridClassName?: string;
}

export default function RolesGrid({ className, gridClassName }: RolesGridProps) {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    console.info('[RolesGrid] Fetching roles and users...');
    try {
      // Fetch roles first — this always works
      // NOTE: getRoles() no longer accepts includeUserCount param — backend doesn't support it
      const rolesData = await adminService.getRoles();
      setRoles(rolesData);

      // Fetch users separately — may fail or return empty
      // (backend /admin/users requires proper admin token)
      let usersData: UserInfo[] = [];
      try {
        usersData = await adminService.getAdminUsers();
      } catch (usersErr: any) {
        const status = usersErr?.response?.status;
        console.warn('[RolesGrid] Could not fetch users (non-blocking):', {
          status,
          message: usersErr?.message,
        });
        // Non-critical — role cards still work, just without user list expansion
      }

      console.info('[RolesGrid] Loaded:', {
        roles: rolesData.length,
        users: usersData.length,
        rolesWithPermissions: rolesData.filter((r) => Array.isArray(r.permissions) && r.permissions.length > 0).length,
      });
      setAllUsers(usersData);
    } catch (err: unknown) {
      console.error('[RolesGrid] Failed to load roles:', err);
      const message = err instanceof Error ? err.message : t('rolesGrid.errors.failedToLoad');
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="xl" />
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Text className="text-gray-500">{t('rolesGrid.emptyState.message')}</Text>
      </div>
    );
  }

  return (
    <div className={cn('@container', className)}>
      <div
        className={cn(
          'grid grid-cols-1 gap-6 @[36.65rem]:grid-cols-2 @[56rem]:grid-cols-3 @[78.5rem]:grid-cols-4 @[100rem]:grid-cols-5',
          gridClassName
        )}
      >
        {roles.map((role, index) => (
          <RoleCard
            key={role.id}
            role={role}
            color={getRoleColor(role.name, index)}
            onDeleted={fetchRoles}
            usersWithRole={allUsers.filter((u) => u.role === role.name)}
          />
        ))}
      </div>
    </div>
  );
}
