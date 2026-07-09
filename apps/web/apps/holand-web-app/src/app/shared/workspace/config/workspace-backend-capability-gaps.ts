// Workspace backend capability gaps â€” dev handoff panel source of truth

export type WorkspaceBackendGapPriority = 'P0' | 'P1' | 'P2';

export type WorkspaceUiSurface =
  | 'session'
  | 'switcher'
  | 'settings'
  | 'people'
  | 'invite'
  | 'security'
  | 'navigation'
  | 'modules';

export interface WorkspaceBackendCapabilityGap {
  id: string;
  capability: string;
  feWorkaround: string;
  requiredApi: string;
  feRequest: string;
  expectedResponse: string;
  acceptance: string;
  priority: WorkspaceBackendGapPriority;
  blockedFeatures: string[];
  uiSurface: WorkspaceUiSurface;
  resolved?: boolean;
  resolvedNote?: string;
}

export function workspaceGapI18nKey(id: string): string {
  return `workspace.devRequirements.gaps.${id}`;
}

export const WORKSPACE_BACKEND_CAPABILITY_GAPS: WorkspaceBackendCapabilityGap[] = [
  {
    id: 'group-rbac-effective',
    capability: 'Effective RBAC on login (groups + modules)',
    feWorkaround: 'NextAuth session; mock groups in dev when mock enabled',
    requiredApi: 'GET /admin/group-rbac/effective',
    feRequest: `GET /admin/group-rbac/effective
Authorization: Bearer {user_jwt}`,
    expectedResponse: `200 {
  "user_id": "uuid",
  "base_roles": ["analyst"],
  "is_admin": false,
  "groups": {
    "group-uuid": {
      "role": "admin",
      "group_name": "Analysis Team",
      "permissions": ["cases:read"],
      "modules": ["chat", "case-viewer"]
    }
  }
}`,
    acceptance: '200 for valid JWT; groups map drives workspace switcher + X-Group-Id',
    priority: 'P0',
    blockedFeatures: ['Login session groups', 'Sidebar RBAC', 'Workspace switcher'],
    uiSurface: 'session',
  },
  {
    id: 'my-groups',
    capability: 'List workspaces for switcher',
    feWorkaround: 'Falls back to /effective groups map',
    requiredApi: 'GET /admin/group-rbac/my-groups',
    feRequest: `GET /admin/group-rbac/my-groups
Authorization: Bearer {token}`,
    expectedResponse: `200 {
  "memberships": [
    {
      "id": "membership-uuid",
      "group_id": "group-uuid",
      "group_name": "Analysis Team",
      "role_name": "admin",
      "is_active": true
    }
  ]
}`,
    acceptance: 'Dedicated list endpoint; faster than parsing /effective',
    priority: 'P0',
    blockedFeatures: ['Workspace switcher list', 'Create workspace refresh'],
    uiSurface: 'switcher',
  },
  {
    id: 'create-group',
    capability: 'Create workspace (group)',
    feWorkaround: 'Mock store in dev; adminService.createGroup in live',
    requiredApi: 'POST /admin/group-rbac/groups',
    feRequest: `POST /admin/group-rbac/groups
Content-Type: application/json
{
  "name": "New Team",
  "description": "Optional",
  "is_active": true
}`,
    expectedResponse: `201 {
  "id": "group-uuid",
  "name": "New Team",
  "description": "Optional",
  "is_active": true,
  "created_at": "2026-06-27T12:00:00Z"
}`,
    acceptance: 'Creator becomes admin/owner; appears in switcher after session refresh',
    priority: 'P0',
    blockedFeatures: ['Create workspace modal'],
    uiSurface: 'settings',
  },
  {
    id: 'members-crud',
    capability: 'Workspace member CRUD',
    feWorkaround: 'Mock members in dev',
    requiredApi: 'GET/POST/PUT/DELETE /admin/group-rbac/groups/{id}/members',
    feRequest: `GET /admin/group-rbac/groups/{group_id}/members

POST /admin/group-rbac/groups/{group_id}/members
{ "user_id": "uuid", "role_name": "analyst" }

PUT /admin/group-rbac/groups/{group_id}/members/{user_id}
{ "role_name": "admin" }

DELETE /admin/group-rbac/groups/{group_id}/members/{user_id}`,
    expectedResponse: `200 [
  {
    "id": "membership-uuid",
    "group_id": "group-uuid",
    "user_id": "user-uuid",
    "role_name": "analyst",
    "created_at": "ISO8601"
  }
]`,
    acceptance: 'People tab list/add/remove/role change without 401',
    priority: 'P0',
    blockedFeatures: ['People tab', 'Direct add member'],
    uiSurface: 'people',
  },
  {
    id: 'invite-create',
    capability: 'Email invite to workspace',
    feWorkaround: 'Mock invites + copy link in dev',
    requiredApi: 'POST /admin/group-rbac/groups/{id}/invites',
    feRequest: `POST /admin/group-rbac/groups/{group_id}/invites
{
  "email": "user@example.com",
  "role_name": "analyst"
}`,
    expectedResponse: `201 {
  "id": "invite-uuid",
  "group_id": "group-uuid",
  "email": "user@example.com",
  "role_name": "analyst",
  "status": "pending",
  "expires_at": "2026-07-27T12:00:00Z",
  "created_at": "2026-06-27T12:00:00Z"
}`,
    acceptance: 'Pending invite listed; optional email + always return token for link',
    priority: 'P1',
    blockedFeatures: ['Invite modal', 'Pending invites table'],
    uiSurface: 'people',
  },
  {
    id: 'invite-accept',
    capability: 'Accept workspace invite by token',
    feWorkaround: 'Mock accept page in dev',
    requiredApi: 'GET /invites/{token} + POST /invites/{token}/accept',
    feRequest: `GET /invites/{token}

POST /invites/{token}/accept
Authorization: Bearer {user_jwt}`,
    expectedResponse: `GET 200 {
  "group_id": "group-uuid",
  "group_name": "Analysis Team",
  "role_name": "analyst",
  "email": "user@example.com",
  "status": "pending"
}

POST 200 { "group_id": "group-uuid", "membership_id": "uuid" }`,
    acceptance: 'User joins group; session groups updated',
    priority: 'P1',
    blockedFeatures: ['/invite/{token} page'],
    uiSurface: 'invite',
  },
  {
    id: 'leave-workspace',
    capability: 'Member leaves workspace',
    feWorkaround: 'Mock remove self from members',
    requiredApi: 'POST /admin/group-rbac/groups/{id}/leave',
    feRequest: `POST /admin/group-rbac/groups/{group_id}/leave
Authorization: Bearer {token}`,
    expectedResponse: `200 { "success": true }`,
    acceptance: 'Non-owner can leave; owner blocked with 403 + transfer UX placeholder',
    priority: 'P1',
    blockedFeatures: ['Leave workspace dialog'],
    uiSurface: 'settings',
  },
  {
    id: 'security-settings',
    capability: 'Workspace security settings GET/PUT',
    feWorkaround: 'Mock localStorage security map',
    requiredApi: 'GET/PUT /admin/group-rbac/groups/{id}/settings/security',
    feRequest: `GET /admin/group-rbac/groups/{group_id}/settings/security

PUT /admin/group-rbac/groups/{group_id}/settings/security
{ "allow_member_invite": true }`,
    expectedResponse: `200 {
  "allow_member_invite": false
}`,
    acceptance: 'Security tab loads current values on mount',
    priority: 'P1',
    blockedFeatures: ['Security tab toggle'],
    uiSurface: 'security',
  },
  {
    id: 'nav-preset',
    capability: 'Team sidebar navigation preset',
    feWorkaround: 'localStorage Holand_ws_nav_team_{id} in dev/mock',
    requiredApi: 'GET/PUT /admin/group-rbac/groups/{id}/settings/navigation',
    feRequest: `GET /admin/group-rbac/groups/{group_id}/settings/navigation

PUT /admin/group-rbac/groups/{group_id}/settings/navigation
{
  "schemaVersion": 1,
  "templateId": "investigation",
  "items": [
    { "id": "nav.aiChat", "visible": true, "order": 0 },
    { "id": "nav.cases", "visible": true, "order": 1 }
  ]
}`,
    expectedResponse: `200 {
  "schemaVersion": 1,
  "templateId": "investigation",
  "items": [{ "id": "nav.aiChat", "visible": true, "order": 0 }]
}`,
    acceptance: 'Admin preset applies to all members sidebar base menu',
    priority: 'P1',
    blockedFeatures: ['Navigation settings tab', 'Per-workspace sidebar'],
    uiSurface: 'navigation',
  },
  {
    id: 'nav-user-overlay',
    capability: 'User navigation overlay (pin/hide/reorder)',
    feWorkaround: 'localStorage Holand_ws_nav_user_{userId}_{workspaceId}',
    requiredApi: 'GET/PUT /users/me/workspaces/{id}/navigation',
    feRequest: `GET /users/me/workspaces/{group_id}/navigation
Authorization: Bearer {token}

PUT /users/me/workspaces/{group_id}/navigation
{
  "schemaVersion": 1,
  "pinnedIds": ["nav.aiChat"],
  "hiddenIds": ["nav.plugins"],
  "orderOverrides": { "nav.cases": 0 }
}`,
    expectedResponse: `200 {
  "schemaVersion": 1,
  "pinnedIds": ["nav.aiChat"],
  "hiddenIds": [],
  "orderOverrides": {}
}`,
    acceptance: 'Favorites bar + personal hide/order without affecting team preset',
    priority: 'P2',
    blockedFeatures: ['My shortcuts in Navigation tab', 'Sidebar favorites'],
    uiSurface: 'navigation',
  },
  {
    id: 'modules-assign',
    capability: 'Assign modules to workspace',
    feWorkaround: 'Mock module list in dev',
    requiredApi: 'POST/DELETE /admin/group-rbac/groups/{id}/modules',
    feRequest: `POST /admin/group-rbac/groups/{group_id}/modules
{ "module_id": "chat" }

DELETE /admin/group-rbac/groups/{group_id}/modules/{module_id}`,
    expectedResponse: `200 { "module_id": "chat", "group_id": "group-uuid" }`,
    acceptance: 'Modules tab + auto-hide sidebar items by module',
    priority: 'P1',
    blockedFeatures: ['Modules tab', 'Module-filtered sidebar'],
    uiSurface: 'modules',
  },
  {
    id: 'invite-list-cancel',
    capability: 'List / cancel / resend pending invites',
    feWorkaround: 'Mock invite store',
    requiredApi: 'GET/DELETE /admin/group-rbac/groups/{id}/invites',
    feRequest: `GET /admin/group-rbac/groups/{group_id}/invites

DELETE /admin/group-rbac/groups/{group_id}/invites/{invite_id}

POST /admin/group-rbac/groups/{group_id}/invites/{invite_id}/resend`,
    expectedResponse: `200 [
  {
    "id": "invite-uuid",
    "email": "user@example.com",
    "role_name": "analyst",
    "status": "pending",
    "created_at": "ISO8601"
  }
]`,
    acceptance: 'Pending badge on People tab; cancel/resend actions',
    priority: 'P1',
    blockedFeatures: ['Pending invites table', 'People tab badge'],
    uiSurface: 'people',
  },
];

