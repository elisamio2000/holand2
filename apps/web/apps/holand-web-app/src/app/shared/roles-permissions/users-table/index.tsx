'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Loader, Text, Title } from 'rizzui';
import {
  PiArrowCounterClockwiseBold,
  PiWarningOctagonBold,
  PiUsersThreeBold,
} from 'react-icons/pi';
import { useTanStackTable } from '@core/components/table/custom/use-TanStack-Table';
import { getUsersColumns, type UsersTableDataType } from './columns';
import Table from '@core/components/table';
import TableFooter from '@core/components/table/footer';
import TablePagination from '@core/components/table/pagination';
import Filters from './filters';
import { createUsersTableGlobalFilterFn } from './search';
import { adminService } from '@/services/admin.service';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { useDrawer } from '@/app/shared/drawer-views/use-drawer';
import EditUser from '@/app/shared/roles-permissions/edit-user';
import UserDetailDrawer from '@/app/shared/roles-permissions/user-detail-drawer';
import { getApiErrorMessage } from '@/utils/api-error-message';

/**
 * DEV NOTE: Users Table — Backend integration
 * ✅ GET /admin/users — List users
 * ✅ DELETE /admin/users/:id — Delete user (via Gateway to avoid CORS)
 * ✅ View user → UserDetailDrawer (sessions, roles, permissions, groups)
 * ✅ Edit user → EditUser modal (email, role, is_active)
 * ✅ Export selected users → CSV download (client-side)
 */

