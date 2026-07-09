import type { GroupResponse, MembershipResponse } from '@/types/auth.types';
import type { WorkspaceInviteResponse } from '@/types/workspace.types';

export const MOCK_WS_INVESTIGATION = 'ws-mock-investigation';
export const MOCK_WS_LEGAL = 'ws-mock-legal';

/**
 * Id used for the "current user" in the dev/mock workspace store.
 * Kept as a single constant so createGroup/acceptInvite/leaveWorkspace/
 * role-lookup all agree on who "self" is in mock mode.
 */
export const MOCK_CURRENT_USER_ID = 'dev-admin-user';

const now = () => new Date().toISOString();

export function buildInitialMockGroups(): GroupResponse[] {
  return [
    {
      id: MOCK_WS_INVESTIGATION,
      name: 'Investigation Team',
      description: 'Mock workspace — cases, graph, importer',
      is_active: true,
      created_at: now(),
      updated_at: now(),
      metadata: { mock: true },
    },
    {
      id: MOCK_WS_LEGAL,
      name: 'Legal Review',
      description: 'Mock workspace — cases and reports',
      is_active: true,
      created_at: now(),
      updated_at: now(),
      metadata: { mock: true },
    },
  ];
}

export function buildInitialMockMembers(): Record<string, MembershipResponse[]> {
  return {
    // Investigation Team: dev-admin-user is the creator/sole admin, so it
    // gets 'owner' — this is what makes WorkspaceOwnerPanel and the
    // last-admin leave guard actually exercisable in dev mode.
    [MOCK_WS_INVESTIGATION]: [
      {
        id: 'mem-1',
        user_id: MOCK_CURRENT_USER_ID,
        group_id: MOCK_WS_INVESTIGATION,
        role_name: 'owner',
        joined_at: now(),
      },
    ],
    // Legal Review: dev-admin-user is a plain member here, to exercise the
    // "member" (non-admin) settings experience.
    [MOCK_WS_LEGAL]: [
      {
        id: 'mem-2',
        user_id: MOCK_CURRENT_USER_ID,
        group_id: MOCK_WS_LEGAL,
        role_name: 'analyst',
        joined_at: now(),
      },
    ],
  };
}

export function buildInitialMockInvites(): Record<string, WorkspaceInviteResponse[]> {
  return {
    [MOCK_WS_INVESTIGATION]: [
      {
        id: 'inv-mock-1',
        group_id: MOCK_WS_INVESTIGATION,
        email: 'analyst@example.com',
        role_name: 'analyst',
        status: 'pending',
        invited_by: MOCK_CURRENT_USER_ID,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        created_at: now(),
      },
    ],
  };
}

/**
 * Session.groups map shape for dev bypass users.
 * Not currently wired into the NextAuth dev-bypass session (which sends an
 * empty groups map), but kept in sync with buildInitialMockMembers() so it
 * is correct if/when the bypass path starts seeding session.user.groups.
 */
export function buildMockSessionGroups(): Record<
  string,
  { role: string; group_name: string; permissions: string[]; modules: string[] }
> {
  return {
    [MOCK_WS_INVESTIGATION]: {
      role: 'owner',
      group_name: 'Investigation Team',
      permissions: ['cases:read', 'cases:write'],
      modules: ['chat', 'case-viewer', 'tools-panel'],
    },
    [MOCK_WS_LEGAL]: {
      role: 'analyst',
      group_name: 'Legal Review',
      permissions: ['cases:read'],
      modules: ['case-viewer'],
    },
  };
}
