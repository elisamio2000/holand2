'use client';

import cn from '@core/utils/class-names';
import { ControlBar } from './control-bar';
import type {
  VideoAudioTrack,
  VideoQualityLevel,
  VideoSubtitleTrack,
} from '../types';

type OverlayControlBarProps = React.ComponentProps<typeof ControlBar> & {
  className?: string;
  visible?: boolean;
};

/**
 * Overlay variant of the control bar — white icons on dark video stage.
 */
export function OverlayControlBar({ className, visible = true, compact, ...props }: OverlayControlBarProps) {
  return (
    <div
      className={cn(
        'transition-opacity duration-300',
        !visible && 'pointer-events-none opacity-0',
        className
      )}
      aria-hidden={!visible}
      role="group"
      aria-label="Video controls"
    >
      <ControlBar {...props} compact={compact} overlay />
    </div>
  );
}
