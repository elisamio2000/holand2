'use client';

import {
  arrow,
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift,
  useFloating,
  type Placement,
} from '@floating-ui/react';
import { useMemo, useRef } from 'react';
import { resolveTooltipPlacement } from '../floating/resolve-floating-placement';
import type { FloatingPosition, TooltipPreset } from '../floating/types';
import { useDocumentDirection } from './use-document-direction';

export interface UseSmartTooltipOptions {
  placement?: FloatingPosition;
  preset?: TooltipPreset;
  showArrow?: boolean;
  offset?: number;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Floating UI hook for SmartTooltip — arrow tracks trigger under shift/flip.
 */
export function useSmartTooltip({
  placement,
  preset,
  showArrow = true,
  offset: offsetPx = 6,
  open,
  onOpenChange,
}: UseSmartTooltipOptions) {
  const direction = useDocumentDirection();
  const arrowRef = useRef<SVGSVGElement | null>(null);

  const resolvedPlacement = useMemo(
    () =>
      resolveTooltipPlacement({
        placement,
        preset,
        dir: direction,
      }),
    [placement, preset, direction]
  );

  const floating = useFloating({
    placement: resolvedPlacement as Placement,
    open,
    onOpenChange,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(offsetPx),
      flip({ fallbackAxisSideDirection: 'start', padding: 8 }),
      shift({ padding: 8, limiter: limitShift() }),
      ...(showArrow
        ? [arrow({ element: arrowRef, padding: 8 })]
        : []),
    ],
  });

  return {
    ...floating,
    arrowRef,
    resolvedPlacement,
    direction,
  };
}
