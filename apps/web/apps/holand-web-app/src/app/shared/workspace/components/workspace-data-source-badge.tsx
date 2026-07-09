'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  getWorkspaceDataStatus,
  isWorkspaceDevPanelEnabled,
  type WorkspaceDataStatus,
} from '@/app/shared/workspace/config/workspace-data-source';

const STATUS_STYLES: Record<WorkspaceDataStatus, string> = {
  live: 'bg-green-100/90 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  mock: 'bg-violet-100/90 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  degraded: 'bg-amber-100/90 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
};

type Props = {
  useMock: boolean;
  hadLiveError?: boolean;
  className?: string;
};

export default function WorkspaceDataSourceBadge({
  useMock,
  hadLiveError,
  className,
}: Props) {
  const { t } = useTranslation();
  const status = getWorkspaceDataStatus(useMock, hadLiveError);

  if (process.env.NODE_ENV === 'production' && status === 'mock' && !isWorkspaceDevPanelEnabled()) {
    return null;
  }
  if (process.env.NODE_ENV === 'production' && status === 'live' && !isWorkspaceDevPanelEnabled()) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        STATUS_STYLES[status],
        className
      )}
    >
      {t(`workspace.dataSource.${status}`, status.toUpperCase())}
    </span>
  );
}
