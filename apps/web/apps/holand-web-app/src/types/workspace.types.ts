/** User-facing workspace invite types (group-rbac invite endpoints). */

export interface WorkspaceInviteCreate {
  email: string;
  role_name?: string;
}

export interface WorkspaceInviteResponse {
  id: string;
  group_id: string;
  email: string;
  role_name: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  invited_by?: string | null;
  expires_at?: string | null;
  created_at: string;
  /** Optional URL returned by live API when email delivery unavailable */
  invite_url?: string | null;
}

/** Public metadata for accept page (no secrets). */
export interface WorkspaceInvitePublic {
  group_id: string;
  group_name: string;
  inviter_name?: string | null;
  role_name: string;
  email: string;
  status: string;
  expires_at?: string | null;
}

export interface WorkspaceSecuritySettings {
  allow_member_invite?: boolean;
}

export type WorkspaceSettingsTab =
  | 'general'
  | 'appearance'
  | 'people'
  | 'modules'
  | 'cases'
  | 'security'
  | 'navigation';
