'use client';

import { Badge, Button, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import WorkspaceDataSourceBadge from '@/app/shared/workspace/components/workspace-data-source-badge';
import WorkspaceRoleBadge from '@/app/shared/workspace/components/workspace-role-badge';
import { getWorkspaceServiceDataStatus } from '@/services/workspace.service';
import type { WorkspaceSettingsTab } from '@/types/workspace.types';

export const ADMIN_SETTINGS_TABS: WorkspaceSettingsTab[] = [
  'general',
  'appearance',
  'people',
  'modules',
  'cases',
  'security',
  'navigation',
];

export const MEMBER_SETTINGS_TABS: WorkspaceSettingsTab[] = ['navigation'];

export type WorkspaceSettingsTabMeta = {
  labelKey: string;
  icon: React.ReactNode;
};

interface WorkspaceSettingsShellProps {
  workspaceName: string;
  role: string | null;
  tabs: WorkspaceSettingsTab[];
  tabMeta: Record<WorkspaceSettingsTab, WorkspaceSettingsTabMeta>;
  activeTab: WorkspaceSettingsTab;
  onTabChange: (tab: WorkspaceSettingsTab) => void;
  pendingInviteCount?: number;
  onLeaveClick?: () => void;
  showLeave?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function WorkspaceSettingsShell({
  workspaceName,
  role,
  tabs,
  tabMeta,
  activeTab,
  onTabChange,
  pendingInviteCount = 0,
  onLeaveClick,
  showLeave = false,
  children,
  footer,
}: WorkspaceSettingsShellProps) {
  const { t } = useTranslation();
  const dataStatus = getWorkspaceServiceDataStatus();
  const isOwner = role === 'owner';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Title as="h2" className="text-xl font-semibold">
              {workspaceName}
            </Title>
            <WorkspaceDataSourceBadge
              useMock={dataStatus === 'mock'}
              hadLiveError={dataStatus === 'degraded'}
            />
            {role && <WorkspaceRoleBadge role={role} />}
          </div>
          <Text className="text-sm text-gray-500">{t('workspace.settingsSubtitle')}</Text>
          {isOwner && (
            <Text className="mt-1 text-xs text-amber-600">{t('workspace.owner.transferHint')}</Text>
          )}
        </div>
        {showLeave && onLeaveClick && (
          <Button variant="outline" color="danger" onClick={onLeaveClick}>
            {t('workspace.leave.action')}
          </Button>
        )}
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-200/70 sm:flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-50'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tabMeta[tab].icon}
            {t(tabMeta[tab].labelKey)}
            {tab === 'people' && pendingInviteCount > 0 && (
              <Badge color="warning" rounded="md" className="ms-1 text-[10px]">
                {pendingInviteCount}
              </Badge>
            )}
          </button>
        ))}
      </div>

      <div className="@container overflow-hidden rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
        <div className="p-5 @xl:p-6">{children}</div>
      </div>

      {footer}
    </div>
  );
}
