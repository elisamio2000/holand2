import { workspaceApiAdapter, workspaceUsedMockLast } from '@/services/workspace-api.adapter';
import {
  getWorkspaceDataStatus,
  isWorkspaceMockEnabled,
} from '@/app/shared/workspace/config/workspace-data-source';
import type { GroupCreate, GroupUpdate } from '@/types/auth.types';
import type { WorkspaceBranding } from '@/lib/workspace-branding';
import type {
  WorkspaceInviteCreate,
  WorkspaceSecuritySettings,
} from '@/types/workspace.types';
import type { WorkspaceTeamNavPreset, WorkspaceUserNavOverlay } from '@/types/workspace-nav.types';

export function getWorkspaceServiceDataStatus() {
  return getWorkspaceDataStatus(isWorkspaceMockEnabled() || workspaceUsedMockLast());
}

/**
 * User-facing workspace API — routes through mock/live adapter.
 */
export const workspaceService = {
  getWorkspace: (id: string) => workspaceApiAdapter.getWorkspace(id),
  createWorkspace: (data: GroupCreate) => workspaceApiAdapter.createWorkspace(data),
  updateWorkspace: (id: string, data: GroupUpdate) => workspaceApiAdapter.updateWorkspace(id, data),
  listMembers: (workspaceId: string) => workspaceApiAdapter.listMembers(workspaceId),
  isMockCurrentUser: (userId: string) => workspaceApiAdapter.isMockCurrentUser(userId),
  addMember: (workspaceId: string, data: { user_id: string; role_name?: string }) =>
    workspaceApiAdapter.addMember(workspaceId, data),
  updateMemberRole: (workspaceId: string, userId: string, roleName: string) =>
    workspaceApiAdapter.updateMemberRole(workspaceId, userId, roleName),
  removeMember: (workspaceId: string, userId: string) =>
    workspaceApiAdapter.removeMember(workspaceId, userId),
  listModules: (workspaceId: string) => workspaceApiAdapter.listModules(workspaceId),
  assignModule: (workspaceId: string, moduleId: string) =>
    workspaceApiAdapter.assignModule(workspaceId, moduleId),
  removeModule: (workspaceId: string, moduleId: string) =>
    workspaceApiAdapter.removeModule(workspaceId, moduleId),
  listCases: (workspaceId: string) => workspaceApiAdapter.listCases(workspaceId),
  assignCase: (workspaceId: string, caseId: string) =>
    workspaceApiAdapter.assignCase(workspaceId, caseId),
  removeCase: (workspaceId: string, caseId: string) =>
    workspaceApiAdapter.removeCase(workspaceId, caseId),
  listFiles: (workspaceId: string) => workspaceApiAdapter.listFiles(workspaceId),
  assignFile: (workspaceId: string, artifactId: string) =>
    workspaceApiAdapter.assignFile(workspaceId, artifactId),
  removeFile: (workspaceId: string, artifactId: string) =>
    workspaceApiAdapter.removeFile(workspaceId, artifactId),
  inviteMember: (workspaceId: string, data: WorkspaceInviteCreate) =>
    workspaceApiAdapter.inviteMember(workspaceId, data),
  listInvites: (workspaceId: string) => workspaceApiAdapter.listInvites(workspaceId),
  cancelInvite: (workspaceId: string, inviteId: string) =>
    workspaceApiAdapter.cancelInvite(workspaceId, inviteId),
  resendInvite: (workspaceId: string, inviteId: string) =>
    workspaceApiAdapter.resendInvite(workspaceId, inviteId),
  getInviteLink: (workspaceId: string, inviteId: string) =>
    workspaceApiAdapter.getInviteLink(workspaceId, inviteId),
  getInvitePublic: (token: string) => workspaceApiAdapter.getInvitePublic(token),
  acceptInvite: (token: string) => workspaceApiAdapter.acceptInvite(token),
  declineInvite: (token: string) => workspaceApiAdapter.declineInvite(token),
  leaveWorkspace: (workspaceId: string) => workspaceApiAdapter.leaveWorkspace(workspaceId),
  getSecuritySettings: (workspaceId: string) => workspaceApiAdapter.getSecuritySettings(workspaceId),
  updateSecuritySettings: (workspaceId: string, settings: WorkspaceSecuritySettings) =>
    workspaceApiAdapter.updateSecuritySettings(workspaceId, settings),
  getTeamNavPreset: (workspaceId: string) => workspaceApiAdapter.getTeamNavPreset(workspaceId),
  saveTeamNavPreset: (workspaceId: string, preset: WorkspaceTeamNavPreset) =>
    workspaceApiAdapter.saveTeamNavPreset(workspaceId, preset),
  getUserNavOverlay: (userId: string, workspaceId: string) =>
    workspaceApiAdapter.getUserNavOverlay(userId, workspaceId),
  saveUserNavOverlay: (userId: string, workspaceId: string, overlay: WorkspaceUserNavOverlay) =>
    workspaceApiAdapter.saveUserNavOverlay(userId, workspaceId, overlay),
  getWorkspaceBranding: (workspaceId: string) => workspaceApiAdapter.getWorkspaceBranding(workspaceId),
  saveWorkspaceBranding: (workspaceId: string, branding: WorkspaceBranding) =>
    workspaceApiAdapter.saveWorkspaceBranding(workspaceId, branding),
  getGlobalWorkspaceDefaults: () => workspaceApiAdapter.getGlobalWorkspaceDefaults(),
  saveGlobalWorkspaceDefaults: (branding: WorkspaceBranding) =>
    workspaceApiAdapter.saveGlobalWorkspaceDefaults(branding),
  uploadWorkspaceAvatar: (workspaceId: string, file: File) =>
    workspaceApiAdapter.uploadWorkspaceAvatar(workspaceId, file),
  deleteWorkspaceAvatar: (workspaceId: string) => workspaceApiAdapter.deleteWorkspaceAvatar(workspaceId),
};
