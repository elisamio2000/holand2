import type {
  FloatingPlacement,
  FloatingPosition,
  FloatingSide,
  TextDirection,
  TooltipPreset,
} from './types';

const SIDES: FloatingSide[] = ['top', 'right', 'bottom', 'left'];
const ALIGNMENTS: FloatingPlacement[] = ['start', 'end'];

/**
 * Maps a tooltip preset to a logical floating placement (LTR baseline).
 */
export function resolveTooltipPreset(preset: TooltipPreset): FloatingPosition {
  switch (preset) {
    case 'toolbar':
      return 'bottom';
    case 'header-edge':
      return 'bottom-end';
    case 'media':
      return 'top';
    case 'sidebar':
      return 'right-start';
    default:
      return 'bottom';
  }
}

function mirrorSide(side: FloatingSide): FloatingSide {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  return side;
}

function mirrorAlignment(alignment: FloatingPlacement): FloatingPlacement {
  return alignment === 'start' ? 'end' : 'start';
}

function parseFloatingPosition(position: FloatingPosition): {
  side: FloatingSide;
  alignment?: FloatingPlacement;
} {
  const [side, alignment] = position.split('-') as [
    FloatingSide,
    FloatingPlacement | undefined,
  ];

  if (!SIDES.includes(side)) {
    return { side: 'bottom' };
  }

  if (alignment && ALIGNMENTS.includes(alignment)) {
    return { side, alignment };
  }

  return { side };
}

/**
 * Resolves a floating placement for the active text direction.
 *
 * In RTL:
 * - `left`/`right` sides are swapped
 * - `start`/`end` alignments are swapped
 */
export function resolveFloatingPlacement(
  position: FloatingPosition,
  dir: TextDirection
): FloatingPosition {
  if (dir === 'ltr') {
    return position;
  }

  const { side, alignment } = parseFloatingPosition(position);
  const mirroredSide = mirrorSide(side);

  if (!alignment) {
    return mirroredSide;
  }

  return `${mirroredSide}-${mirrorAlignment(alignment)}`;
}

/**
 * Resolves preset + explicit placement with RTL mirroring.
 */
export function resolveTooltipPlacement(
  options: {
    placement?: FloatingPosition;
    preset?: TooltipPreset;
    dir: TextDirection;
  }
): FloatingPosition {
  const base =
    options.placement ??
    (options.preset ? resolveTooltipPreset(options.preset) : 'bottom');

  return resolveFloatingPlacement(base, options.dir);
}
