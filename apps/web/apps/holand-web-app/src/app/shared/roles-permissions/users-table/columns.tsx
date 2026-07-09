'use client';

import { IconTooltip } from '@/components/tooltip';
import { roleDisplayNameKey } from '@/app/shared/roles-permissions/utils';
import type { TFunction } from 'i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { ActionIcon, Badge, Flex, Text } from 'rizzui';
import IndeterminateCheckbox from '@core/components/table/indeterminate-checkbox';
import type { UserInfo } from '@/types/auth.types';
import DateCell from '@core/ui/date-cell';
import { PiEyeBold, PiPencilSimpleBold, PiTrashBold } from 'react-icons/pi';
import DeletePopover from '@core/components/delete-popover';
import AvatarCard from '@core/ui/avatar-card';

export type UsersTableDataType = UserInfo;

/**
 * DEV NOTE: Column mapping to backend UserInfo
 * ✅ id, username, email, role, is_active, created_at, last_login
 * ✅ View → opens UserDetailDrawer (via meta.handleViewRow)
 * ✅ Edit → opens EditUser modal (via meta.handleEditRow)
 * ✅ Delete → calls meta.handleDeleteRow
 */

const columnHelper = createColumnHelper<UsersTableDataType>();

/**
 * Generate users table columns with i18n support.
 *
 * @param t - Translation function from useTranslation hook
 * @returns Array of column definitions
 */
export const getUsersColumns = (t: TFunction) => [
  columnHelper.display({
    id: 'select',
    size: 50,
    header: ({ table }) => (
      <IndeterminateCheckbox
        className="ps-3.5"
        aria-label={t('usersTable.ariaLabels.selectAllRows')}
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onChange={() => table.toggleAllPageRowsSelected()}
      />
    ),
    cell: ({ row }) => (
      <IndeterminateCheckbox
        className="ps-3.5"
        aria-label={t('usersTable.ariaLabels.selectRow')}
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  }),

  columnHelper.display({
    id: 'id',
    size: 120,
    header: t('usersTable.columns.userId'),
    cell: ({ row }) => (
      <Text className="text-xs text-gray-500 font-mono">
        {row.original.id.slice(0, 8)}...
      </Text>
    ),
  }),

  columnHelper.accessor('username', {
    id: 'username',
    size: 250,
    header: t('usersTable.columns.user'),
    enableSorting: true,
    cell: ({ row }) => (
      <AvatarCard
        src=""
        name={row.original.username}
        description={row.original.email || t('usersTable.placeholders.noEmail')}
      />
    ),
  }),

  columnHelper.accessor('role', {
    id: 'role',
    size: 150,
    header: t('usersTable.columns.role'),
    cell: ({ row }) => (
      <Badge
        variant="flat"
        color={getRoleBadgeColor(row.original.role)}
        className="capitalize"
      >
        {t(roleDisplayNameKey(row.original.role), { defaultValue: row.original.role })}
      </Badge>
    ),
  }),

  columnHelper.accessor('created_at', {
    id: 'created_at',
    size: 180,
    header: t('usersTable.columns.created'),
    cell: ({ row }) =>
      row.original.created_at ? (
        <DateCell date={new Date(row.original.created_at)} />
      ) : (
        // Backend UserResponse schema doesn't include created_at
        <Text className="text-sm text-gray-400">{t('usersTable.placeholders.notProvided')}</Text>
      ),
  }),

  columnHelper.display({
    id: 'last_login',
    size: 180,
    header: t('usersTable.columns.lastLogin'),
    cell: ({ row }) =>
      row.original.last_login ? (
        <DateCell date={new Date(row.original.last_login)} />
      ) : (
        // Backend UserResponse schema doesn't include last_login
        <Text className="text-sm text-gray-400">{t('usersTable.placeholders.notProvided')}</Text>
      ),
  }),

  columnHelper.accessor('is_active', {
    id: 'status',
    size: 120,
    header: t('usersTable.columns.status'),
    enableSorting: false,
    filterFn: (row, _columnId, filterValue: string[]) => {
      if (!filterValue || filterValue.length === 0) return true;
      const activeLabel = t('usersTable.filters.statusActive');
      const inactiveLabel = t('usersTable.filters.statusInactive');
      const pendingLabel = t('usersTable.filters.statusPendingApproval');

      const matchesPending =
        filterValue.includes(pendingLabel) && row.original.role === 'pending';
      const matchesActive =
        filterValue.includes(activeLabel) && row.original.is_active === true;
      const matchesInactive =
        filterValue.includes(inactiveLabel) &&
        row.original.is_active === false &&
        row.original.role !== 'pending';

      return matchesPending || matchesActive || matchesInactive;
    },
    cell: ({ row }) => {
      const pendingLabel = t('usersTable.filters.statusPendingApproval');
      if (row.original.role === 'pending') {
        return (
          <Flex align="center" gap="2">
            <Badge renderAsDot className="bg-orange-dark" />
            <Text className="font-medium text-orange-dark">{pendingLabel}</Text>
          </Flex>
        );
      }
      return (
        <Flex align="center" gap="2">
          <Badge
            renderAsDot
            color={row.original.is_active ? 'success' : 'danger'}
          />
          <Text className="font-medium">
            {row.original.is_active
              ? t('usersTable.filters.statusActive')
              : t('usersTable.filters.statusInactive')}
          </Text>
        </Flex>
      );
    },
  }),

  columnHelper.display({
    id: 'action',
    size: 160,
    cell: ({
      row,
      table: {
        options: { meta },
      },
    }) => (
      <Flex align="center" justify="end" gap="3" className="pe-3">
        <IconTooltip content={t('usersTable.tooltips.editUser')} preset="toolbar">
          <ActionIcon
            as="span"
            size="sm"
            variant="outline"
            aria-label={t('usersTable.ariaLabels.editUser')}
            onClick={() => meta?.handleEditRow?.(row.original)}
            className="cursor-pointer"
          >
            <PiPencilSimpleBold className="h-4 w-4" />
          </ActionIcon>
        </IconTooltip>
        <IconTooltip content={t('usersTable.tooltips.viewDetails')} preset="toolbar">
          <ActionIcon
            as="span"
            size="sm"
            variant="outline"
            aria-label={t('usersTable.ariaLabels.viewUser')}
            onClick={() => meta?.handleViewRow?.(row.original)}
            className="cursor-pointer"
          >
            <PiEyeBold className="h-4 w-4" />
          </ActionIcon>
        </IconTooltip>
        <DeletePopover
          title={t('usersTable.deletePopover.title')}
          description={t('usersTable.deletePopover.description', { username: row.original.username })}
          ariaLabel={t('usersTable.deletePopover.title')}
          onDelete={() => meta?.handleDeleteRow?.(row.original)}
        />
      </Flex>
    ),
  }),
];

function getRoleBadgeColor(role: string): 'primary' | 'danger' | 'warning' | 'success' | 'secondary' | 'info' {
  switch (role) {
    case 'super-admin':
      return 'danger';
    case 'admin':
      return 'primary';
    case 'analyst':
      return 'warning';
    case 'user':
      return 'success';
    case 'pending':
      return 'warning';
    case 'chat-only':
      return 'info';
    default:
      return 'secondary';
  }
}
