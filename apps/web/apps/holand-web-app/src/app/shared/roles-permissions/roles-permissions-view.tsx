// ============================================
// RolesPermissionsView — Tabbed access management UI
// Users, Roles, Groups, Permissions tabs with URL sync
// ============================================

'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { Text } from 'rizzui';
import {
  PiUsersBold,
  PiShieldCheckBold,
  PiUsersThreeBold,
  PiLockKeyBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import ModalButton from '@/app/shared/modal-button';
import RolesGrid from '@/app/shared/roles-permissions/roles-grid';
import UsersTable from '@/app/shared/roles-permissions/users-table';
import CreateRole from '@/app/shared/roles-permissions/create-role';
import CreateUser from '@/app/shared/roles-permissions/create-user';
import GroupsTable from '@/app/shared/roles-permissions/groups-table';
import PermissionsView from '@/app/shared/roles-permissions/permissions-view';
import type { PermissionsSubTab } from '@/app/shared/roles-permissions/permissions-sub-tabs';
import { DEFAULT_PERMISSIONS_SUB_TAB, permissionsSubTabPath } from '@/app/shared/roles-permissions/permissions-sub-tabs';

/**
 * Access Management — Tabbed view for managing users, roles, groups and permissions.
 *
 * Provides 4 tabbed sections:
 * 1. Users — CRUD user accounts (GET/PATCH/DELETE /users/, POST /admin/users via Gateway)
 * 2. Roles — CRUD roles + permission assignment (GET/POST/DELETE /roles/, POST /rbac/permissions/assign)
 * 3. Groups — CRUD groups, members, modules, files, cases (GET/POST/PUT/DELETE /group-rbac/groups/*)
 * 4. Permissions — Matrix view, overrides, hierarchy, routes, rate limits, audit log, config
 *
 * @requires adminService — for all API calls
 * @requires UsersTable, RolesGrid, GroupsTable, PermissionsView — tab content components
 */

type TabKey = 'users' | 'roles' | 'groups' | 'permissions';
export type { TabKey };

interface TabDef {
  key: TabKey;
  labelKey: string;
  icon: React.ReactNode;
  descKey: string;
}

/** Base path for roles-permissions routes */
const BASE_PATH = '/roles-permissions';

const TABS: TabDef[] = [
  {
    key: 'users',
    labelKey: 'rolesPermissionsPage.tabUsers',
    icon: <PiUsersBold className="h-[18px] w-[18px]" />,
    descKey: 'rolesPermissionsPage.tabUsersDesc',
  },
  {
    key: 'roles',
    labelKey: 'rolesPermissionsPage.tabRoles',
    icon: <PiShieldCheckBold className="h-[18px] w-[18px]" />,
    descKey: 'rolesPermissionsPage.tabRolesDesc',
  },
  {
    key: 'groups',
    labelKey: 'rolesPermissionsPage.tabGroups',
    icon: <PiUsersThreeBold className="h-[18px] w-[18px]" />,
    descKey: 'rolesPermissionsPage.tabGroupsDesc',
  },
  {
    key: 'permissions',
    labelKey: 'rolesPermissionsPage.tabPermissions',
    icon: <PiLockKeyBold className="h-[18px] w-[18px]" />,
    descKey: 'rolesPermissionsPage.tabPermissionsDesc',
  },
];

interface RolesPermissionsViewProps {
  /** Initial active tab read from URL segment (defaults to 'users') */
  initialTab?: TabKey;
  /** Initial permissions sub-tab when active tab is permissions */
  initialPermissionsSubTab?: PermissionsSubTab;
}

export default function RolesPermissionsView({
  initialTab = 'users',
  initialPermissionsSubTab = DEFAULT_PERMISSIONS_SUB_TAB,
}: RolesPermissionsViewProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [rolesKey, setRolesKey] = useState(0);
  const [usersKey, setUsersKey] = useState(0);

  /** Force re-mount of UsersTable when a user is created */
  const handleUsersChanged = useCallback(() => {
    console.info('[RolesPermissionsView] Users changed, refreshing table');
    setUsersKey((k) => k + 1);
  }, []);

  /**
   * Switch active tab and update the URL path.
   * Uses router.replace to avoid polluting browser history on every tab switch.
   */
  const handleTabChange = useCallback(
    (tab: TabKey) => {
      console.info('[RolesPermissionsView] Tab changed:', { from: activeTab, to: tab });
      setActiveTab(tab);
      const path =
        tab === 'permissions'
          ? permissionsSubTabPath(DEFAULT_PERMISSIONS_SUB_TAB)
          : `${BASE_PATH}/${tab}`;
      router.replace(path, { scroll: false });
    },
    [router, activeTab]
  );

  /** Force re-mount of RolesGrid when roles are created/deleted */
  const handleRolesChanged = useCallback(() => {
    console.info('[RolesPermissionsView] Roles changed, refreshing grid');
    setRolesKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-2 overflow-x-auto rounded-xl border border-muted bg-gray-0 p-1.5 dark:bg-gray-50">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'group flex min-w-[140px] flex-1 items-center gap-3 rounded-lg px-4 py-3 text-left transition-all',
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/50'
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                activeTab === tab.key
                  ? 'bg-white/20'
                  : 'bg-gray-100 dark:bg-gray-200/70'
              )}
            >
              {tab.icon}
            </span>
            <div className="min-w-0">
              <Text
                className={cn(
                  'text-sm font-semibold',
                  activeTab === tab.key ? 'text-white' : ''
                )}
              >
                {t(tab.labelKey)}
              </Text>
              <Text
                className={cn(
                  'hidden text-xs lg:block',
                  activeTab === tab.key
                    ? 'text-white/70'
                    : 'text-gray-400'
                )}
              >
                {t(tab.descKey)}
              </Text>
            </div>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-muted bg-gray-0 p-5 dark:bg-gray-50 lg:p-6">
        {/* ── Users Tab ── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <ModalButton
                label={t('rolesPermissionsPage.addUser')}
                view={<CreateUser onCreated={handleUsersChanged} />}
                customSize="600px"
              />
            </div>
            <UsersTable key={usersKey} />
          </div>
        )}

        {/* ── Roles Tab ── */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <ModalButton
                label={t('rolesPermissionsPage.addRole')}
                view={<CreateRole onCreated={handleRolesChanged} />}
              />
            </div>
            <RolesGrid key={rolesKey} />
          </div>
        )}

        {/* ── Groups Tab ── */}
        {activeTab === 'groups' && <GroupsTable />}

        {/* ── Permissions Tab ── */}
        {activeTab === 'permissions' && (
          <PermissionsView initialSubTab={initialPermissionsSubTab} />
        )}
      </div>
    </div>
  );
}


