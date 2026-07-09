'use client';

import { useState } from 'react';
import {
  PiDotsThreeBold,
  PiShieldCheck,
  PiTrash,
  PiUserBold,
  PiListBold,
  PiGridFourBold,
  PiXBold,
} from 'react-icons/pi';
import { IconTooltip } from '@/components/tooltip';
import { Title, ActionIcon, Dropdown, Badge, Text, Modal } from 'rizzui';
import cn from '@core/utils/class-names';
import UserCog from '@core/components/icons/user-cog';
import ModalButton from '@/app/shared/modal-button';
import EditRole from '@/app/shared/roles-permissions/edit-role';
import {
  matrixPermissionLabelI18n,
  roleDisplayNameKey,
} from '@/app/shared/roles-permissions/utils';
import { adminService } from '@/services/admin.service';
import type { RoleResponse, UserInfo } from '@/types/auth.types';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/user-avatar';

/**
 * RoleCard — Displays a single role with permissions, user avatars, and actions.
 *
 * Features:
 * 1. Role name, description, color badge
 * 2. Permissions preview (first 5 + count)
 * 3. Inline user avatars (up to 5) with "+N" overflow
 * 4. Click avatars to open full user list modal (table + card views)
 * 5. Edit/Delete actions (system roles are protected)
 *
 * @requires adminService — for delete/update operations
 * @requires EditRole — modal for editing permissions
 */

/** Maximum number of inline avatars before showing "+N" */
const MAX_INLINE_AVATARS = 5;

interface RoleCardProps {
  role: RoleResponse;
  color?: string;
  className?: string;
  onDeleted?: () => void;
  usersWithRole?: UserInfo[];
}

