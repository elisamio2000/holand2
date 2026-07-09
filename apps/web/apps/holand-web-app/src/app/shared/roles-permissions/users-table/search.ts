import type { TFunction } from 'i18next';
import type { FilterFn } from '@tanstack/react-table';
import type { UsersTableDataType } from './columns';

/**
 * Build a case-insensitive searchable string from all user fields shown in the table.
 *
 * @param user - Row data from the users table
 * @param t - i18n function for localized status labels
 * @returns Lowercased concatenation of searchable values
 */
function buildUserSearchHaystack(
  user: UsersTableDataType,
  t: TFunction
): string {
  const statusLabel = user.is_active
    ? t('usersTable.status.active')
    : t('usersTable.status.inactive');

  return [
    user.id,
    user.username,
    user.email,
    user.role,
    user.display_name,
    statusLabel,
    user.created_at,
    user.last_login,
  ]
    .filter((value) => value != null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();
}

/**
 * TanStack global filter for the users table — matches id, username, email, role, and status in real time.
 *
 * @param t - i18n function from useTranslation
 * @returns Global filter function for useReactTable
 */
export function createUsersTableGlobalFilterFn(
  t: TFunction
): FilterFn<UsersTableDataType> {
  return (row, _columnId, filterValue) => {
    const needle = String(filterValue ?? '').trim().toLowerCase();
    if (!needle) return true;

    const haystack = buildUserSearchHaystack(row.original, t);
    return haystack.includes(needle);
  };
}
