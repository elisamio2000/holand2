// ============================================
// ProfileDetails — Real user profile details
// Shows user roles, permissions, sections from session
// ============================================
'use client';

import { useSession } from 'next-auth/react';
import { Badge, Title, Text, Loader } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  PiShieldCheckBold,
  PiKeyBold,
  PiSquaresFourBold,
  PiUsersBold,
  PiClockBold,
} from 'react-icons/pi';

/**
 * ProfileDetails — Displays real RBAC data for the logged-in user.
 *
 * Shows:
 * 1. Roles (from session)
 * 2. Allowed Sections (from session)
 * 3. Permissions (from session)
 * 4. Account Info (isAdmin, isSuperAdmin from session)
 * 5. Group Memberships (from session)
 *
 * WHY no adminService call: Session JWT already contains all RBAC data
 * fetched via GET /auth/permissions/me during login. No extra API call needed.
 * Using GET /admin/users/{id} would require admin:users permission and would
 * fail for non-admin users viewing their own profile.
 *
 * @requires next-auth/react — useSession for RBAC data
 */
export default function ProfileDetails() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();

  const roles = session?.user?.roles || [];
  const permissions = session?.user?.permissions || [];
  const allowedSections = session?.user?.allowedSections || [];
  const groups = session?.user?.groups || {};
  const groupNames = Object.keys(groups);
  const isAdmin = session?.user?.isAdmin || false;
  const isSuperAdmin = session?.user?.isSuperAdmin || false;

  if (status === 'loading') {
    return (
      <div className="mx-auto mt-10 flex min-h-[300px] w-full max-w-[1294px] items-center justify-center">
        <Loader variant="spinner" size="xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-[1294px] @2xl:mt-7 @6xl:mt-0">
      <div className="grid gap-6 @3xl:grid-cols-2 @5xl:grid-cols-3">

        {/* ---- Roles Card ---- */}
        <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
          <div className="mb-4 flex items-center gap-2">
            <PiShieldCheckBold className="h-5 w-5 text-primary" />
            <Title as="h3" className="text-base font-semibold text-gray-900 dark:text-gray-700">
              {t('account.personalInfo.role')}
            </Title>
          </div>
          <div className="flex flex-wrap gap-2">
            {roles.length > 0 ? (
              roles.map((role) => (
                <Badge
                  key={role}
                  variant="flat"
                  color={
                    role === 'super-admin'
                      ? 'danger'
                      : role === 'admin'
                        ? 'warning'
                        : role === 'analyst'
                          ? 'info'
                          : 'success'
                  }
                  className="capitalize text-sm"
                >
                  {role}
                </Badge>
              ))
            ) : (
              <Text className="text-sm text-gray-400">{t('common.noData')}</Text>
            )}
          </div>
          {isSuperAdmin && (
            <Text className="mt-3 text-xs text-red-500">
              Full system access — all permissions granted
            </Text>
          )}
        </div>

        {/* ---- Allowed Sections Card ---- */}
        <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
          <div className="mb-4 flex items-center gap-2">
            <PiSquaresFourBold className="h-5 w-5 text-primary" />
            <Title as="h3" className="text-base font-semibold text-gray-900 dark:text-gray-700">
              {t('account.personalInfo.allowedSections')}
            </Title>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowedSections.length > 0 ? (
              allowedSections.map((section) => (
                <Badge key={section} variant="outline" className="text-sm">
                  {section}
                </Badge>
              ))
            ) : (
              <Text className="text-sm text-gray-400">{t('common.noSectionsAssigned')}</Text>
            )}
          </div>
        </div>

        {/* ---- Groups Card ---- */}
        <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
          <div className="mb-4 flex items-center gap-2">
            <PiUsersBold className="h-5 w-5 text-primary" />
            <Title as="h3" className="text-base font-semibold text-gray-900 dark:text-gray-700">
              {t('userDetail.groupsLabel')}
            </Title>
          </div>
          <div className="flex flex-wrap gap-2">
            {groupNames.length > 0 ? (
              groupNames.map((groupId) => (
                <Badge key={groupId} variant="flat" color="secondary" className="text-sm">
                  {groupId.substring(0, 8)}...
                </Badge>
              ))
            ) : (
              <Text className="text-sm text-gray-400">{t('common.noData')}</Text>
            )}
          </div>
        </div>

        {/* ---- Account Status Card ---- */}
        <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
          <div className="mb-4 flex items-center gap-2">
            <PiClockBold className="h-5 w-5 text-primary" />
            <Title as="h3" className="text-base font-semibold text-gray-900 dark:text-gray-700">
              Account Info
            </Title>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <Text className="text-gray-500">Status</Text>
              <Badge
                variant="flat"
                color="success"
              >
                Active
              </Badge>
            </div>
            <div className="flex justify-between">
              <Text className="text-gray-500">Admin</Text>
              <Text className="text-gray-900 dark:text-gray-700">
                {isAdmin ? 'Yes' : 'No'}
              </Text>
            </div>
          </div>
        </div>

        {/* ---- Permissions Card (full width) ---- */}
        <div className="rounded-lg border border-muted bg-gray-0 p-5 @3xl:col-span-2 dark:bg-gray-50">
          <div className="mb-4 flex items-center gap-2">
            <PiKeyBold className="h-5 w-5 text-primary" />
            <Title as="h3" className="text-base font-semibold text-gray-900 dark:text-gray-700">
              Permissions
            </Title>
            <Badge variant="flat" color="primary" className="ms-2">
              {permissions.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {permissions.length > 0 ? (
              permissions.map((perm) => (
                <Badge
                  key={perm}
                  variant="outline"
                  color="secondary"
                  className="text-xs font-mono"
                >
                  {perm}
                </Badge>
              ))
            ) : (
              <Text className="text-sm text-gray-400">
                {isSuperAdmin
                  ? 'Super Admin — all permissions implicitly granted'
                  : t('common.noData')}
              </Text>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
