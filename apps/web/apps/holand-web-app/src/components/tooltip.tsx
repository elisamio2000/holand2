/**
 * Unified tooltip entry point â€” use this instead of `rizzui` Tooltip.
 *
 * @see packages/holand-core/src/ui/smart-tooltip/
 */
export {
  SmartTooltip as Tooltip,
  SmartIconTooltip as IconTooltip,
  SmartPopoverTooltip as PopoverTooltip,
} from '@core/ui/smart-tooltip';

export type {
  SmartTooltipProps as TooltipProps,
  SmartIconTooltipProps as IconTooltipProps,
  SmartPopoverTooltipProps as PopoverTooltipProps,
  FloatingPosition,
  TooltipPreset,
} from '@core/ui/smart-tooltip';

/** @deprecated Use preset="header-edge" on Tooltip/PopoverTooltip instead */
export const HEADER_TOOLTIP_PLACEMENT = 'bottom-end' as const;