export default function RoleCard({ role, color, className, onDeleted, usersWithRole = [] }: RoleCardProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [usersViewMode, setUsersViewMode] = useState<'table' | 'card'>('card');

  const userCount = role.user_count ?? usersWithRole.length;
  const visibleUsers = usersWithRole.slice(0, MAX_INLINE_AVATARS);
  const overflowCount = userCount - MAX_INLINE_AVATARS;
  const roleLabelKey = roleDisplayNameKey(role.name);
  const roleLabel = t(roleLabelKey, { defaultValue: role.name });
  const roleDescription = t(`rolesGrid.roleDescriptions.${role.name}`, {
    defaultValue: role.description || '',
  });

  /**
   * Delete handler — confirms then calls adminService.deleteRole.
   * System roles are protected and cannot be deleted.
   */
  const handleDelete = async () => {
    if (role.is_system) {
      toast.error(t('roleCard.deleteSystemRole'));
      return;
    }
    const confirmed = window.confirm(
      t('roleCard.deleteConfirm', { name: role.name })
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await adminService.deleteRole(role.name);
      toast.success(t('roleCard.deleteSuccess', { name: role.name }));
      onDeleted?.();
    } catch (err: unknown) {
      console.error('[RoleCard] Delete failed:', { roleName: role.name, err });
      const message = err instanceof Error ? err.message : t('roleCard.deleteError');
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className={cn('rounded-lg border border-muted p-6', isDeleting && 'opacity-50', className)}>
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-content-center rounded-lg text-white"
              style={{ backgroundColor: color || '#2465FF' }}
            >
              <PiShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <Title as="h4" className="font-medium">
                {roleLabel}
              </Title>
              {roleDescription && (
                <Text className="text-xs text-gray-500 line-clamp-1">
                  {roleDescription}
                </Text>
              )}
            </div>
          </div>
          <Dropdown className={className} placement="bottom-end">
            <Dropdown.Trigger>
              <IconTooltip content={t('roleCard.menuTooltip')} preset="toolbar">
                <ActionIcon as="span" variant="text" className="ms-auto h-auto w-auto p-1">
                  <PiDotsThreeBold className="h-auto w-6" />
                </ActionIcon>
              </IconTooltip>
            </Dropdown.Trigger>
            <Dropdown.Menu className="!z-0">
              {/* View all users option */}
              {usersWithRole.length > 0 && (
                <Dropdown.Item className="gap-2 text-xs sm:text-sm">
                  <span
                    className="flex items-center gap-2"
                    onClick={() => setShowUsersModal(true)}
                  >
                    <PiUserBold className="h-4 w-4" /> {t('roleCard.viewAllUsers')}
                  </span>
                </Dropdown.Item>
              )}
              {!role.is_system && (
                <Dropdown.Item className="gap-2 text-xs text-red-500 sm:text-sm">
                  <span className="flex items-center gap-2" onClick={handleDelete}>
                    <PiTrash className="h-4 w-4" /> {t('roleCard.deleteRole')}
                  </span>
                </Dropdown.Item>
              )}
              {role.is_system && (
                <Dropdown.Item className="gap-2 text-xs text-gray-400 sm:text-sm" disabled>
                  {t('roleCard.systemRoleCannotModify')}
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>
        </header>

        {/* Permissions badges — guard with Array.isArray because backend may return non-array */}
        <div className="mt-4">
          {Array.isArray(role.permissions) && role.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {role.permissions.slice(0, 5).map((perm) => (
                <Badge
                  key={perm}
                  variant="outline"
                  size="sm"
                  className="border-muted text-xs font-normal text-gray-500"
                  title={perm}
                >
                  {matrixPermissionLabelI18n(perm, null, t)}
                </Badge>
              ))}
              {role.permissions.length > 5 && (
                <Badge variant="flat" size="sm" color="primary" className="text-xs">
                  {t('roleCard.morePermissions', { count: role.permissions.length - 5 })}
                </Badge>
              )}
            </div>
          ) : (
            <Text className="text-xs text-gray-400">{t('roleCard.noPermissions')}</Text>
          )}
        </div>

        {/* System role badge */}
        {role.is_system && (
          <Badge variant="flat" color="warning" className="mt-3 text-xs">
            {t('roleCard.systemRole')}
          </Badge>
        )}

        {/* Users with this role — inline avatars */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => usersWithRole.length > 0 && setShowUsersModal(true)}
            className={cn(
              'flex w-full items-center gap-3 rounded-md border border-muted px-3 py-2.5 text-start transition-colors',
              usersWithRole.length > 0
                ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-100'
                : 'cursor-default'
            )}
          >
            {/* Stacked avatars */}
            {visibleUsers.length > 0 ? (
              <div className="flex items-center -space-x-2">
                {visibleUsers.map((u) => (
                  <UserAvatar
                    key={u.id}
                    avatarUrl={u.avatar_url}
                    fallbackSeed={u.id || u.username}
                    name={u.username}
                    className="ring-2 ring-gray-0 dark:ring-gray-50"
                    avatarProps={{ size: 'sm', customSize: '28px' }}
                  />
                ))}
                {overflowCount > 0 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600 ring-2 ring-gray-0 dark:bg-gray-300 dark:text-gray-700 dark:ring-gray-50">
                    +{overflowCount}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-200">
                <PiUserBold className="h-3.5 w-3.5 text-gray-400" />
              </div>
            )}

            <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('roleCard.totalUsers', { count: userCount })}
            </Text>
          </button>
        </div>

        <ModalButton
          customSize="700px"
          variant="outline"
          label={t('roleCard.editRole')}
          icon={<UserCog className="h-5 w-5" />}
          view={<EditRole role={role} onSaved={onDeleted} />}
          className="mt-4 items-center gap-1 text-gray-800 @lg:w-full"
        />
      </div>

      {/* ── Users List Modal ── */}
      <Modal
        isOpen={showUsersModal}
        onClose={() => setShowUsersModal(false)}
        size="lg"
        className="m-0 p-0"
      >
        <div className="p-6">
          {/* Modal header */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <Title as="h4" className="font-semibold">
                {t('roleCard.usersModalTitle', { name: role.name })}
              </Title>
              <Text className="mt-0.5 text-sm text-gray-500">
                {t('roleCard.usersAssigned', { count: usersWithRole.length })}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-md border border-muted">
                <IconTooltip content={t('roleCard.cardView')} preset="toolbar">
                  <button
                    type="button"
                    onClick={() => setUsersViewMode('card')}
                    className={cn(
                      'rounded-s-md p-1.5 transition-colors',
                      usersViewMode === 'card'
                        ? 'bg-primary text-white'
                        : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-100'
                    )}
                  >
                    <PiGridFourBold className="h-4 w-4" />
                  </button>
                </IconTooltip>
                <IconTooltip content={t('roleCard.tableView')} preset="toolbar">
                  <button
                    type="button"
                    onClick={() => setUsersViewMode('table')}
                    className={cn(
                      'rounded-e-md p-1.5 transition-colors',
                      usersViewMode === 'table'
                        ? 'bg-primary text-white'
                        : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-100'
                    )}
                  >
                    <PiListBold className="h-4 w-4" />
                  </button>
                </IconTooltip>
              </div>
              <IconTooltip content={t('roleCard.closeModal')} preset="toolbar">
                <ActionIcon
                  variant="text"
                  onClick={() => setShowUsersModal(false)}
                >
                  <PiXBold className="h-5 w-5" />
                </ActionIcon>
              </IconTooltip>
            </div>
          </div>

          {/* Card view */}
          {usersViewMode === 'card' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {usersWithRole.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg border border-muted p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-100"
                >
                  <UserAvatar
                    avatarUrl={u.avatar_url}
                    fallbackSeed={u.id || u.username}
                    name={u.username}
                    avatarProps={{ size: 'lg', customSize: '40px' }}
                  />
                  <div className="min-w-0 flex-1">
                    <Text className="text-sm font-medium truncate">{u.username}</Text>
                    {u.email && (
                      <Text className="text-xs text-gray-500 truncate">{u.email}</Text>
                    )}
                  </div>
                  <Badge
                    renderAsDot
                    color={u.is_active ? 'success' : 'danger'}
                    className="shrink-0"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Table view */}
          {usersViewMode === 'table' && (
            <div className="overflow-auto rounded-lg border border-muted">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted bg-gray-50 dark:bg-gray-100">
                    <th className="px-4 py-2.5 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">{t('roleCard.userHeader')}</th>
                    <th className="px-4 py-2.5 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">{t('roleCard.emailHeader')}</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">{t('roleCard.statusHeader')}</th>
                  </tr>
                </thead>
                <tbody>
                  {usersWithRole.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-muted last:border-b-0 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-100/50"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            avatarUrl={u.avatar_url}
                            fallbackSeed={u.id || u.username}
                            name={u.username}
                            avatarProps={{ size: 'sm', customSize: '28px' }}
                          />
                          <Text className="text-sm font-medium">{u.username}</Text>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Text className="text-xs text-gray-500">{u.email || '—'}</Text>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge
                          variant="flat"
                          size="sm"
                          color={u.is_active ? 'success' : 'danger'}
                          className="text-[10px]"
                        >
                          {u.is_active ? t('common.active') : t('common.inactive')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {usersWithRole.length === 0 && (
            <div className="flex min-h-[120px] items-center justify-center">
              <Text className="text-sm text-gray-400">{t('roleCard.noUsers')}</Text>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
