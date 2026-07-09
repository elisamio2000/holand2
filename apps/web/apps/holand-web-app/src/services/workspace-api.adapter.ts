import { gatewayClient } from '@/lib/api-client';
import { adminService } from '@/services/admin.service';
import { isWorkspaceMockEnabled } from '@/app/shared/workspace/config/workspace-data-source';
import { workspaceMockStore } from '@/app/shared/workspace/mock/workspace-mock-store';
import { MOCK_CURRENT_USER_ID } from '@/app/shared/workspace/mock/workspace-mock-fixtures';
import type { GroupCreate, GroupResponse, GroupUpdate } from '@/types/auth.types';
import type {
  WorkspaceInviteCreate,
  WorkspaceInvitePublic,
  WorkspaceInviteResponse,
  WorkspaceSecuritySettings,
} from '@/types/workspace.types';
import type { WorkspaceTeamNavPreset, WorkspaceUserNavOverlay } from '@/types/workspace-nav.types';
import type { WorkspaceBranding } from '@/lib/workspace-branding';
import {
  getGlobalWorkspaceBranding,
  getWorkspaceBranding,
  setGlobalWorkspaceBranding,
  setWorkspaceBranding,
} from '@/lib/workspace-branding';
import {
  loadTeamNavPreset,
  loadUserNavOverlay,
  saveTeamNavPreset,
  saveUserNavOverlay,
} from '@/app/shared/workspace/mock/workspace-mock-store';

let lastUsedMock = isWorkspaceMockEnabled();

export function workspaceUsedMockLast(): boolean {
  return lastUsedMock;
}

function withMockOrLive<T>(mockFn: () => T, liveFn: () => Promise<T>): Promise<T> {
  if (isWorkspaceMockEnabled()) {
    lastUsedMock = true;
    return Promise.resolve(mockFn());
  }
  lastUsedMock = false;
  return liveFn();
}

