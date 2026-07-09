'use client';

import {
  FloatingArrow,
  FloatingPortal,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import {
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  resolveTooltipZIndex,
  TOOLTIP_Z_INDEX_MIN,
} from '../floating/platform-z-index';
import type { FloatingPosition, TooltipPreset } from '../floating/types';
import { getTooltipArrowClasses, getTooltipSurfaceClasses } from './styles';
import type { SmartTooltipSize, SmartTooltipVariant } from './types';
import { useSmartTooltip } from './use-smart-tooltip';

export interface SmartTooltipProps {
  /** Tooltip label or rich content */
  content: ReactNode;
  /** Single trigger element (must accept ref) */
  children: ReactElement;
  placement?: FloatingPosition;
  preset?: TooltipPreset;
  /** Visual variant — `color` is kept as a RizzUI migration alias */
  variant?: SmartTooltipVariant;
  color?: SmartTooltipVariant;
  size?: SmartTooltipSize;
  showArrow?: boolean;
  arrowClassName?: string;
  className?: string;
  disabled?: boolean;
  /** Hover delay in ms */
  delay?: number;
}

/**
 * SmartTooltip — unified hover/focus tooltip with RTL-aware placement and dynamic arrow.
 */
export function SmartTooltip({
  content,
  children,
  placement,
  preset,
  variant,
  color,
  size = 'md',
  showArrow = true,
  arrowClassName,
  className,
  disabled = false,
  delay = 120,
}: SmartTooltipProps) {
  const [open, setOpen] = useState(false);
  const [tooltipZIndex, setTooltipZIndex] = useState(TOOLTIP_Z_INDEX_MIN);
  const resolvedVariant = color ?? variant ?? 'primary';
  const isOpen = open && !disabled;

  const { refs, floatingStyles, context, arrowRef } = useSmartTooltip({
    placement,
    preset,
    showArrow,
    open: open && !disabled,
    onOpenChange: setOpen,
  });

  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = refs.reference.current;
    if (trigger instanceof HTMLElement) {
      setTooltipZIndex(resolveTooltipZIndex(trigger));
    }
  }, [isOpen, refs.reference]);

  const hover = useHover(context, {
    delay: { open: delay, close: 0 },
    move: false,
    enabled: !disabled,
  });
  const focus = useFocus(context, { enabled: !disabled });
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    role,
  ]);

  const trigger = useMemo(() => {
    if (!isValidElement(children)) {
      return children;
    }

    return cloneElement(
      children,
      getReferenceProps({
        ...children.props,
        ref: refs.setReference,
      })
    );
  }, [children, getReferenceProps, refs.setReference]);

  if (!content || disabled) {
    return children;
  }

  return (
    <>
      {trigger}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: tooltipZIndex }}
            className={getTooltipSurfaceClasses(resolvedVariant, size, className)}
            {...getFloatingProps()}
          >
            {content}
            {showArrow && (
              <FloatingArrow
                ref={arrowRef}
                context={context}
                className={getTooltipArrowClasses(resolvedVariant, arrowClassName)}
                width={12}
                height={6}
              />
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

SmartTooltip.displayName = 'SmartTooltip';
