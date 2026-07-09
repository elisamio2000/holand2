'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchLaneId } from '@/types/one-search.types';
import {
  PiSquaresFourBold,
  PiChatCircleDotsBold,
  PiBriefcaseBold,
  PiFileBold,
  PiDatabaseBold,
  PiUserBold,
  PiGraphBold,
} from 'react-icons/pi';

const LANE_CONFIG: Array<{
  id: OneSearchLaneId | 'all';
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', icon: PiSquaresFourBold },
  { id: 'chat', icon: PiChatCircleDotsBold },
  { id: 'cases', icon: PiBriefcaseBold },
  { id: 'files', icon: PiFileBold },
  { id: 'storage', icon: PiDatabaseBold },
  { id: 'users', icon: PiUserBold },
  { id: 'graph', icon: PiGraphBold },
];

export interface ResultsTabsProps {
  activeTab: OneSearchLaneId | 'all';
  onChange: (tab: OneSearchLaneId | 'all') => void;
  counts?: Partial<Record<OneSearchLaneId | 'all', number>>;
  sticky?: boolean;
  className?: string;
}

export function ResultsTabs({
  activeTab,
  onChange,
  counts = {},
  sticky = true,
  className,
}: ResultsTabsProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex gap-4 border-b border-gray-200 dark:border-gray-800 overflow-x-auto',
        sticky && 'sticky top-0 z-20 bg-white dark:bg-gray-950 shadow-sm',
        className
      )}
    >
      {LANE_CONFIG.map(({ id, icon: Icon }) => {
        const count = counts[id] || 0;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            onClick={() => onChange(id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-all text-sm font-medium',
              isActive
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{t(`searchHub.lanes.${id}`)}</span>
            {count > 0 && (
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
