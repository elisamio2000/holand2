'use client';

import type { ReactNode } from 'react';
import { ActionIcon, Drawer, Title } from 'rizzui';
import { PiXBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

interface PipelineAdminDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  bodyClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  children: ReactNode;
}

/** Right-side drawer shell — padding and header/footer aligned with BoardPanelShell / DrawerHeader. */
export default function PipelineAdminDrawer({
  open,
  onClose,
  title,
  subtitle,
  headerExtra,
  footer,
  footerClassName,
  bodyClassName,
  size = 'lg',
  className,
  children,
}: PipelineAdminDrawerProps) {
  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      placement="right"
      size={size}
      overlayClassName="dark:bg-opacity-40 dark:backdrop-blur-sm"
      containerClassName={cn(
        '!p-0 w-full max-w-[480px] sm:max-w-[520px] bg-background dark:bg-gray-100'
      )}
      className="z-[9998]"
    >
      <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
        <div className="shrink-0 border-b border-muted bg-gray-50/80 dark:bg-gray-100/5">
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Title as="h5" className="font-semibold">
                {title}
              </Title>
              {subtitle ? <div className="mt-1 text-sm text-gray-500">{subtitle}</div> : null}
            </div>
            <ActionIcon
              size="sm"
              variant="outline"
              onClick={onClose}
              className="shrink-0 border-0 p-0"
              aria-label="Close"
            >
              <PiXBold className="h-5 w-5" />
            </ActionIcon>
          </div>
          {headerExtra ? (
            <div className="border-t border-muted px-4 pb-3 pt-2">{headerExtra}</div>
          ) : null}
        </div>

        <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-4', bodyClassName)}>{children}</div>

        {footer ? (
          <div
            className={cn(
              'shrink-0 border-t border-muted bg-gray-50/50 px-4 py-3 dark:bg-gray-100/5',
              footerClassName
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