export default function UsersTable() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UsersTableDataType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const { openModal } = useModal();
  const { openDrawer } = useDrawer();

  /**
   * Export selected users as a CSV file and trigger browser download.
   *
   * @param users - Array of users to export
   */
  const exportUsersToCSV = useCallback((users: UsersTableDataType[]): void => {
    console.info('[UsersTable] Exporting users to CSV:', { count: users.length });
    const headers = [
      t('usersTable.csvExport.headers.userId'),
      t('usersTable.csvExport.headers.username'),
      t('usersTable.csvExport.headers.email'),
      t('usersTable.csvExport.headers.role'),
      t('usersTable.csvExport.headers.status'),
      t('usersTable.csvExport.headers.created'),
      t('usersTable.csvExport.headers.lastLogin'),
    ];
    const rows = users.map((u) => [
      u.id,
      u.username,
      u.email ?? '',
      u.role ?? '',
      u.is_active ? t('usersTable.status.active') : t('usersTable.status.inactive'),
      u.created_at ? new Date(u.created_at).toLocaleString() : '',
      u.last_login ? new Date(u.last_login).toLocaleString() : '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    console.info('[UsersTable] CSV download triggered:', { filename: link.download });
  }, [t]);

  const fetchUsers = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await adminService.getAdminUsers();
      setUsers(data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      const status = axiosErr?.response?.status;
      const message = getApiErrorMessage(err, t('usersTable.errors.failedToLoad'));
      console.error('[UsersTable] Failed to fetch users:', { status, message });
      setError({ message, status });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const { table, setData } = useTanStackTable<UsersTableDataType>({
    tableData: users,
    columnConfig: getUsersColumns(t),
    options: {
      globalFilterFn: createUsersTableGlobalFilterFn(t),
      autoResetPageIndex: true,
      initialState: {
        pagination: { pageIndex: 0, pageSize: 10 },
      },
      meta: {
        handleViewRow: (row: UsersTableDataType) => {
          openDrawer({
            view: (
              <UserDetailDrawer
                userId={row.id}
                onUpdated={fetchUsers}
              />
            ),
            placement: 'right',
            containerClassName: 'max-w-[480px]',
          });
        },
        handleEditRow: (row: UsersTableDataType) => {
          openModal({
            view: (
              <EditUser
                user={row}
                onUpdated={(updated) => {
                  setUsers((prev) =>
                    prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
                  );
                  void fetchUsers({ silent: true });
                }}
              />
            ),
            customSize: '550px',
          });
        },
        handleDeleteRow: async (row: UsersTableDataType) => {
          console.info('[UsersTable] Deleting user:', { id: row.id, username: row.username });
          try {
            await adminService.deleteAdminUser(row.id);
            // ⚠️ Known backend issue: Auth Service DELETE returns 500,
            // so user may still appear in list. Show appropriate message.
            toast.success(
              t('usersTable.delete.singleSuccess', { username: row.username }),
              { duration: 5000 }
            );
            table.resetRowSelection();
            await fetchUsers();
          } catch (err: any) {
            console.error('[UsersTable] Delete failed:', { id: row.id, error: err });
            toast.error(err?.response?.data?.detail || err?.message || t('usersTable.delete.singleError'));
          }
        },
        handleMultipleDelete: async (rows: UsersTableDataType[]) => {
          console.info('[UsersTable] Deleting multiple users:', { count: rows.length, ids: rows.map(r => r.id) });
          try {
            await Promise.all(
              rows.map((row) => adminService.deleteAdminUser(row.id))
            );
            toast.success(
              t('usersTable.delete.bulkSuccess', { count: rows.length }),
              { duration: 5000 }
            );
            table.resetRowSelection();
            await fetchUsers();
          } catch (err: any) {
            console.error('[UsersTable] Bulk delete failed:', { error: err });
            toast.error(err?.response?.data?.detail || err?.message || t('usersTable.delete.bulkError'));
          }
        },
      },
      enableColumnResizing: false,
    },
  });

  // Sync fetched data into table
  useEffect(() => {
    setData(users);
  }, [users, setData]);

  if (isLoading) {
    return (
      <div className="mt-14 flex min-h-[300px] items-center justify-center">
        <Loader variant="spinner" size="xl" />
      </div>
    );
  }

  // ── Error state — show banner with retry ──
  if (error) {
    const is403 = error.status === 403;
    return (
      <div className="mt-6 flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-red-300 bg-red-50 p-8 dark:border-red-800 dark:bg-red-950/30">
        <PiWarningOctagonBold className="mb-3 h-12 w-12 text-red-400" />
        <Title as="h3" className="mb-1 text-base font-semibold text-red-700 dark:text-red-400">
          {is403 ? t('usersTable.errorState.accessDeniedTitle') : t('usersTable.errorState.failedToLoadTitle')}
        </Title>
        <Text className="mb-4 max-w-md text-center text-sm text-red-600 dark:text-red-300">
          {is403
            ? t('usersTable.errorState.accessDeniedMessage')
            : error.message}
        </Text>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-red-300 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
          onClick={fetchUsers}
        >
          <PiArrowCounterClockwiseBold className="h-4 w-4" />
          {t('usersTable.errorState.retryButton')}
        </Button>
      </div>
    );
  }

  // ── Empty state — no users found ──
  if (users.length === 0) {
    return (
      <div className="mt-6 flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-muted p-8">
        <Empty
          image={<PiUsersThreeBold className="h-16 w-16 text-gray-300" />}
          text={t('usersTable.emptyState.message')}
          textClassName="text-sm text-gray-500 mt-3"
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-1.5"
          onClick={fetchUsers}
        >
          <PiArrowCounterClockwiseBold className="h-4 w-4" />
          {t('usersTable.emptyState.refreshButton')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-14">
      <Filters table={table} onRefresh={fetchUsers} />
      <Table
        table={table}
        variant="modern"
        classNames={{
          container: 'border border-muted rounded-md',
          rowClassName: 'last:border-0',
        }}
      />
      <TableFooter
        table={table}
        onExport={() => {
          const selectedUsers = table.getSelectedRowModel().rows.map((r: any) => r.original);
          exportUsersToCSV(selectedUsers);
          toast.success(t('usersTable.export.success', { count: selectedUsers.length }));
        }}
      />
      <TablePagination
        table={table}
        className="py-4"
        labels={{
          rowsPerPage: t('common.pagination.rowsPerPage'),
          pageOf: (page, total) => t('common.pagination.pageOf', { page, total }),
          goToFirstPage: t('ariaLabels.goToFirstPage'),
          goToPreviousPage: t('ariaLabels.goToPreviousPage'),
          goToNextPage: t('ariaLabels.goToNextPage'),
          goToLastPage: t('ariaLabels.goToLastPage'),
        }}
      />
    </div>
  );
}
