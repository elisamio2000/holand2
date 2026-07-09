'use client';

import { IconTooltip } from '@/components/tooltip';
import { Badge, Box, Button, Flex, Input, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import StatusField from '@core/components/controlled-table/status-field';
import { roleDisplayNameKey } from '@/app/shared/roles-permissions/utils';
import { type Table as ReactTableType } from '@tanstack/react-table';
import {
  PiMagnifyingGlassBold,
  PiTrashDuotone,
  PiArrowsClockwise,
} from 'react-icons/pi';
// ModalButton/CreateUser removed — Add User button is now in roles-permissions-view.tsx

/**
 * DEV NOTE: Filters — uses TanStack column filters
 * ✅ Status filter: Active / Inactive (mapped from is_active boolean)
 * ✅ Role filter: Populated from table data (not from static constants)
 * ✅ Search: Real-time TanStack globalFilter across id, username, email, role, status
 * ✅ Refresh button to re-fetch from backend
 */

interface TableToolbarProps<T extends Record<string, any>> {
  table: ReactTableType<T>;
  onRefresh?: () => void;
}

export default function Filters<TData extends Record<string, any>>({
  table,
  onRefresh,
}: TableToolbarProps<TData>) {
  const { t } = useTranslation();
  
  const statusOptions = [
    { value: t('usersTable.filters.statusActive'), label: t('usersTable.filters.statusActive') },
    { value: t('usersTable.filters.statusInactive'), label: t('usersTable.filters.statusInactive') },
    { value: t('usersTable.filters.statusPendingApproval'), label: t('usersTable.filters.statusPendingApproval') },
  ];

  const isFiltered =
    table.getState().globalFilter || table.getState().columnFilters.length > 0;

  // Extract unique roles from table data for filter
  const roleOptions = Array.from(
    new Set(
      table
        .getPreFilteredRowModel()
        .rows.map((row) => (row.original as any).role)
        .filter(Boolean)
    )
  ).map((role) => ({
    label: t(roleDisplayNameKey(role as string), { defaultValue: role as string }),
    value: role as string,
  }));

  return (
    <Box className="mb-4 @container">
      <Flex
        gap="3"
        align="center"
        justify="between"
        className="w-full flex-wrap @4xl:flex-nowrap"
      >
        <Title
          as="h3"
          className="rizzui-title-h3 order-1 whitespace-nowrap pe-4 text-base font-semibold sm:text-lg"
        >
          {t('usersTable.filters.title')}
        </Title>
        <Flex
          align="center"
          direction="col"
          gap="2"
          className="order-4 @lg:grid @lg:grid-cols-2 @4xl:order-2 @4xl:flex @4xl:flex-row"
        >
          <StatusField
            placeholder={t('usersTable.filters.statusPlaceholder')}
            options={statusOptions}
            value={table.getColumn('status')?.getFilterValue() ?? []}
            onChange={(values) => {
              table.getColumn('status')?.setFilterValue(values);
              const pendingLabel = t('usersTable.filters.statusPendingApproval');
              const selected = Array.isArray(values) ? values : values ? [values] : [];
              if (selected.includes(pendingLabel)) {
                table.getColumn('role')?.setFilterValue(['pending']);
              } else {
                const roleFilter = table.getColumn('role')?.getFilterValue();
                if (
                  Array.isArray(roleFilter) &&
                  roleFilter.length === 1 &&
                  roleFilter[0] === 'pending'
                ) {
                  table.getColumn('role')?.setFilterValue([]);
                }
              }
            }}
            getOptionValue={(option: any) => option.label}
            dropdownClassName="!z-10 h-auto"
            className="@4xl:w-40"
            getOptionDisplayValue={(option: any) =>
              renderStatusDisplay(option.value as string, t)
            }
            displayValue={(selected: string) =>
              renderStatusDisplay(selected, t)
            }
          />
          <StatusField
            placeholder={t('usersTable.filters.rolePlaceholder')}
            options={roleOptions}
            value={table.getColumn('role')?.getFilterValue() ?? []}
            onChange={(e) => table.getColumn('role')?.setFilterValue(e)}
            getOptionValue={(option: any) => option.label}
            dropdownClassName="!z-10"
            className="@4xl:w-40"
          />
          {isFiltered && (
            <Button
              size="sm"
              onClick={() => {
                table.resetGlobalFilter();
                table.resetColumnFilters();
              }}
              variant="flat"
              className="h-9 w-full bg-gray-200/70 @lg:col-span-full @4xl:w-auto"
            >
              <PiTrashDuotone className="me-1.5 size-[17px]" /> {t('usersTable.filters.clearButton')}
            </Button>
          )}
        </Flex>
        <Flex gap="2" className="order-3 @2xl:order-2 @2xl:ms-auto @4xl:order-3">
          <Input
            type="search"
            name="users-table-filter-search"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore
            clearable={true}
            placeholder={t('usersTable.filters.searchPlaceholder')}
            value={table.getState().globalFilter ?? ''}
            onClear={() => table.setGlobalFilter('')}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            prefix={<PiMagnifyingGlassBold className="size-4" />}
            className="h-9 w-full @2xl:h-auto @2xl:max-w-60"
          />
          {onRefresh && (
            <IconTooltip content={t('usersTable.filters.refreshTooltip')} preset="toolbar">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="h-9 shrink-0"
                aria-label={t('usersTable.filters.refreshTooltip')}
              >
                <PiArrowsClockwise className="size-4" />
              </Button>
            </IconTooltip>
          )}
        </Flex>
        {/* Add User button is rendered at the tab level in roles-permissions-view.tsx */}
      </Flex>
    </Box>
  );
}

function renderStatusDisplay(value: string, t: any) {
  const activeLabel = t('usersTable.filters.statusActive');
  const inactiveLabel = t('usersTable.filters.statusInactive');

  switch (value) {
    case activeLabel:
      return (
        <div className="flex items-center">
          <Badge color="success" renderAsDot />
          <Text className="ms-2 font-medium capitalize text-green-dark">
            {value}
          </Text>
        </div>
      );
    case inactiveLabel:
      return (
        <div className="flex items-center">
          <Badge color="danger" renderAsDot />
          <Text className="ms-2 font-medium capitalize text-red-dark">
            {value}
          </Text>
        </div>
      );
    default:
      return (
        <div className="flex items-center">
          <Badge renderAsDot className="bg-orange-dark" />
          <Text className="ms-2 font-medium capitalize text-orange-dark">
            {value}
          </Text>
        </div>
      );
  }
}
