import type { GroupCreate, GroupResponse, GroupUpdate, MembershipResponse } from '@/types/auth.types';
import type {
  WorkspaceInviteCreate,
  WorkspaceInvitePublic,
  WorkspaceInviteResponse,
  WorkspaceSecuritySettings,
} from '@/types/workspace.types';
import type { WorkspaceTeamNavPreset, WorkspaceUserNavOverlay } from '@/types/workspace-nav.types';
import {
  buildInitialMockGroups,
  buildInitialMockInvites,
  buildInitialMockMembers,
  MOCK_CURRENT_USER_ID,
} from './workspace-mock-fixtures';

const STORE_KEY = 'Holand_workspace_mock_state';

interface MockResourceRow {
  module_id?: string;
  case_id?: string;
  artifact_id?: string;
}

interface MockState {
  groups: GroupResponse[];
  members: Record<string, MembershipResponse[]>;
  invites: Record<string, WorkspaceInviteResponse[]>;
  modules: Record<string, MockResourceRow[]>;
  cases: Record<string, MockResourceRow[]>;
  files: Record<string, MockResourceRow[]>;
  security: Record<string, WorkspaceSecuritySettings>;
  tokenByInviteId: Record<string, string>;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function readState(): MockState {
  if (typeof window === 'undefined') {
    return {
      groups: buildInitialMockGroups(),
      members: buildInitialMockMembers(),
      invites: buildInitialMockInvites(),
      modules: {},
      cases: {},
      files: {},
      security: {},
      tokenByInviteId: {},
    };
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    /* ignore */
  }
  const initial: MockState = {
    groups: buildInitialMockGroups(),
    members: buildInitialMockMembers(),
    invites: buildInitialMockInvites(),
    modules: {
      'ws-mock-investigation': [{ module_id: 'chat' }, { module_id: 'case-viewer' }],
    },
    cases: {},
    files: {},
    security: {},
    tokenByInviteId: {},
  };
  writeState(initial);
  return initial;
}

function writeState(state: MockState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('Holand:workspace-mock-changed'));
  } catch {
    /* ignore */
  }
}

function mutate(fn: (s: MockState) => void): void {
  const s = readState();
  fn(s);
  writeState(s);
}

export function resetMockStore(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORE_KEY);
  readState();
}

