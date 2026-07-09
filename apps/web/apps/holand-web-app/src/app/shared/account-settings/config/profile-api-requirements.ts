export type ProfileApiRequirementStatus = 'live' | 'partial' | 'missing';

export interface ProfileApiRequirement {
  id: string;
  endpoint: string;
  status: ProfileApiRequirementStatus;
}

/** APIs used by profile settings — dev handoff panel. */
export const PROFILE_API_REQUIREMENTS: ProfileApiRequirement[] = [
  { id: 'auth-me', endpoint: 'GET /auth/me', status: 'live' },
  { id: 'auth-activity-log', endpoint: 'GET /auth/activity-log', status: 'live' },
  { id: 'change-password', endpoint: 'POST /auth/change-password', status: 'live' },
  { id: 'auth-avatar-upload', endpoint: 'POST /auth/avatar', status: 'live' },
  { id: 'auth-avatar-delete', endpoint: 'DELETE /auth/avatar', status: 'live' },
  { id: 'admin-get-user', endpoint: 'GET /admin/users/{id}', status: 'live' },
  {
    id: 'admin-patch-user',
    endpoint: 'PATCH /admin/users/{id}',
    status: 'partial',
  },
];
