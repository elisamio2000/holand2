import cn from '../../utils/class-names';
import type { SmartTooltipSize, SmartTooltipVariant } from './types';

/**
 * Tailwind classes for SmartTooltip surfaces (aligned with RizzUI primary/invert).
 */
export function getTooltipSurfaceClasses(
  variant: SmartTooltipVariant,
  size: SmartTooltipSize,
  className?: string
) {
  return cn(
    'pointer-events-none max-w-xs rounded-md font-medium shadow-md',
    size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
    variant === 'invert'
      ? 'bg-gray-900 text-gray-0 dark:bg-gray-200 dark:text-gray-900'
      : 'bg-primary text-gray-0',
    className
  );
}

export function getTooltipArrowClasses(
  variant: SmartTooltipVariant,
  arrowClassName?: string
) {
  return cn(
    variant === 'invert'
      ? 'fill-gray-900 dark:fill-gray-200'
      : 'fill-primary',
    arrowClassName
  );
}