export const workspaceMockStore = {
  listGroups(): GroupResponse[] {
    return readState().groups;
  },

  getGroup(id: string): GroupResponse | undefined {
    return readState().groups.find((g) => g.id === id);
  },

  createGroup(data: GroupCreate): GroupResponse {
    const group: GroupResponse = {
      id: uid('ws'),
      name: data.name,
      description: data.description ?? null,
      is_active: true,
      metadata: data.metadata ?? { mock: true },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mutate((s) => {
      s.groups.push(group);
      // Creator is the owner, not a plain admin â€” this is what unlocks
      // WorkspaceOwnerPanel and the sole-owner leave guard for workspaces
      // created from the UI (see leave-workspace-dialog.tsx).
      s.members[group.id] = [
        {
          id: uid('mem'),
          user_id: MOCK_CURRENT_USER_ID,
          group_id: group.id,
          role_name: 'owner',
          joined_at: new Date().toISOString(),
        },
      ];
    });
    return group;
  },

  updateGroup(id: string, data: GroupUpdate): GroupResponse {
    let updated!: GroupResponse;
    mutate((s) => {
      const idx = s.groups.findIndex((g) => g.id === id);
      if (idx < 0) throw new Error('Group not found');
      updated = {
        ...s.groups[idx],
        ...data,
        name: data.name ?? s.groups[idx].name,
        is_active: data.is_active ?? s.groups[idx].is_active ?? true,
        updated_at: new Date().toISOString(),
      };
      s.groups[idx] = updated;
    });
    return updated;
  },

  listMembers(groupId: string): MembershipResponse[] {
    return readState().members[groupId] ?? [];
  },

  /**
   * Role of the mock "current user" (MOCK_CURRENT_USER_ID) in a group, or
   * null if not a member. Used by WorkspaceContext instead of a hardcoded
   * 'admin' fallback so owner/admin/analyst mock personas behave correctly.
   */
  getCurrentUserRole(groupId: string): string | null {
    const members = readState().members[groupId] ?? [];
    return members.find((m) => m.user_id === MOCK_CURRENT_USER_ID)?.role_name ?? null;
  },

  addMember(groupId: string, userId: string, roleName: string): MembershipResponse {
    const m: MembershipResponse = {
      id: uid('mem'),
      user_id: userId,
      group_id: groupId,
      role_name: roleName,
      joined_at: new Date().toISOString(),
    };
    mutate((s) => {
      if (!s.members[groupId]) s.members[groupId] = [];
      s.members[groupId].push(m);
    });
    return m;
  },

  updateMemberRole(groupId: string, userId: string, roleName: string): void {
    mutate((s) => {
      const list = s.members[groupId] ?? [];
      const m = list.find((x) => x.user_id === userId);
      if (m) m.role_name = roleName;
    });
  },

  removeMember(groupId: string, userId: string): void {
    mutate((s) => {
      s.members[groupId] = (s.members[groupId] ?? []).filter((m) => m.user_id !== userId);
    });
  },

  listModules(groupId: string) {
    return readState().modules[groupId] ?? [];
  },

  assignModule(groupId: string, moduleId: string) {
    mutate((s) => {
      if (!s.modules[groupId]) s.modules[groupId] = [];
      if (!s.modules[groupId].some((x) => x.module_id === moduleId)) {
        s.modules[groupId].push({ module_id: moduleId });
      }
    });
  },

  removeModule(groupId: string, moduleId: string) {
    mutate((s) => {
      s.modules[groupId] = (s.modules[groupId] ?? []).filter((x) => x.module_id !== moduleId);
    });
  },

  listCases(groupId: string) {
    return readState().cases[groupId] ?? [];
  },

  assignCase(groupId: string, caseId: string) {
    mutate((s) => {
      if (!s.cases[groupId]) s.cases[groupId] = [];
      if (!s.cases[groupId].some((x) => x.case_id === caseId)) {
        s.cases[groupId].push({ case_id: caseId });
      }
    });
  },

  removeCase(groupId: string, caseId: string) {
    mutate((s) => {
      s.cases[groupId] = (s.cases[groupId] ?? []).filter((x) => x.case_id !== caseId);
    });
  },

  listFiles(groupId: string) {
    return readState().files[groupId] ?? [];
  },

  assignFile(groupId: string, artifactId: string) {
    mutate((s) => {
      if (!s.files[groupId]) s.files[groupId] = [];
      if (!s.files[groupId].some((x) => x.artifact_id === artifactId)) {
        s.files[groupId].push({ artifact_id: artifactId });
      }
    });
  },

  removeFile(groupId: string, artifactId: string) {
    mutate((s) => {
      s.files[groupId] = (s.files[groupId] ?? []).filter((x) => x.artifact_id !== artifactId);
    });
  },

  listInvites(groupId: string): WorkspaceInviteResponse[] {
    return readState().invites[groupId] ?? [];
  },

  inviteMember(groupId: string, data: WorkspaceInviteCreate): WorkspaceInviteResponse {
    const inviteId = uid('inv');
    const token = uid('tok');
    const invite: WorkspaceInviteResponse = {
      id: inviteId,
      group_id: groupId,
      email: data.email,
      role_name: data.role_name ?? 'user',
      status: 'pending',
      invited_by: MOCK_CURRENT_USER_ID,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_at: new Date().toISOString(),
    };
    mutate((s) => {
      if (!s.invites[groupId]) s.invites[groupId] = [];
      s.invites[groupId].push(invite);
      s.tokenByInviteId[inviteId] = token;
    });
    return invite;
  },

  getInviteToken(inviteId: string): string | undefined {
    return readState().tokenByInviteId[inviteId];
  },

  cancelInvite(groupId: string, inviteId: string): void {
    mutate((s) => {
      s.invites[groupId] = (s.invites[groupId] ?? []).filter((i) => i.id !== inviteId);
    });
  },

  resendInvite(groupId: string, inviteId: string): WorkspaceInviteResponse {
    const list = readState().invites[groupId] ?? [];
    const inv = list.find((i) => i.id === inviteId);
    if (!inv) throw new Error('Invite not found');
    return inv;
  },

  getInvitePublic(token: string): WorkspaceInvitePublic | null {
    const s = readState();
    for (const [inviteId, tok] of Object.entries(s.tokenByInviteId)) {
      if (tok !== token) continue;
      for (const invites of Object.values(s.invites)) {
        const inv = invites.find((i) => i.id === inviteId);
        if (!inv) continue;
        const group = s.groups.find((g) => g.id === inv.group_id);
        return {
          group_id: inv.group_id,
          group_name: group?.name ?? inv.group_id,
          inviter_name: 'Dev Admin',
          role_name: inv.role_name,
          email: inv.email,
          status: inv.status,
          expires_at: inv.expires_at,
        };
      }
    }
    return null;
  },

  acceptInvite(token: string): { group: GroupResponse } | null {
    const pub = workspaceMockStore.getInvitePublic(token);
    if (!pub) return null;
    mutate((s) => {
      for (const list of Object.values(s.invites)) {
        const inv = list.find((i) => i.email === pub.email && i.group_id === pub.group_id);
        if (inv) inv.status = 'accepted';
      }
      if (!s.members[pub.group_id]) s.members[pub.group_id] = [];
      if (!s.members[pub.group_id].some((m) => m.user_id === MOCK_CURRENT_USER_ID)) {
        s.members[pub.group_id].push({
          id: uid('mem'),
          user_id: MOCK_CURRENT_USER_ID,
          group_id: pub.group_id,
          role_name: pub.role_name,
          joined_at: new Date().toISOString(),
        });
      }
    });
    const group = workspaceMockStore.getGroup(pub.group_id);
    return group ? { group } : null;
  },

  declineInvite(token: string): void {
    const pub = workspaceMockStore.getInvitePublic(token);
    if (!pub) return;
    mutate((s) => {
      const list = s.invites[pub.group_id] ?? [];
      const inv = list.find((i) => i.email === pub.email);
      if (inv) inv.status = 'declined';
    });
  },

  leaveWorkspace(groupId: string): void {
    mutate((s) => {
      s.members[groupId] = (s.members[groupId] ?? []).filter(
        (m) => m.user_id !== MOCK_CURRENT_USER_ID
      );
    });
  },

  getSecurity(groupId: string): WorkspaceSecuritySettings {
    return readState().security[groupId] ?? { allow_member_invite: false };
  },

  updateSecurity(groupId: string, settings: WorkspaceSecuritySettings): void {
    mutate((s) => {
      s.security[groupId] = { ...s.security[groupId], ...settings };
    });
  },
};

const NAV_TEAM_PREFIX = 'Holand_ws_nav_team_';
const NAV_USER_PREFIX = 'Holand_ws_nav_user_';

export function loadTeamNavPreset(workspaceId: string): WorkspaceTeamNavPreset | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${NAV_TEAM_PREFIX}${workspaceId}`);
    return raw ? (JSON.parse(raw) as WorkspaceTeamNavPreset) : null;
  } catch {
    return null;
  }
}

export function saveTeamNavPreset(workspaceId: string, preset: WorkspaceTeamNavPreset): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${NAV_TEAM_PREFIX}${workspaceId}`, JSON.stringify(preset));
  window.dispatchEvent(new CustomEvent('Holand:workspace-nav-changed', { detail: { workspaceId } }));
}

export function loadUserNavOverlay(userId: string, workspaceId: string): WorkspaceUserNavOverlay | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${NAV_USER_PREFIX}${userId}_${workspaceId}`);
    return raw ? (JSON.parse(raw) as WorkspaceUserNavOverlay) : null;
  } catch {
    return null;
  }
}

export function saveUserNavOverlay(
  userId: string,
  workspaceId: string,
  overlay: WorkspaceUserNavOverlay
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${NAV_USER_PREFIX}${userId}_${workspaceId}`, JSON.stringify(overlay));
  window.dispatchEvent(new CustomEvent('Holand:workspace-nav-changed', { detail: { workspaceId } }));
}

