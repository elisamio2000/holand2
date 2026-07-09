'use client';

import type { ReactNode } from 'react';
import { ActionIcon, Modal, Title } from 'rizzui';
import { PiXBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

interface PipelineAdminModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  titleId?: string;
  icon?: ReactNode;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Centered modal shell — header / scroll body / footer aligned with PipelineAdminDrawer. */
export default function PipelineAdminModal({
  open,
  onClose,
  title,
  subtitle,
  titleId,
  icon,
  headerExtra,
  footer,
  size = 'md',
  className,
  bodyClassName,
  children,
}: PipelineAdminModalProps) {
  return (
    <Modal isOpen={open} onClose={onClose} size={size} containerClassName="!p-0 overflow-hidden">
      <div
        role="dialog"
        aria-labelledby={titleId}
        className={cn('flex max-h-[min(85vh,640px)] flex-col bg-background', className)}
      >
        <div className="shrink-0 border-b border-muted bg-gray-50/80 px-5 py-4 dark:bg-gray-100/5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {icon ? <span className="shrink-0 text-primary">{icon}</span> : null}
                <Title id={titleId} as="h5" className="font-semibold">
                  {title}
                </Title>
              </div>
              {subtitle ? <div className="mt-1.5">{subtitle}</div> : null}
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
          {headerExtra ? <div className="mt-4 border-t border-muted pt-4">{headerExtra}</div> : null}
        </div>

        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-muted bg-gray-50/50 px-5 py-4 dark:bg-gray-100/5">
            {footer}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
