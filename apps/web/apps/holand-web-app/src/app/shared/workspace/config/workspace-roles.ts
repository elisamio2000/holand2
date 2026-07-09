// Single source of truth for workspace member/invite role options.
// Previously duplicated (with untranslated English labels) across
// workspace-group-tabs.tsx, invite-member-modal.tsx and pending-invites-table.tsx.

export type WorkspaceAssignableRole = 'admin' | 'analyst' | 'user';

export interface WorkspaceRoleOption {
  value: WorkspaceAssignableRole;
  labelKey: string;
  descriptionKey: string;
}

/**
 * Assignable roles for members/invites. 'owner' is intentionally excluded —
 * it is set once at workspace creation, not assignable via People/Invite UI
 * (see workspace-requirements.md P1-BE-6 note on the owner role).
 */
export const WORKSPACE_ROLE_OPTIONS: WorkspaceRoleOption[] = [
  {
    value: 'admin',
    labelKey: 'workspace.roles.admin',
    descriptionKey: 'workspace.roles.adminDescription',
  },
  {
    value: 'analyst',
    labelKey: 'workspace.roles.analyst',
    descriptionKey: 'workspace.roles.analystDescription',
  },
  {
    value: 'user',
    labelKey: 'workspace.roles.user',
    descriptionKey: 'workspace.roles.userDescription',
  },
];

export function workspaceRoleLabelKey(role: string | null | undefined): string | null {
  if (!role) return null;
  const match = WORKSPACE_ROLE_OPTIONS.find((r) => r.value === role.toLowerCase());
  return match?.labelKey ?? null;
}
