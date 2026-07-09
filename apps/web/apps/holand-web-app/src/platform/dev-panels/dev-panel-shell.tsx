'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
import { PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

export type DevPanelShellHandle = {
  open: () => void;
};

export interface DevPanelShellProps {
  id: string;
  toggleLabel: string;
  enabled?: boolean;
  /** Called when panel opens via imperative handle. */
  onOpen?: () => void;
  /** Optional header actions (e.g. Re-probe button). */
  headerActions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  maxHeightClassName?: string;
}

/**
 * Collapsible dev requirements shell — toggle bar + scrollable content area.
 */
export const DevPanelShell = forwardRef<DevPanelShellHandle, DevPanelShellProps>(
  function DevPanelShell(
    {
      id,
      toggleLabel,
      enabled = true,
      onOpen,
      headerActions,
      children,
      className,
      contentClassName,
      maxHeightClassName = 'max-h-[min(50vh,520px)]',
    },
    ref
  ) {
    const [open, setOpen] = useState(false);

    const scrollIntoView = useCallback(() => {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }, [id]);

    const openPanel = useCallback(() => {
      setOpen(true);
      scrollIntoView();
      onOpen?.();
    }, [onOpen, scrollIntoView]);

    useImperativeHandle(ref, () => ({ open: openPanel }), [openPanel]);

    if (!enabled) return null;

    return (
      <div
        id={id}
        className={cn(
          'shrink-0 border-t border-muted bg-gray-0/80 px-4 py-2 dark:bg-gray-50/80',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md py-1.5 text-left text-xs font-medium text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <span className="truncate">{toggleLabel}</span>
            {open ? (
              <PiCaretUpBold className="size-3.5 shrink-0" />
            ) : (
              <PiCaretDownBold className="size-3.5 shrink-0" />
            )}
          </button>
          {headerActions}
        </div>
        {open && (
          <div
            className={cn(
              'mt-2 overflow-y-auto rounded-lg border border-muted p-3',
              maxHeightClassName,
              contentClassName
            )}
          >
            {children}
          </div>
        )}
      </div>
    );
  }
);

export interface UseDevPanelImperativeOptions {
  openPanel: () => void;
}

/**
 * Registers an imperative open handler on a module-level ref (e.g. openChatDevRequirementsPanel).
 */
export function useDevPanelImperativeBridge(
  openPanel: () => void,
  externalRef: { current: (() => void) | null }
) {
  useEffect(() => {
    externalRef.current = openPanel;
    return () => {
      if (externalRef.current === openPanel) {
        externalRef.current = null;
      }
    };
  }, [openPanel, externalRef]);
}
