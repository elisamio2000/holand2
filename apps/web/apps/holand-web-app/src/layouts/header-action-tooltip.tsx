'use client';

import type { ReactElement } from 'react';
import {
  IconTooltip,
  PopoverTooltip,
  Tooltip,
  HEADER_TOOLTIP_PLACEMENT,
} from '@/components/tooltip';

export { HEADER_TOOLTIP_PLACEMENT };

/**
 * HeaderActionTooltip — standard header icon tooltip with edge-aware placement.
 */
export function HeaderActionTooltip({
  content,
  children,
}: {
  content: string;
  children: ReactElement;
}) {
  return (
    <Tooltip content={content} preset="header-edge">
      {children}
    </Tooltip>
  );
}

/**
 * HeaderPopoverWithTooltip — wraps Popover (trigger + content) with header-edge tooltip.
 */
export function HeaderPopoverWithTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return <PopoverTooltip label={label}>{children}</PopoverTooltip>;
}

/** Re-export IconTooltip for header modules that need icon-only controls. */
export { IconTooltip as HeaderIconTooltip };