export const workspaceApiAdapter = {
  getWorkspace(id: string): Promise<GroupResponse> {
    return withMockOrLive(
      () => {
        const g = workspaceMockStore.getGroup(id);
        if (!g) throw new Error('Workspace not found');
        return g;
      },
      () => adminService.getGroup(id)
    );
  },

  createWorkspace(data: GroupCreate): Promise<GroupResponse> {
    return withMockOrLive(() => workspaceMockStore.createGroup(data), () => adminService.createGroup(data));
  },

  updateWorkspace(id: string, data: GroupUpdate): Promise<GroupResponse> {
    return withMockOrLive(
      () => workspaceMockStore.updateGroup(id, data),
      () => adminService.updateGroup(id, data)
    );
  },

  listMembers(workspaceId: string) {
    return withMockOrLive(
      () => workspaceMockStore.listMembers(workspaceId),
      () => adminService.getGroupMembers(workspaceId)
    );
  },

  addMember(workspaceId: string, data: { user_id: string; role_name?: string }) {
    return withMockOrLive(
      () =>
        workspaceMockStore.addMember(workspaceId, data.user_id, data.role_name ?? 'user'),
      () => adminService.addGroupMember(workspaceId, data)
    );
  },

  updateMemberRole(workspaceId: string, userId: string, roleName: string) {
    return withMockOrLive(
      () => {
        workspaceMockStore.updateMemberRole(workspaceId, userId, roleName);
        return undefined;
      },
      () => adminService.updateMemberRole(workspaceId, userId, roleName).then(() => undefined)
    );
  },

  removeMember(workspaceId: string, userId: string) {
    return withMockOrLive(
      () => {
        workspaceMockStore.removeMember(workspaceId, userId);
        return undefined;
      },
      () => adminService.removeGroupMember(workspaceId, userId).then(() => undefined)
    );
  },

  listModules(workspaceId: string) {
    return withMockOrLive(
      () => workspaceMockStore.listModules(workspaceId),
      () => adminService.getGroupModules(workspaceId)
    );
  },

  assignModule(workspaceId: string, moduleId: string) {
    return withMockOrLive(
      () => {
        workspaceMockStore.assignModule(workspaceId, moduleId);
        return undefined;
      },
      () => adminService.assignModuleToGroup(workspaceId, { module_id: moduleId }).then(() => undefined)
    );
  },

  removeModule(workspaceId: string, moduleId: string) {
    return withMockOrLive(
      () => {
        workspaceMockStore.removeModule(workspaceId, moduleId);
        return undefined;
      },
      () => adminService.removeModuleFromGroup(workspaceId, moduleId).then(() => undefined)
    );
  },

  listCases(workspaceId: string) {
    return withMockOrLive(
      () => workspaceMockStore.listCases(workspaceId),
      () => adminService.getGroupCases(workspaceId)
    );
  },

  assignCase(workspaceId: string, caseId: string) {
    return withMockOrLive(
      () => {
        workspaceMockStore.assignCase(workspaceId, caseId);
        return undefined;
      },
      () => adminService.assignCaseToGroup(workspaceId, { case_id: caseId }).then(() => undefined)
    );
  },

  removeCase(workspaceId: string, caseId: string) {
    return withMockOrLive(
      () => {
        workspaceMockStore.removeCase(workspaceId, caseId);
        return undefined;
      },
      () => adminService.removeCaseFromGroup(workspaceId, caseId).then(() => undefined)
    );
  },

  listFiles(workspaceId: string) {
    return withMockOrLive(
      () => workspaceMockStore.listFiles(workspaceId),
      () => adminService.getGroupFiles(workspaceId)
    );
  },

  assignFile(workspaceId: string, artifactId: string) {
    return withMockOrLive(
      () => {
        workspaceMockStore.assignFile(workspaceId, artifactId);
        return undefined;
      },
      () => adminService.assignFileToGroup(workspaceId, { artifact_id: artifactId }).then(() => undefined)
    );
  },

  removeFile(workspaceId: string, artifactId: string) {
    return withMockOrLive(
      () => {
        workspaceMockStore.removeFile(workspaceId, artifactId);
        return undefined;
      },
      () => adminService.removeFileFromGroup(workspaceId, artifactId).then(() => undefined)
    );
  },

  inviteMember(workspaceId: string, data: WorkspaceInviteCreate): Promise<WorkspaceInviteResponse> {
    return withMockOrLive(
      () => workspaceMockStore.inviteMember(workspaceId, data),
      async () => {
        const res = await gatewayClient.post<WorkspaceInviteResponse>(
          `/admin/group-rbac/groups/${workspaceId}/invites`,
          data
        );
        return res.data;
      }
    );
  },

  listInvites(workspaceId: string): Promise<WorkspaceInviteResponse[]> {
    return withMockOrLive(
      () => workspaceMockStore.listInvites(workspaceId),
      async () => {
        const res = await gatewayClient.get<WorkspaceInviteResponse[]>(
          `/admin/group-rbac/groups/${workspaceId}/invites`
        );
        return res.data;
      }
    );
  },

  cancelInvite(workspaceId: string, inviteId: string): Promise<void> {
    return withMockOrLive(
      () => {
        workspaceMockStore.cancelInvite(workspaceId, inviteId);
        return undefined;
      },
      () =>
        gatewayClient
          .delete(`/admin/group-rbac/groups/${workspaceId}/invites/${inviteId}`)
          .then(() => undefined)
    );
  },

  resendInvite(workspaceId: string, inviteId: string): Promise<WorkspaceInviteResponse> {
    return withMockOrLive(
      () => workspaceMockStore.resendInvite(workspaceId, inviteId),
      async () => {
        const res = await gatewayClient.post<WorkspaceInviteResponse>(
          `/admin/group-rbac/groups/${workspaceId}/invites/${inviteId}/resend`
        );
        return res.data;
      }
    );
  },

  getInviteLink(workspaceId: string, inviteId: string): string | null {
    if (isWorkspaceMockEnabled()) {
      const token = workspaceMockStore.getInviteToken(inviteId);
      if (!token) return null;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return `${origin}/invite/${token}`;
    }
    return null;
  },

  getInvitePublic(token: string): Promise<WorkspaceInvitePublic> {
    return withMockOrLive(
      () => {
        const pub = workspaceMockStore.getInvitePublic(token);
        if (!pub) throw new Error('Invite not found');
        return pub;
      },
      async () => {
        const res = await gatewayClient.get<WorkspaceInvitePublic>(
          `/admin/group-rbac/invites/${token}`
        );
        return res.data;
      }
    );
  },

  acceptInvite(token: string): Promise<{ group: GroupResponse }> {
    return withMockOrLive(
      () => {
        const result = workspaceMockStore.acceptInvite(token);
        if (!result) throw new Error('Invite not found');
        return result;
      },
      async () => {
        const res = await gatewayClient.post<{ group: GroupResponse }>(
          `/admin/group-rbac/invites/${token}/accept`
        );
        return res.data;
      }
    );
  },

  declineInvite(token: string): Promise<void> {
    return withMockOrLive(
      () => {
        workspaceMockStore.declineInvite(token);
        return undefined;
      },
      () => gatewayClient.post(`/admin/group-rbac/invites/${token}/decline`).then(() => undefined)
    );
  },

  leaveWorkspace(workspaceId: string): Promise<void> {
    return withMockOrLive(
      () => {
        workspaceMockStore.leaveWorkspace(workspaceId);
        return undefined;
      },
      () => gatewayClient.post(`/admin/group-rbac/groups/${workspaceId}/leave`).then(() => undefined)
    );
  },

  getSecuritySettings(workspaceId: string): Promise<WorkspaceSecuritySettings> {
    return withMockOrLive(
      () => workspaceMockStore.getSecurity(workspaceId),
      async () => {
        const res = await gatewayClient.get<WorkspaceSecuritySettings>(
          `/admin/group-rbac/groups/${workspaceId}/settings/security`
        );
        return res.data;
      }
    );
  },

  updateSecuritySettings(workspaceId: string, settings: WorkspaceSecuritySettings): Promise<void> {
    return withMockOrLive(
      () => {
        workspaceMockStore.updateSecurity(workspaceId, settings);
        return undefined;
      },
      () =>
        gatewayClient
          .put(`/admin/group-rbac/groups/${workspaceId}/settings/security`, settings)
          .then(() => undefined)
    );
  },

  getTeamNavPreset(workspaceId: string): Promise<WorkspaceTeamNavPreset | null> {
    if (isWorkspaceMockEnabled()) {
      return Promise.resolve(loadTeamNavPreset(workspaceId));
    }
    return gatewayClient
      .get<WorkspaceTeamNavPreset>(`/admin/group-rbac/groups/${workspaceId}/settings/navigation`)
      .then((r) => r.data)
      .catch(() => loadTeamNavPreset(workspaceId));
  },

  saveTeamNavPreset(workspaceId: string, preset: WorkspaceTeamNavPreset): Promise<void> {
    if (isWorkspaceMockEnabled()) {
      saveTeamNavPreset(workspaceId, preset);
      return Promise.resolve();
    }
    return gatewayClient
      .put(`/admin/group-rbac/groups/${workspaceId}/settings/navigation`, preset)
      .then(() => undefined)
      .catch(() => {
        saveTeamNavPreset(workspaceId, preset);
      });
  },

  getUserNavOverlay(userId: string, workspaceId: string): Promise<WorkspaceUserNavOverlay | null> {
    if (isWorkspaceMockEnabled()) {
      return Promise.resolve(loadUserNavOverlay(userId, workspaceId));
    }
    return gatewayClient
      .get<WorkspaceUserNavOverlay>(
        `/admin/group-rbac/users/me/workspaces/${workspaceId}/navigation`
      )
      .then((r) => r.data)
      .catch(() => loadUserNavOverlay(userId, workspaceId));
  },

  saveUserNavOverlay(
    userId: string,
    workspaceId: string,
    overlay: WorkspaceUserNavOverlay
  ): Promise<void> {
    if (isWorkspaceMockEnabled()) {
      saveUserNavOverlay(userId, workspaceId, overlay);
      return Promise.resolve();
    }
    return gatewayClient
      .put(`/admin/group-rbac/users/me/workspaces/${workspaceId}/navigation`, overlay)
      .then(() => undefined)
      .catch(() => {
        saveUserNavOverlay(userId, workspaceId, overlay);
      });
  },

  listMockGroupsForContext(): GroupResponse[] {
    if (!isWorkspaceMockEnabled()) return [];
    return workspaceMockStore.listGroups();
  },

  /** Real per-group role for the mock current user, or null if not resolvable. */
  getMockCurrentUserRole(groupId: string): string | null {
    if (!isWorkspaceMockEnabled()) return null;
    return workspaceMockStore.getCurrentUserRole(groupId);
  },

  /**
   * Whether `userId` refers to the mock store's "current user" placeholder.
   * Lets UI code (e.g. leave-workspace-dialog) match "self" against a
   * membership row without importing mock internals directly, since the
   * mock store's member ids never equal the real NextAuth session id.
   */
  isMockCurrentUser(userId: string): boolean {
    return isWorkspaceMockEnabled() && userId === MOCK_CURRENT_USER_ID;
  },

  getWorkspaceBranding(workspaceId: string): Promise<WorkspaceBranding> {
    return withMockOrLive(
      () => getWorkspaceBranding(workspaceId),
      async () => {
        const res = await gatewayClient.get<WorkspaceBranding>(
          `/admin/group-rbac/groups/${workspaceId}/settings/branding`
        );
        return res.data;
      }
    );
  },

  saveWorkspaceBranding(workspaceId: string, branding: WorkspaceBranding): Promise<void> {
    return withMockOrLive(
      () => {
        setWorkspaceBranding(workspaceId, branding);
        return undefined;
      },
      () =>
        gatewayClient
          .put(`/admin/group-rbac/groups/${workspaceId}/settings/branding`, branding)
          .then(() => undefined)
    );
  },

  getGlobalWorkspaceDefaults(): Promise<WorkspaceBranding> {
    return withMockOrLive(
      () => getGlobalWorkspaceBranding(),
      async () => {
        const res = await gatewayClient.get<WorkspaceBranding>(
          '/users/me/preferences/workspace-defaults'
        );
        return res.data;
      }
    );
  },

  saveGlobalWorkspaceDefaults(branding: WorkspaceBranding): Promise<void> {
    return withMockOrLive(
      () => {
        setGlobalWorkspaceBranding(branding);
        return undefined;
      },
      () =>
        gatewayClient
          .put('/users/me/preferences/workspace-defaults', branding)
          .then(() => undefined)
    );
  },

  uploadWorkspaceAvatar(workspaceId: string, file: File): Promise<{ url: string }> {
    if (isWorkspaceMockEnabled()) {
      lastUsedMock = true;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result);
          setWorkspaceBranding(workspaceId, {
            avatarKind: 'image',
            imageUrl: url,
            useGlobalAppearance: getWorkspaceBranding(workspaceId).useGlobalAppearance,
          });
          resolve({ url });
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    }
    lastUsedMock = false;
    const form = new FormData();
    form.append('file', file);
    return gatewayClient
      .post<{ url: string }>(`/admin/group-rbac/groups/${workspaceId}/avatar`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => {
        setWorkspaceBranding(workspaceId, {
          avatarKind: 'image',
          imageUrl: res.data.url,
        });
        return res.data;
      });
  },

  deleteWorkspaceAvatar(workspaceId: string): Promise<void> {
    return withMockOrLive(
      () => {
        setWorkspaceBranding(workspaceId, {
          avatarKind: 'icon',
          imageUrl: null,
        });
        return undefined;
      },
      () =>
        gatewayClient
          .delete(`/admin/group-rbac/groups/${workspaceId}/avatar`)
          .then(() => {
            setWorkspaceBranding(workspaceId, { avatarKind: 'icon', imageUrl: null });
          })
    );
  },
};
