'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Loader, Text, Title } from 'rizzui';
import {
  PiCompassBold,
  PiCubeBold,
  PiFileBold,
  PiFolderBold,
  PiPaletteBold,
  PiShieldCheckBold,
  PiSlidersHorizontalBold,
  PiUsersBold,
} from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import { WORKSPACE_CHANGED_EVENT } from '@/lib/workspace-group-id';
import {
  useIsWorkspaceAdmin,
  useWorkspace,
  useWorkspaceRole,
} from '@/contexts/workspace-context';
import InviteMemberModal from '@/app/shared/workspace/invite-member-modal';
import LeaveWorkspaceDialog from '@/app/shared/workspace/leave-workspace-dialog';
import PendingInvitesTable from '@/app/shared/workspace/pending-invites-table';
import WorkspaceGeneralTab from '@/app/shared/workspace/workspace-general-tab';
import WorkspaceAppearancePanel from '@/app/shared/workspace/components/workspace-appearance-panel';
import WorkspaceNavigationTab from '@/app/shared/workspace/workspace-navigation-tab';
import {
  WorkspaceMembersTab,
  WorkspaceResourceTab,
} from '@/app/shared/workspace/workspace-group-tabs';
import WorkspaceSecurityTab from '@/app/shared/workspace/workspace-security-tab';
import WorkspaceSettingsShell, {
  ADMIN_SETTINGS_TABS,
  MEMBER_SETTINGS_TABS,
  type WorkspaceSettingsTabMeta,
} from '@/app/shared/workspace/components/workspace-settings-shell';
import WorkspaceOwnerPanel from '@/app/shared/workspace/components/workspace-owner-panel';
import WorkspaceDevRequirementsPanel from '@/app/shared/workspace/components/workspace-dev-requirements-panel';
import { workspaceService } from '@/services/workspace.service';
import type { GroupResponse } from '@/types/auth.types';
import type { WorkspaceSettingsTab } from '@/types/workspace.types';

const TAB_META: Record<WorkspaceSettingsTab, WorkspaceSettingsTabMeta> = {
  general: { labelKey: 'workspace.tabs.general', icon: <PiSlidersHorizontalBold size={16} /> },
  appearance: { labelKey: 'workspace.tabs.appearance', icon: <PiPaletteBold size={16} /> },
  people: { labelKey: 'workspace.tabs.people', icon: <PiUsersBold size={16} /> },
  modules: { labelKey: 'workspace.tabs.modules', icon: <PiCubeBold size={16} /> },
  cases: { labelKey: 'workspace.tabs.cases', icon: <PiFolderBold size={16} /> },
  security: { labelKey: 'workspace.tabs.security', icon: <PiShieldCheckBold size={16} /> },
  navigation: { labelKey: 'workspace.tabs.navigation', icon: <PiCompassBold size={16} /> },
};

interface WorkspaceSettingsViewProps {
  workspaceId: string;
  activeTab: WorkspaceSettingsTab;
}

