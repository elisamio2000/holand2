import type { WorkspaceApiHealthEndpointStatus } from '@/hooks/use-workspace-api-health';

export type WorkspaceApiRequirementStatus = 'live' | 'partial' | 'missing';

export interface WorkspaceApiRequirement {
  id: string;
  endpoint: string;
  status: WorkspaceApiRequirementStatus;
  healthKey?: 'effective' | 'myGroups' | 'invites';
}

export const WORKSPACE_API_REQUIREMENTS: WorkspaceApiRequirement[] = [
  { id: 'effective', endpoint: 'GET /admin/group-rbac/effective', status: 'partial', healthKey: 'effective' },
  { id: 'my-groups', endpoint: 'GET /admin/group-rbac/my-groups', status: 'missing', healthKey: 'myGroups' },
  { id: 'groups-crud', endpoint: 'GET/POST/PUT /admin/group-rbac/groups', status: 'partial' },
  { id: 'members', endpoint: 'GET/POST/PUT/DELETE .../groups/{id}/members', status: 'partial' },
  { id: 'invites', endpoint: 'GET/POST/DELETE .../groups/{id}/invites', status: 'missing', healthKey: 'invites' },
  { id: 'invite-public', endpoint: 'GET/POST /invites/{token}', status: 'missing' },
  { id: 'leave', endpoint: 'POST .../groups/{id}/leave', status: 'missing' },
  { id: 'security', endpoint: 'GET/PUT .../settings/security', status: 'missing' },
  { id: 'navigation', endpoint: 'GET/PUT .../settings/navigation', status: 'missing' },
  { id: 'user-nav', endpoint: 'GET/PUT /users/me/workspaces/{id}/navigation', status: 'missing' },
  { id: 'modules', endpoint: 'GET/POST/DELETE .../modules', status: 'partial' },
];

export function resolveWorkspaceLiveApiStatus(
  req: WorkspaceApiRequirement,
  health: {
    effective: WorkspaceApiHealthEndpointStatus;
    myGroups: WorkspaceApiHealthEndpointStatus;
    invites: WorkspaceApiHealthEndpointStatus;
  }
): WorkspaceApiHealthEndpointStatus | WorkspaceApiRequirementStatus {
  if (req.status === 'live') return 'live';
  if (!req.healthKey) return req.status;
  const probed = health[req.healthKey];
  if (probed === 'unknown') return req.status;
  return probed;
}
