'use client';

import { cloneElement, isValidElement, useMemo, useState, type ReactElement, type RefObject } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
import { Popover, Title, Badge, Checkbox, Text } from 'rizzui';
import Link from 'next/link';
import { useMedia } from '@core/hooks/use-media';
import SimpleBar from '@core/ui/simplebar';
import { PiCheck } from 'react-icons/pi';
import { notificationsData } from '@/data/notifications';
import { HeaderPopoverWithTooltip } from '@/layouts/header-action-tooltip';

dayjs.extend(relativeTime);

function NotificationsList({
  setIsOpen,
}: {
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { t } = useTranslation();

  return (
    <div className="w-[320px] text-left sm:w-[360px] 2xl:w-[420px] rtl:text-right">
      <div className="mb-1 ps-6">
        <Title as="h5" fontWeight="semibold">
          {t('headerNotifications.title')}
        </Title>
        <Text className="text-xs text-gray-500">{t('headerNotifications.subtitle')}</Text>
      </div>
      <div className="mb-3 flex items-center justify-between ps-6">
        <Checkbox
          size="sm"
          label={t('headerNotifications.markAllRead')}
          labelWeight="normal"
          labelClassName="text-sm"
        />
      </div>
      <SimpleBar className="max-h-[420px]">
        <div className="grid cursor-pointer grid-cols-1 gap-1 ps-4">
          {notificationsData.map((item) => (
            <div
              key={item.name + item.id}
              className="group grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md px-2 py-2 pe-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded bg-gray-100/70 p-1 dark:bg-gray-50/50 [&>svg]:h-auto [&>svg]:w-5">
                <item.icon />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
                <div className="w-full">
                  <Text className="mb-0.5 w-11/12 truncate text-sm font-semibold text-gray-900 dark:text-gray-700">
                    {item.name}
                  </Text>
                  <Text className="ms-auto whitespace-nowrap pe-8 text-xs text-gray-500">
                    {dayjs(item.sendTime).fromNow(true)}
                  </Text>
                </div>
                <div className="ms-auto flex-shrink-0">
                  {item.unRead ? (
                    <Badge renderAsDot size="lg" color="warning" className="scale-90" />
                  ) : (
                    <span className="inline-block rounded-full bg-gray-100 p-0.5 dark:bg-gray-50">
                      <PiCheck className="h-auto w-[9px]" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SimpleBar>
      <Link
        href="#"
        onClick={() => setIsOpen(false)}
        className="-me-6 block px-6 pb-0.5 pt-3 text-center text-sm hover:underline"
      >
        {t('headerNotifications.viewAll')}
      </Link>
    </div>
  );
}

export default function NotificationDropdown({
  children,
  tooltipLabel,
}: {
  children: JSX.Element & { ref?: RefObject<any> };
  tooltipLabel: string;
}) {
  const isMobile = useMedia('(max-width: 480px)', false);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = useMemo(
    () => notificationsData.filter((item) => item.unRead).length,
    []
  );

  const trigger = useMemo(() => {
    if (!isValidElement(children)) return children;
    if (unreadCount <= 0) return children;
    return cloneElement(children as ReactElement, {
      children: (
        <>
          {(children as ReactElement).props.children}
          <Badge
            renderAsDot
            color="warning"
            enableOutlineRing
            className="absolute end-2 top-2 -translate-y-1/3 translate-x-1/2"
          />
        </>
      ),
    });
  }, [children, unreadCount]);

  return (
    <HeaderPopoverWithTooltip label={tooltipLabel}>
      <Popover
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        shadow="sm"
        placement={isMobile ? 'bottom' : 'bottom-end'}
      >
        <Popover.Trigger>{trigger as ReactElement}</Popover.Trigger>
        <Popover.Content className="z-[9999] px-0 pb-4 pe-6 pt-5 dark:bg-gray-100 [&>svg]:hidden [&>svg]:dark:fill-gray-100 sm:[&>svg]:inline-flex">
          <NotificationsList setIsOpen={setIsOpen} />
        </Popover.Content>
      </Popover>
    </HeaderPopoverWithTooltip>
  );
}
