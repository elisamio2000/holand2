'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Title, Collapse } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiCaretDownBold, PiStarFill } from 'react-icons/pi';
import { menuItems } from '@/layouts/hydrogen/menu-items';
import StatusBadge from '@core/components/get-status-badge';
import { usePermissions } from '@/hooks/use-permissions';
import { useAdminRoutePrefetch } from '@/hooks/use-admin-route-prefetch';
import { useWorkspaceNavigation } from '@/hooks/use-workspace-navigation';
import { useWorkspace } from '@/contexts/workspace-context';
import { useSession } from 'next-auth/react';

export function SidebarMenu() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { canAccessSection, isLoading: isPermissionsLoading } = usePermissions();
  const prefetchAdminRoute = useAdminRoutePrefetch();
  const { activeWorkspace } = useWorkspace();
  const { data: session } = useSession();

  const workspaceModules = resolveWorkspaceModules(activeWorkspace?.id, session);

  const rbacFiltered = menuItems.filter((item) => {
    if (!item.section) return true;
    if (isPermissionsLoading) return true;
    return canAccessSection(item.section);
  });

  const { resolvedMenuItems, pinnedLinks } = useWorkspaceNavigation(
    rbacFiltered,
    workspaceModules
  );

  const visibleItems = resolvedMenuItems;

  return (
    <div className="mt-4 pb-3 3xl:mt-6">
      {pinnedLinks.length > 0 && (
        <div className="mb-3 px-3 2xl:px-5">
          <Title
            as="h6"
            className="mb-2 truncate px-3 text-[10px] font-semibold uppercase tracking-widest text-primary"
          >
            {t('workspace.nav.favorites')}
          </Title>
          {pinnedLinks.map((item) => (
            <Link
              key={`pin-${item.name}`}
              href={item.href!}
              className={cn(
                'mx-0 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100',
                pathname === item.href && 'text-primary'
              )}
            >
              <PiStarFill className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="truncate">{t(item.name)}</span>
            </Link>
          ))}
        </div>
      )}

      {visibleItems.map((item, index) => {
        const isActive =
          pathname === (item?.href as string) ||
          pathname.startsWith((item?.href as string) + '/');
        const pathnameExistInDropdowns: any = item?.dropdownItems?.filter(
          (dropdownItem) => dropdownItem.href === pathname
        );
        const isDropdownOpen = Boolean(pathnameExistInDropdowns?.length);

        return (
          <Fragment key={item.name + '-' + index}>
            {item?.href ? (
              <>
                {item?.dropdownItems ? (
                  <Collapse
                    defaultOpen={isDropdownOpen}
                    header={({ open, toggle }) => (
                      <div
                        onClick={toggle}
                        className={cn(
                          'group relative mx-3 flex cursor-pointer items-center justify-between rounded-md px-3 py-2 font-medium lg:my-1 2xl:mx-5 2xl:my-2',
                          isDropdownOpen
                            ? 'before:top-2/5 text-primary before:absolute before:-start-3 before:block before:h-4/5 before:w-1 before:rounded-ee-md before:rounded-se-md before:bg-primary 2xl:before:-start-5'
                            : 'text-gray-700 transition-colors duration-200 hover:bg-gray-100 dark:text-gray-700/90 dark:hover:text-gray-700'
                        )}
                      >
                        <span className="flex items-center">
                          {item?.icon && (
                            <span
                              className={cn(
                                'me-2 inline-flex h-5 w-5 items-center justify-center rounded-md [&>svg]:h-[20px] [&>svg]:w-[20px]',
                                isDropdownOpen
                                  ? 'text-primary'
                                  : 'text-gray-800 dark:text-gray-500 dark:group-hover:text-gray-700'
                              )}
                            >
                              {item?.icon}
                            </span>
                          )}
                          {t(item.name)}
                        </span>

                        <span className="flex items-center gap-2">
                          {(item?.badge as unknown as string)?.length ? (
                            <StatusBadge status={item?.badge as unknown as string} />
                          ) : null}
                          <PiCaretDownBold
                            strokeWidth={3}
                            className={cn(
                              'h-3.5 w-3.5 -rotate-90 text-gray-500 transition-transform duration-200 rtl:rotate-90',
                              open && 'rotate-0 rtl:rotate-0'
                            )}
                          />
                        </span>
                      </div>
                    )}
                  >
                    {item?.dropdownItems?.map((dropdownItem, dropdownIndex) => {
                      const isChildActive =
                        pathname === (dropdownItem?.href as string);

                      return (
                        <Link
                          href={dropdownItem?.href}
                          key={dropdownItem?.name + dropdownIndex}
                          className={cn(
                            'mx-3.5 mb-0.5 flex items-center justify-between rounded-md px-3.5 py-2 font-medium capitalize last-of-type:mb-1 lg:last-of-type:mb-2 2xl:mx-5',
                            isChildActive
                              ? 'text-primary'
                              : 'text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900'
                          )}
                        >
                          <div className="flex items-center truncate">
                            <span
                              className={cn(
                                'me-[18px] ms-1 inline-flex h-1 w-1 rounded-full bg-current transition-all duration-200',
                                isChildActive
                                  ? 'bg-primary ring-[1px] ring-primary'
                                  : 'opacity-40'
                              )}
                            />{' '}
                            <span className="truncate">
                              {t(dropdownItem?.name)}
                            </span>
                          </div>
                          {dropdownItem?.badge?.length ? (
                            <StatusBadge status={dropdownItem?.badge} />
                          ) : null}
                        </Link>
                      );
                    })}
                  </Collapse>
                ) : (
                  <Link
                    href={item?.href}
                    onMouseEnter={() => prefetchAdminRoute(item.href as string)}
                    className={cn(
                      'group relative mx-3 my-0.5 flex items-center justify-between rounded-md px-3 py-2 font-medium capitalize lg:my-1 2xl:mx-5 2xl:my-2',
                      isActive
                        ? 'before:top-2/5 text-primary before:absolute before:-start-3 before:block before:h-4/5 before:w-1 before:rounded-ee-md before:rounded-se-md before:bg-primary 2xl:before:-start-5'
                        : 'text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-700/90'
                    )}
                  >
                    <div className="flex items-center truncate">
                      {item?.icon && (
                        <span
                          className={cn(
                            'me-2 inline-flex size-5 items-center justify-center rounded-md [&>svg]:size-5',
                            isActive
                              ? 'text-primary'
                              : 'text-gray-800 dark:text-gray-500 dark:group-hover:text-gray-700'
                          )}
                        >
                          {item?.icon}
                        </span>
                      )}
                      <span className="truncate">{t(item.name)}</span>
                    </div>
                    {item?.badge?.length ? (
                      <StatusBadge status={item?.badge} />
                    ) : null}
                  </Link>
                )}
              </>
            ) : (
              <Title
                as="h6"
                className={cn(
                  'mb-2 truncate px-6 text-xs font-normal uppercase tracking-widest text-gray-500 2xl:px-8',
                  index !== 0 && 'mt-6 3xl:mt-7'
                )}
              >
                {t(item.name)}
              </Title>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function resolveWorkspaceModules(
  workspaceId: string | undefined,
  session: ReturnType<typeof useSession>['data']
): string[] | null {
  if (!workspaceId || !session?.user) return null;
  const groups = (session.user as Record<string, unknown>).groups as
    | Record<string, { modules?: string[] }>
    | undefined;
  return groups?.[workspaceId]?.modules ?? null;
}
