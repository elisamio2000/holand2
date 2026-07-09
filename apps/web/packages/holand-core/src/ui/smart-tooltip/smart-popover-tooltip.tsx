'use client';

import type { ReactElement, ReactNode } from 'react';
import { SmartTooltip, type SmartTooltipProps } from './smart-tooltip';

export interface SmartPopoverTooltipProps
  extends Omit<SmartTooltipProps, 'children'> {
  label: ReactNode;
  children: ReactElement;
}

/**
 * SmartPopoverTooltip — wraps an entire Popover (trigger + content) safely.
 *
 * Tooltip must wrap the Popover from the outside — never wrap Popover.Trigger only.
 */
export function SmartPopoverTooltip({
  label,
  children,
  preset = 'header-edge',
  ...rest
}: SmartPopoverTooltipProps) {
  return (
    <SmartTooltip content={label} preset={preset} {...rest}>
      <span className="inline-flex shrink-0">{children}</span>
    </SmartTooltip>
  );
}

SmartPopoverTooltip.displayName = 'SmartPopoverTooltip';