export default function WorkspaceSettingsView({
  workspaceId,
  activeTab,
}: WorkspaceSettingsViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const { workspaces } = useWorkspace();
  const isAdmin = useIsWorkspaceAdmin(workspaceId);
  const role = useWorkspaceRole(workspaceId);
  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [inviteRefresh, setInviteRefresh] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  const isOwner = role === 'owner';
  const visibleTabs = isAdmin ? ADMIN_SETTINGS_TABS : MEMBER_SETTINGS_TABS;
  const navMode = isAdmin ? 'full' : 'member';

  const workspaceName =
    group?.name || workspaces.find((w) => w.id === workspaceId)?.name || workspaceId;

  const loadGroup = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const data = await workspaceService.getWorkspace(workspaceId);
        setGroup(data);
      } catch {
        toast.error(t('workspace.loadError'));
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, t]
  );

  useEffect(() => {
    loadGroup();
  }, [loadGroup, reloadTick]);

  useEffect(() => {
    const bump = () => setReloadTick((n) => n + 1);
    window.addEventListener(WORKSPACE_CHANGED_EVENT, bump);
    return () => window.removeEventListener(WORKSPACE_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const invites = await workspaceService.listInvites(workspaceId);
        if (!cancelled) {
          setPendingInviteCount(invites.filter((i) => i.status === 'pending').length);
        }
      } catch {
        if (!cancelled) setPendingInviteCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, inviteRefresh, reloadTick]);

  useEffect(() => {
    if (!isAdmin && role && !MEMBER_SETTINGS_TABS.includes(activeTab)) {
      router.replace(routes.workspace.settings(workspaceId, 'navigation'));
    }
  }, [isAdmin, role, activeTab, workspaceId, router]);

  if (!session) {
    return null;
  }

  if (!isAdmin && !role) {
    return (
      <div className="rounded-lg border border-muted p-6 text-center">
        <Title as="h3" className="text-lg font-semibold">
          {t('workspace.noPermission')}
        </Title>
        <Text className="mt-2 text-sm text-gray-500">{t('workspace.noPermissionHint')}</Text>
      </div>
    );
  }

  if (loading && isAdmin) {
    return <Loader variant="spinner" className="mx-auto my-12" />;
  }

  const setTab = (tab: WorkspaceSettingsTab) => {
    router.push(routes.workspace.settings(workspaceId, tab));
  };

  const effectiveTab =
    !isAdmin && role ? 'navigation' : activeTab;

  return (
    <>
      <WorkspaceSettingsShell
        workspaceName={workspaceName}
        role={role}
        tabs={visibleTabs}
        tabMeta={TAB_META}
        activeTab={effectiveTab}
        onTabChange={setTab}
        pendingInviteCount={isAdmin ? pendingInviteCount : 0}
        showLeave={Boolean(role && role !== 'owner')}
        onLeaveClick={() => setLeaveOpen(true)}
        footer={
          isAdmin ? (
            <div className="mt-6">
              <WorkspaceDevRequirementsPanel />
            </div>
          ) : undefined
        }
      >
        {effectiveTab === 'general' && isAdmin && (
          <>
            <WorkspaceGeneralTab
              workspaceId={workspaceId}
              initial={group}
              onSaved={setGroup}
            />
            {isOwner && <WorkspaceOwnerPanel />}
          </>
        )}

        {effectiveTab === 'appearance' && isAdmin && (
          <WorkspaceAppearancePanel workspaceId={workspaceId} mode="workspace" />
        )}

        {effectiveTab === 'people' && isAdmin && (
          <div className="space-y-6">
            <WorkspaceMembersTab
              workspaceId={workspaceId}
              onInviteByEmail={() => setInviteOpen(true)}
            />
            <div>
              <Title as="h4" className="mb-2 text-sm font-semibold">
                {t('workspace.invite.pendingTitle')}
              </Title>
              <PendingInvitesTable workspaceId={workspaceId} refreshKey={inviteRefresh} />
            </div>
          </div>
        )}

        {effectiveTab === 'modules' && isAdmin && (
          <WorkspaceResourceTab
            workspaceId={workspaceId}
            type="modules"
            idField="module_id"
            fetchFn={workspaceService.listModules}
            addFn={(id, data) => workspaceService.assignModule(id, data.module_id)}
            removeFn={workspaceService.removeModule}
          />
        )}

        {effectiveTab === 'cases' && isAdmin && (
          <div className="space-y-8">
            <div>
              <Title as="h4" className="mb-3 text-sm font-semibold">
                {t('workspace.tabs.cases')}
              </Title>
              <WorkspaceResourceTab
                workspaceId={workspaceId}
                type="cases"
                idField="case_id"
                fetchFn={workspaceService.listCases}
                addFn={(id, data) => workspaceService.assignCase(id, data.case_id)}
                removeFn={workspaceService.removeCase}
              />
            </div>
            <div>
              <Title as="h4" className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <PiFileBold size={16} />
                {t('workspace.tabs.files')}
              </Title>
              <WorkspaceResourceTab
                workspaceId={workspaceId}
                type="files"
                idField="artifact_id"
                fetchFn={workspaceService.listFiles}
                addFn={(id, data) => workspaceService.assignFile(id, data.artifact_id)}
                removeFn={workspaceService.removeFile}
              />
            </div>
          </div>
        )}

        {effectiveTab === 'security' && isAdmin && (
          <WorkspaceSecurityTab workspaceId={workspaceId} />
        )}

        {effectiveTab === 'navigation' && (
          <WorkspaceNavigationTab
            workspaceId={workspaceId}
            mode={navMode}
            userRole={role}
          />
        )}
      </WorkspaceSettingsShell>

      <InviteMemberModal
        workspaceId={workspaceId}
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSent={() => setInviteRefresh((k) => k + 1)}
      />

      <LeaveWorkspaceDialog
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        isOpen={leaveOpen}
        onClose={() => setLeaveOpen(false)}
      />
    </>
  );
}
