'use client';

import type { OneSearchLaneId } from '@/types/one-search.types';
import cn from '@core/utils/class-names';
import {
  PiChatCenteredDotsDuotone,
  PiFolderOpenDuotone,
  PiFolderDuotone,
  PiHardDrivesDuotone,
  PiUserCircleDuotone,
  PiGraphDuotone,
  PiListChecksDuotone,
} from 'react-icons/pi';

type IconComp = typeof PiChatCenteredDotsDuotone;

const LANE_ICON: Record<
  OneSearchLaneId,
  { Icon: IconComp; fg: string }
> = {
  chat: {
    Icon: PiChatCenteredDotsDuotone,
    fg: 'text-primary dark:text-primary',
  },
  cases: {
    Icon: PiFolderOpenDuotone,
    fg: 'text-violet-600 dark:text-violet-400',
  },
  files: {
    Icon: PiFolderDuotone,
    fg: 'text-amber-600 dark:text-amber-400',
  },
  storage: {
    Icon: PiHardDrivesDuotone,
    fg: 'text-teal-600 dark:text-teal-400',
  },
  users: {
    Icon: PiUserCircleDuotone,
    fg: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  graph: {
    Icon: PiGraphDuotone,
    fg: 'text-rose-600 dark:text-rose-400',
  },
  projects_tasks: {
    Icon: PiListChecksDuotone,
    fg: 'text-cyan-600 dark:text-cyan-400',
  },
};

export function LaneResultIcon({
  lane,
  className,
  size = 'md',
}: {
  lane: OneSearchLaneId;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const { Icon, fg } = LANE_ICON[lane];
  const iconSz = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <Icon
      className={cn(iconSz, fg, className)}
      aria-hidden
    />
  );
}
