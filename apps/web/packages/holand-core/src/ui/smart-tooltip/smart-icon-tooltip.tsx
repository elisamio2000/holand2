'use client';

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { SmartTooltip, type SmartTooltipProps } from './smart-tooltip';

export interface SmartIconTooltipProps
  extends Omit<SmartTooltipProps, 'children' | 'content'> {
  /** Accessible label — used as tooltip content and aria-label when missing on child */
  content: ReactNode;
  children: ReactElement;
}

/**
 * SmartIconTooltip — icon/control preset with enforced accessible naming.
 */
export function SmartIconTooltip({
  content,
  children,
  preset = 'toolbar',
  ...rest
}: SmartIconTooltipProps) {
  const label = typeof content === 'string' ? content : undefined;

  const child =
    label &&
    isValidElement(children) &&
    !children.props['aria-label']
      ? cloneElement(children, { 'aria-label': label })
      : children;

  return (
    <SmartTooltip content={content} preset={preset} {...rest}>
      {child as ReactElement}
    </SmartTooltip>
  );
}

SmartIconTooltip.displayName = 'SmartIconTooltip';
