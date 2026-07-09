'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { PiCubeBold, PiFileBold, PiFolderBold, PiUsersBold } from 'react-icons/pi';
import { adminService } from '@/services/admin.service';
import {
  WorkspaceMembersTab,
  WorkspaceResourceTab,
} from '@/app/shared/workspace/workspace-group-tabs';

type Tab = 'members' | 'modules' | 'files' | 'cases';

interface GroupDetailProps {
  groupId: string;
}

/** Admin Groups tab — reuses shared workspace tab components. */
export default function GroupDetail({ groupId }: GroupDetailProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('members');

  const tabs: { key: Tab; labelKey: string; icon: React.ReactNode }[] = [
    { key: 'members', labelKey: 'groupDetailTabs.members', icon: <PiUsersBold size={16} /> },
    { key: 'modules', labelKey: 'groupDetailTabs.modules', icon: <PiCubeBold size={16} /> },
    { key: 'files', labelKey: 'groupDetailTabs.files', icon: <PiFileBold size={16} /> },
    { key: 'cases', labelKey: 'groupDetailTabs.cases', icon: <PiFolderBold size={16} /> },
  ];

  return (
    <div className="rounded-lg border border-muted bg-gray-50/60 p-4 dark:bg-gray-100/50">
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-200/70">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-50'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'members' && <WorkspaceMembersTab workspaceId={groupId} />}
      {activeTab === 'modules' && (
        <WorkspaceResourceTab
          workspaceId={groupId}
          type="modules"
          idField="module_id"
          fetchFn={adminService.getGroupModules}
          addFn={(id, data) => adminService.assignModuleToGroup(id, { module_id: data.module_id })}
          removeFn={adminService.removeModuleFromGroup}
        />
      )}
      {activeTab === 'files' && (
        <WorkspaceResourceTab
          workspaceId={groupId}
          type="files"
          idField="artifact_id"
          fetchFn={adminService.getGroupFiles}
          addFn={(id, data) => adminService.assignFileToGroup(id, { artifact_id: data.artifact_id })}
          removeFn={adminService.removeFileFromGroup}
        />
      )}
      {activeTab === 'cases' && (
        <WorkspaceResourceTab
          workspaceId={groupId}
          type="cases"
          idField="case_id"
          fetchFn={adminService.getGroupCases}
          addFn={(id, data) => adminService.assignCaseToGroup(id, { case_id: data.case_id })}
          removeFn={adminService.removeCaseFromGroup}
        />
      )}
    </div>
  );
}
