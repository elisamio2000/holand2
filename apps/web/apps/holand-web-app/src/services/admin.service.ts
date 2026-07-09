// ============================================
// Holand Admin Service
// Handles user management, roles, permissions (admin endpoints)
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { mergePermissionLabels } from '@/app/shared/roles-permissions/utils';
import { dedupeAsync } from '@/utils/async-dedup';

/** Suppress global 403 toast when the page shows an inline access-denied state. */
const SKIP_ACCESS_DENIED_TOAST = { 'X-Skip-Access-Denied-Toast': '1' };
import type {
  UserInfo,
  UserCreate,
  UserUpdate,
  UserResponse,
  UserListResponse,
  RoleResponse,
  RoleCreate,
  RoleAssignRequest,
  RoleRevokeRequest,
  RoleUpdateRequest,
  RoleInfo,
  CreateCustomRoleRequest,
  CloneCustomRoleRequest,
  PermissionsMatrix,
  PermissionAssignRequest,
  SectionAssignRequest,
  RoleHierarchyUpdate,
  PermissionOverrideCreate,
  PermissionOverrideResponse,
  SystemStats,
  GroupResponse,
  GroupCreate,
  GroupUpdate,
  MembershipCreate,
  MembershipResponse,
  ModuleAssign,
  FileAssign,
  CaseAssign,
  FileOverrideCreate,
  FileOverrideResponse,
  SectionPermissionsUpdate,
  SectionPermissionsResponse,
  UserSession,
  UserPermissionsResponse,
  AllPermissionsResponse,
  PermissionMatrixResponse,
  RolePermissionsUpdate,
  UserPermissionUpdate,
  SystemSettingsResponse,
  RegistrationSettingsResponse,
  AppearanceSettingsResponse,
  SystemSettingItem,
  LLMSettingsResponse,
  BatchResolveResponse,
  SectionInfo,
  SectionCheckRequest,
  SectionCheckResponse,
  AccessCheckRequest,
  AccessCheckResponse,
  LiveRbacConfig,
  BulkPermissionsRequest,
  MyGroupMembership,
  EffectivePermissions,
} from '@/types/auth.types';

/**
 * Extract role name strings from the /roles/user/{id} response.
 *
 * Backend returns: { user_id: "...", roles: ["super-admin"] }
 * But may also return: string[] or RoleResponse[] â€” we handle all formats.
 *
 * @param rolesData - Raw response data from GET /roles/user/{id}
 * @returns Normalized array of role name strings
 */
function extractRoleNames(rolesData: unknown): string[] {
  // Format 1: Object with `roles` or `base_roles` (effective RBAC payload)
  if (typeof rolesData === 'object' && rolesData !== null && !Array.isArray(rolesData)) {
    const obj = rolesData as Record<string, unknown>;
    if (Array.isArray(obj.roles)) {
      return obj.roles.filter((r): r is string => typeof r === 'string');
    }
    if (Array.isArray(obj.base_roles)) {
      return obj.base_roles.filter((r): r is string => typeof r === 'string');
    }
  }

  // Format 2: Direct array â€” ["admin", "user"] or [{name: "admin"}, ...]
  if (Array.isArray(rolesData) && rolesData.length > 0) {
    return rolesData
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          if (typeof obj.name === 'string') return obj.name;
          if (typeof obj.role_name === 'string') return obj.role_name;
        }
        return null;
      })
      .filter((name): name is string => name !== null);
  }

  return [];
}

/**
 * Pick the highest-priority role from a list of role names.
 * Priority: super-admin > admin > analyst > user
 *
 * @param roleNames - Array of role name strings
 * @returns The highest-priority role, or 'user' if none match
 */
function pickHighestRole(roleNames: string[]): string {
  if (roleNames.length === 0) return 'user';
  const priority = ['super-admin', 'admin', 'analyst', 'user'];
  const sorted = [...roleNames].sort(
    (a, b) =>
      (priority.indexOf(a) === -1 ? 99 : priority.indexOf(a)) -
      (priority.indexOf(b) === -1 ? 99 : priority.indexOf(b))
  );
  return sorted[0];
}

export const adminService = {
  // ==========================================
  // Users (Gateway â€” /admin/users)
  // ==========================================

  /**
   * Get list of all users with optional pagination/search.
   *
   * @endpoint GET /admin/users
   * @param params.offset - Starting index (default: 0)
   * @param params.limit - Max results per page (default: 50)
   * @param params.search - Search by username or email
   * @returns Paginated list of users
   * @throws {AxiosError} 401 if token is invalid, 403 if not authorized
   *
   * NOTE: Backend returns UserInfo[] (plain array), not { users: [...] }.
   *       We normalize both formats for robustness.
   */
  async getUsers(params?: {
    offset?: number;
    limit?: number;
    search?: string;
  }): Promise<UserListResponse> {
    console.info('[AdminService] Fetching users:', { params });
    try {
      const res = await gatewayClient.get('/admin/users', { params });
      // Backend returns UserInfo[] (plain array) per API spec,
      // but we normalize to UserListResponse format for compatibility
      const data = res.data;
      if (Array.isArray(data)) {
        console.info('[AdminService] Users fetched (array format):', { count: data.length });
        return { users: data as UserResponse[], total: data.length };
      }
      // If backend wraps in { users: [...] } format
      const users = data?.users || [];
      console.info('[AdminService] Users fetched (object format):', { count: users.length });
      return { users, total: data?.total ?? users.length };
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch users:', { params, error });
      throw error;
    }
  },

  /**
   * Get a single user by ID (admin only).
   *
   * @endpoint GET /admin/users/{user_id}
   * @param userId - Keycloak user UUID
   * @returns User info object (UserInfo schema from backend)
   * @throws {AxiosError} 401 if unauthorized, 403 if not admin, 404 if not found
   *
   * NOTE: Backend returns UserInfo (id, username, email, role, is_active, created_at, last_login).
   *       We type it as UserResponse for frontend compatibility, but fields like
   *       display_name, avatar_url, permissions are NOT returned by this endpoint.
   *       For current user's profile, prefer GET /auth/me via authService.me().
   */
  async getUserById(userId: string): Promise<UserResponse> {
    console.info('[AdminService] Fetching user by ID:', { userId });
    try {
      const res = await gatewayClient.get<UserResponse>(`/admin/users/${userId}`);
      console.info('[AdminService] User fetched:', { userId, username: res.data?.username });
      return res.data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch user:', { userId, error });
      throw error;
    }
  },

  async updateUser(userId: string, data: UserUpdate): Promise<UserResponse> {
    const res = await gatewayClient.patch<UserResponse>(`/admin/users/${userId}`, data);
    return res.data;
  },

  async deleteUser(userId: string): Promise<void> {
    await gatewayClient.delete(`/admin/users/${userId}`);
  },

  async changeUserPassword(
    userId: string,
    data: { current_password: string; new_password: string }
  ): Promise<void> {
    await gatewayClient.post(`/admin/users/${userId}/change-password`, data);
  },

  // NOTE: Old resetPassword(data) removed â€” it called POST /admin/users/reset-password
  // which does NOT exist. Use resetAdminPassword(userId, newPassword) instead.

  // ==========================================
  // Roles (Gateway â€” /admin/roles)
  // ==========================================

  /**
   * Get all available roles.
   *
   * @endpoint GET /admin/roles
   * @returns Array of role objects
   *
   * NOTE: The API Gateway does NOT support an `include_user_count` query param.
   *       The old signature accepted `includeUserCount` but was silently ignored by the backend.
   *       The param has been removed to match the actual API contract.
   */
  async getRoles(): Promise<RoleResponse[]> {
    console.info('[AdminService] Fetching roles...');
    try {
      const res = await gatewayClient.get<RoleResponse[]>('/admin/roles');
      console.info('[AdminService] Roles fetched:', { count: res.data.length });
      return res.data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch roles:', error);
      throw error;
    }
  },

  async createRole(data: RoleCreate): Promise<RoleResponse> {
    const res = await gatewayClient.post<RoleResponse>('/admin/roles', data);
    return res.data;
  },

  async deleteRole(roleName: string): Promise<void> {
    await gatewayClient.delete(`/admin/roles/${roleName}`);
  },

  /**
   * Assign a role to a user.
   *
   * @endpoint POST /admin/roles/assign
   * @param userId - Keycloak user ID
   * @param data - Role assignment request with role_name
   * @throws {AxiosError} 400 if role doesn't exist, 401 if unauthorized
   */
  /**
   * Assign a role to a user via PATCH /admin/users/{user_id}.
   *
   * @endpoint PATCH /admin/users/{user_id}
   * @param userId - Keycloak user ID
   * @param data - Role assignment request with role_name
   *
   * NOTE: There is NO /admin/roles/assign endpoint in the API Gateway.
   *       Role changes go through PATCH /admin/users/{user_id} with role_name in body.
   */
  async assignRole(
    userId: string,
    data: RoleAssignRequest
  ): Promise<void> {
    console.info('[AdminService] Assigning role via PATCH /admin/users:', { userId, role: data.role_name });
    try {
      // âœ… Correct endpoint: PATCH /admin/users/{id} with role_name in body
      await gatewayClient.patch(`/admin/users/${userId}`, {
        role_name: data.role_name,
      });
      console.info('[AdminService] Role assigned:', { userId, role: data.role_name });
    } catch (error: unknown) {
      console.error('[AdminService] Failed to assign role:', { userId, data, error });
      throw error;
    }
  },

  /**
   * Revoke a role from a user.
   *
   * @endpoint POST /admin/roles/revoke
   * @param userId - Keycloak user ID
   * @param data - Role revoke request with role_name
   * @throws {AxiosError} 400 if role not assigned, 401 if unauthorized
   */
  /**
   * Remove a role from a user.
   *
   * @endpoint PATCH /admin/users/{user_id}
   * @param userId - Keycloak user UUID
   * @param data - RoleAssignRequest (role_name field is cleared / set to empty)
   *
   * NOTE: The API Gateway has NO /admin/roles/revoke, /admin/roles/remove, or
   *       DELETE /admin/roles/user endpoints. Role changes (including clearing a role)
   *       are done via PATCH /admin/users/{user_id} with role_name set to empty string.
   */
  async removeRole(
    userId: string,
    data: RoleAssignRequest
  ): Promise<void> {
    console.info('[AdminService] Removing role via PATCH /admin/users:', { userId, role: data.role_name });
    try {
      // âœ… Correct: role removal goes through PATCH user with empty role_name
      await gatewayClient.patch(`/admin/users/${userId}`, { role_name: '' });
      console.info('[AdminService] Role removed:', { userId, previousRole: data.role_name });
    } catch (error: unknown) {
      console.error('[AdminService] Failed to remove role:', { userId, data, error });
      throw error;
    }
  },

  /**
   * Remove a role from a user by name.
   *
   * @endpoint PATCH /admin/users/{user_id}
   * @param userId - Keycloak user UUID
   * @param roleName - Role name being removed (for logging only â€” cleared via empty string)
   *
   * NOTE: DELETE /admin/roles/user/{userId}/{roleName} does NOT exist in the API Gateway.
   *       This method delegates to PATCH /admin/users/{user_id}.
   */
  async deleteUserRole(userId: string, roleName: string): Promise<void> {
    console.info('[AdminService] Clearing role from user via PATCH /admin/users:', { userId, roleName });
    try {
      // âœ… Correct: no dedicated delete-role endpoint; clear via PATCH user
      await gatewayClient.patch(`/admin/users/${userId}`, { role_name: '' });
      console.info('[AdminService] Role cleared from user:', { userId, roleName });
    } catch (error: unknown) {
      console.error('[AdminService] Failed to delete user role:', { userId, roleName, error });
      throw error;
    }
  },

  /**
   * Remove a role from a user â€” alias for deleteUserRole.
   *
   * @endpoint PATCH /admin/users/{user_id}
   * @param userId - Keycloak user UUID
   * @param roleName - Role name being removed (for logging only)
   *
   * NOTE: POST /admin/roles/remove does NOT exist in the API Gateway.
   *       Role removal goes through PATCH /admin/users/{user_id}.
   */
  async removeRoleFromUser(userId: string, roleName: string): Promise<void> {
    console.info('[AdminService] Removing role via PATCH /admin/users:', { userId, roleName });
    try {
      // âœ… Correct: delegate to PATCH user endpoint
      await gatewayClient.patch(`/admin/users/${userId}`, { role_name: '' });
      console.info('[AdminService] Role removed:', { userId, roleName });
    } catch (error: unknown) {
      console.error('[AdminService] Failed to remove role:', { userId, roleName, error });
      throw error;
    }
  },

  /**
   * Update a role's permissions via the permissions/assign endpoint.
   *
   * NOTE: PUT /admin/roles/{role_name} does NOT exist in the API Gateway.
   *       Role description cannot be updated via the API.
   *       Permission changes must go through POST /admin/rbac/permissions/assign.
   *
   * @endpoint POST /admin/rbac/permissions/assign (for each permission change)
   * @param roleName - Role name to update
   * @param data - Fields to update (only `permissions` array is supported)
   * @returns Partial RoleResponse (name only â€” no server round-trip for description)
   */
  async updateRole(
    roleName: string,
    data: RoleUpdateRequest
  ): Promise<RoleResponse> {
    console.info('[AdminService] Updating role permissions:', { roleName, data });
    try {
      // Apply each permission change individually via assign endpoint
      if (data.permissions && data.permissions.length > 0) {
        await Promise.all(
          data.permissions.map((perm) =>
            gatewayClient.post('/admin/rbac/permissions/assign', {
              role: roleName,
              permission: perm,
              action: 'add',
            })
          )
        );
      }
      console.info('[AdminService] Role permissions updated:', { roleName });
      // Return a synthetic RoleResponse since there's no GET-after-PUT
      return { name: roleName, description: data.description || '', permissions: data.permissions || [] } as RoleResponse;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to update role:', { roleName, error });
      throw error;
    }
  },

  /**
   * Get all role names for a user.
   *
   * @endpoint GET /admin/rbac/user/{user_id}
   * @param userId - Keycloak user ID
   * @returns Normalized array of role name strings
   *
   * NOTE: Uses GET /admin/rbac/user/{user_id} which returns RBAC info including roles.
   *       The previous /admin/roles/user/{id} does NOT exist in the API Gateway.
   */
  async getUserRoles(userId: string): Promise<string[]> {
    console.info('[AdminService] Fetching user roles:', { userId });
    // âœ… Correct endpoint: GET /admin/rbac/user/{user_id} (exists in API Gateway)
    const res = await gatewayClient.get(`/admin/rbac/user/${userId}`);
    console.debug('[AdminService] Raw RBAC response:', { userId, data: res.data });
    const names = extractRoleNames(res.data);
    console.info('[AdminService] User roles resolved:', { userId, roles: names });
    return names;
  },

  // ==========================================
  // RBAC (Gateway â€” /admin/rbac/)
  // ==========================================

  async fetchPermissionsMatrix(): Promise<PermissionsMatrix> {
    return this.getPermissionsMatrix();
  },

  /**
   * Get role hierarchy with numeric levels.
   *
   * @endpoint GET /rbac/roles/hierarchy
   * @returns Flat map of role_name â†’ level (e.g. { "admin": 80 })
   *
   * NOTE: Backend wraps response in { hierarchy: {...}, custom_roles: {...} }
   *       so we unwrap to return just the hierarchy map.
   */
  async getRoleHierarchy(): Promise<Record<string, number>> {
    const res = await gatewayClient.get<{ hierarchy: Record<string, number>; custom_roles?: Record<string, unknown> }>(
      '/admin/rbac/roles/hierarchy'
    );
    // Backend wraps in { hierarchy: {...} } â€” unwrap to flat map
    return res.data.hierarchy || res.data;
  },

  async updateRoleHierarchy(data: RoleHierarchyUpdate): Promise<void> {
    await gatewayClient.put('/admin/rbac/roles/hierarchy', data);
  },

  async assignPermission(data: PermissionAssignRequest): Promise<void> {
    await gatewayClient.post('/admin/rbac/permissions/assign', data);
  },

  async assignSection(data: SectionAssignRequest): Promise<void> {
    await gatewayClient.post('/admin/rbac/sections/assign', data);
  },

  // ---- Custom Roles ----

  /**
   * Get all custom roles.
   *
   * @endpoint GET /rbac/custom-roles
   * @returns Array of custom role objects
   *
   * NOTE: Backend returns { custom_roles: {} } â€” we unwrap and convert to array.
   */
  async getCustomRoles(): Promise<any[]> {
    const res = await gatewayClient.get('/admin/rbac/custom-roles');
    // Backend wraps in { custom_roles: {...} } â€” unwrap
    const data = res.data?.custom_roles || res.data;
    return Array.isArray(data) ? data : Object.values(data || {});
  },

  async createCustomRole(data: CreateCustomRoleRequest): Promise<void> {
    await gatewayClient.post('/admin/rbac/custom-roles', data);
  },

  /**
   * Clone an existing role into a new custom role.
   * @endpoint POST /admin/rbac/custom-roles/clone
   */
  async cloneCustomRole(data: CloneCustomRoleRequest): Promise<void> {
    console.info('[AdminService] Cloning custom role:', {
      source: data.source_role,
      name: data.name,
    });
    await gatewayClient.post('/admin/rbac/custom-roles/clone', data);
  },

  async deleteCustomRole(roleName: string): Promise<void> {
    await gatewayClient.delete(`/admin/rbac/custom-roles/${roleName}`);
  },

  // ---- Permission Overrides ----

  async getPermissionOverrides(): Promise<PermissionOverrideResponse[]> {
    const res = await gatewayClient.get<PermissionOverrideResponse[]>(
      '/admin/group-rbac/overrides/permissions'
    );
    return res.data;
  },

  async createPermissionOverride(
    data: PermissionOverrideCreate
  ): Promise<PermissionOverrideResponse> {
    const res = await gatewayClient.post<PermissionOverrideResponse>(
      '/admin/group-rbac/overrides/permissions',
      data
    );
    return res.data;
  },

  // ==========================================
  // Admin Users (Gateway â€” /admin/users)
  // ==========================================

  /**
   * Get all users with their real roles resolved from Keycloak.
   *
   * @endpoint GET /admin/users
   * @endpoint GET /admin/roles/user/{user_id} â€” batch-called for users with null role
   * @returns List of users with resolved roles
   *
   * NOTE: Auth Service UserResponse may return role=null even for admin users
   *       because role is stored in Keycloak, not in the user record field.
   *       We batch-resolve roles from GET /admin/roles/user/{id} to get accurate data.
   */
  async getAdminUsers(): Promise<UserInfo[]> {
    console.info('[AdminService] Fetching admin users...');
    const res = await gatewayClient.get('/admin/users');
    // âš ï¸ Backend returns UserInfo[] (plain array), NOT { users: [...] }
    // Handle both formats for robustness
    const rawUsers: any[] = Array.isArray(res.data)
      ? res.data
      : (res.data?.users || []);
    console.info('[AdminService] Users fetched:', { count: rawUsers.length });

    const validUsers = rawUsers.filter(
      (u: any) => u?.id && String(u.id).length > 10
    );
    if (validUsers.length < rawUsers.length) {
      console.warn('[AdminService] Filtered invalid user rows:', {
        dropped: rawUsers.length - validUsers.length,
      });
    }

    // Use the role field directly from UserInfo (exists in API schema).
    // Only call /admin/rbac/user/{id} for users where role is null/missing,
    // to avoid the N+1 problem and avoid calling non-existent /admin/roles/user/{id}.
    const usersWithNullRole = validUsers.filter((u: any) => !u.role);
    const resolvedRoles: Record<string, string> = {};

    if (usersWithNullRole.length > 0) {
      console.info('[AdminService] Resolving roles for users with null role:', { count: usersWithNullRole.length });
      const roleResults = await Promise.allSettled(
        // âœ… Correct endpoint: GET /admin/rbac/user/{user_id} (exists in API Gateway)
        usersWithNullRole.map((u: any) => gatewayClient.get(`/admin/rbac/user/${u.id}`))
      );
      roleResults.forEach((result, i) => {
        const userId = usersWithNullRole[i].id;
        if (result.status === 'fulfilled') {
          const rolesData = result.value.data;
          const roleNames = extractRoleNames(rolesData);
          if (roleNames.length > 0) {
            resolvedRoles[userId] = pickHighestRole(roleNames);
          }
        } else {
          console.warn('[AdminService] Could not resolve role for user:', {
            username: usersWithNullRole[i].username,
            userId,
          });
        }
      });
    }

    console.info('[AdminService] Users ready:', {
      total: validUsers.length,
      nullRolesResolved: Object.keys(resolvedRoles).length,
    });

    return validUsers.map((u: any) => ({
      id: u.id,
      username: u.username,
      email: u.email ?? null,
      // Use role from response directly, fallback to resolved (for null-role users), then 'user'
      role: u.role || resolvedRoles[u.id] || 'user',
      is_active: u.is_active ?? true,
      created_at: u.created_at || null,
      last_login: u.last_login ?? null,
    }));
  },

  /**
   * Create a new user via Auth Service.
   *
   * @endpoint POST /admin/users
   * @param data - User creation data (username, email, password, role_name)
   * @returns Created user info with resolved role
   * @throws {AxiosError} 400 if username/email already exists, 401 if unauthorized
   */
  async createUser(data: UserCreate): Promise<UserInfo> {
    console.info('[AdminService] Creating user:', { username: data.username, email: data.email, role: data.role_name });
    try {
      const res = await gatewayClient.post<UserInfo>(
        '/admin/users',
        {
          username: data.username,
          email: data.email,
          password: data.password,
          role_name: data.role_name || 'user',
        }
      );

      console.info('[AdminService] User created (raw response):', { id: res.data.id, username: res.data.username, status: res.status });

      return {
        id: res.data.id,
        username: res.data.username,
        email: res.data.email ?? data.email,
        role: res.data.role ?? data.role_name ?? 'user',
        is_active: res.data.is_active ?? true,
        created_at: res.data.created_at ?? new Date().toISOString(),
        last_login: res.data.last_login ?? null,
      };
    } catch (error: unknown) {
      console.error('[AdminService] Failed to create user:', { username: data.username, error });
      throw error;
    }
  },

  /**
   * Get single user by ID with resolved role.
   *
   * @endpoint GET /admin/users/{user_id}
   * @endpoint GET /admin/roles/user/{user_id}
   * @param userId - Keycloak user UUID
   * @returns User info with resolved role
   */
  async getAdminUserById(userId: string): Promise<UserInfo> {
    console.info('[AdminService] Fetching user by ID:', { userId });
    const [userRes, rbacRes] = await Promise.allSettled([
      gatewayClient.get(`/admin/users/${userId}`),
      // âœ… Correct endpoint: GET /admin/rbac/user/{user_id} (exists in API Gateway)
      // Used only if the user object has no role field
      gatewayClient.get(`/admin/rbac/user/${userId}`),
    ]);

    if (userRes.status === 'rejected') {
      console.error('[AdminService] Failed to fetch user:', { userId, error: userRes.reason });
      throw userRes.reason;
    }

    const u = userRes.value.data;
    // Use role from user object first; fallback to /admin/rbac/user/{id}
    let resolvedRole = u.role || 'user';

    if (!u.role && rbacRes.status === 'fulfilled') {
      const rolesData = rbacRes.value.data;
      const roleNames = extractRoleNames(rolesData);
      if (roleNames.length > 0) {
        resolvedRole = pickHighestRole(roleNames);
      }
    }

    console.info('[AdminService] User fetched:', { userId, role: resolvedRole });
    return {
      id: u.id,
      username: u.username,
      email: u.email ?? null,
      role: resolvedRole,
      is_active: u.is_active ?? true,
      created_at: u.created_at || null,
      last_login: u.last_login ?? null,
    };
  },

  /**
   * Update user fields and optionally reassign role.
   *
   * @endpoint PATCH /admin/users/{user_id}
   * @param userId - Keycloak user UUID
   * @param data - Fields to update: email, is_active, role_name (ONLY these 3 per API spec)
   * @returns Updated user info with optional _warnings array
   * @throws {Error} If user update fails
   *
   * NOTE: UserUpdate API schema accepts ONLY: email, is_active, role_name.
   *       display_name and bio are NOT supported by the API Gateway UserUpdate schema.
   *       Sending unsupported fields may cause 422 Unprocessable Entity errors.
   */
  async updateAdminUser(
    userId: string,
    data: { email?: string; is_active?: boolean; role_name?: string }
  ): Promise<UserInfo & { _warnings?: string[] }> {
    console.info('[AdminService] Updating user:', { userId, data });

    // Build payload for PATCH /admin/users/{user_id}
    // UserUpdate API schema accepts ONLY: email, is_active, role_name
    const payload: Record<string, unknown> = {};
    if (data.email !== undefined && data.email.trim()) payload.email = data.email.trim();
    if (data.is_active !== undefined) payload.is_active = data.is_active;
    if (data.role_name !== undefined) payload.role_name = data.role_name;

    if (Object.keys(payload).length === 0) {
      console.warn('[AdminService] No fields to update, skipping API call');
      throw new Error('No changes to save');
    }

    const warnings: string[] = [];
    let updatedUser: Record<string, unknown> = {};

    console.info('[AdminService] PATCH /admin/users payload:', JSON.stringify(payload));
    try {
      const res = await gatewayClient.patch<Record<string, unknown>>(
        `/admin/users/${userId}`,
        payload
      );
      updatedUser = res.data;
      console.info('[AdminService] User updated successfully:', { userId });

      // Detect if is_active was silently ignored by backend (known Keycloak mapping issue)
      if (
        data.is_active !== undefined &&
        updatedUser.is_active !== data.is_active
      ) {
        console.warn('[AdminService] is_active change was ignored by backend:', {
          sent: data.is_active,
          returned: updatedUser.is_active,
        });
        warnings.push(
          'Active status change was not applied. This is a known backend limitation.'
        );
      }
    } catch (error: unknown) {
      console.error('[AdminService] Failed to update user:', { userId, payload, error });
      throw error;
    }

    return {
      id: (updatedUser.id as string) ?? userId,
      username: (updatedUser.username as string) ?? '',
      email: (updatedUser.email as string) ?? null,
      role: (updatedUser.role as string) ?? data.role_name ?? 'user',
      is_active: (updatedUser.is_active as boolean) ?? true,
      created_at: (updatedUser.created_at as string) || null,
      last_login: (updatedUser.last_login as string) ?? null,
      _warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  /**
   * Delete a user via Auth Service.
   *
   * Auth Service DELETE /admin/users/{user_id} handles both Keycloak account removal
   * and Auth DB record cleanup in a single call.
   *
   * @endpoint DELETE /admin/users/{user_id}
   * @param userId - Keycloak user UUID
   * @throws {Error} If delete fails
   */
  async deleteAdminUser(userId: string): Promise<void> {
    console.info('[AdminService] Deleting user:', { userId });
    try {
      const res = await gatewayClient.delete(`/admin/users/${userId}`);
      console.info('[AdminService] User deleted successfully:', {
        userId,
        status: res.status,
      });
    } catch (error: unknown) {
      const err = error as any;
      if (err?.response?.status === 404) {
        // User already deleted â€” treat as success
        console.info('[AdminService] User already deleted (404):', { userId });
        return;
      }
      console.error('[AdminService] Failed to delete user:', {
        userId,
        status: err?.response?.status,
        detail: err?.response?.data?.detail,
        error,
      });
      throw error;
    }
  },

  /**
   * Reset a user's password.
   *
   * @endpoint POST /admin/users/{user_id}/reset-password?new_password=...
   * @param userId - Keycloak user UUID
   * @param newPassword - New password string
   * @throws {AxiosError} 401 if unauthorized, 403 if not super-admin
   */
  async resetAdminPassword(
    userId: string,
    newPassword: string
  ): Promise<void> {
    console.info('[AdminService] Resetting password for user:', { userId });
    try {
      // âœ… Correct endpoint: POST /admin/users/{user_id}/reset-password?new_password=...
      // API spec: new_password is a QUERY PARAM (not request body).
      // Sending {} as body instead of null to avoid Axios serializing null as "null" string.
      await gatewayClient.post(
        `/admin/users/${userId}/reset-password`,
        {},
        { params: { new_password: newPassword } }
      );
      console.info('[AdminService] Password reset successful:', { userId });
    } catch (error: unknown) {
      console.error('[AdminService] Failed to reset password:', { userId, error });
      throw error;
    }
  },

  // ---- Admin Roles (Gateway â€” /admin/roles) ----

  async getAdminRoles(): Promise<RoleInfo[]> {
    const res = await gatewayClient.get<RoleResponse[]>('/admin/roles');
    // Map RoleResponse â†’ RoleInfo
    return res.data.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      permissions: r.permissions ?? [],
      is_system: r.is_system ?? false,
    }));
  },

  async createAdminRole(data: RoleCreate): Promise<RoleInfo> {
    const res = await gatewayClient.post<RoleResponse>('/admin/roles', data);
    const r = res.data;
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      permissions: r.permissions ?? [],
      is_system: r.is_system ?? false,
    };
  },

  /**
   * Delete a role by name.
   *
   * @endpoint DELETE /admin/roles/{role_name}
   * @param roleName - Role name string (NOT UUID)
   *
   * NOTE: Swagger defines the path param as {role_name} not {role_id}.
   */
  async deleteAdminRole(roleName: string): Promise<void> {
    console.info('[AdminService] Deleting role:', { roleName });
    try {
      await gatewayClient.delete(`/admin/roles/${roleName}`);
      console.info('[AdminService] Role deleted:', { roleName });
    } catch (error: unknown) {
      console.error('[AdminService] Failed to delete role:', { roleName, error });
      throw error;
    }
  },

  // ---- Stats (Gateway only â€” may return 404 when talking to Auth Service) ----

  /**
   * Get system-wide stats.
   *
   * @endpoint GET /admin/stats (Gateway :8000)
   * @returns System statistics (users, sessions, messages, active users)
   */
  async getStats(): Promise<SystemStats> {
    console.info('[AdminService] Fetching system stats...');
    try {
      const res = await gatewayClient.get<SystemStats>('/admin/stats');
      console.info('[AdminService] Stats fetched:', res.data);
      return res.data;
    } catch (error: unknown) {
      console.error('[AdminService] Stats endpoint failed:', error);
      throw error;
    }
  },

  // ==========================================
  // Groups (Gateway â€” /admin/group-rbac/)
  // ==========================================

  /**
   * List all groups.
   *
   * @endpoint GET /admin/group-rbac/groups
   * @returns Array of group objects
   *
   * NOTE: The live API spec only accepts an `authorization` header parameter.
   *       The old `active_only` query param was not in the spec and has been removed.
   */
  async getGroups(): Promise<GroupResponse[]> {
    console.info('[AdminService] Fetching groups...');
    try {
      const res = await gatewayClient.get<GroupResponse[]>('/admin/group-rbac/groups');
      console.info('[AdminService] Groups fetched:', { count: res.data.length });
      return res.data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch groups:', error);
      throw error;
    }
  },

  async getGroup(groupId: string): Promise<GroupResponse> {
    const res = await gatewayClient.get<GroupResponse>(
      `/admin/group-rbac/groups/${groupId}`
    );
    return res.data;
  },

  async createGroup(data: GroupCreate): Promise<GroupResponse> {
    const res = await gatewayClient.post<GroupResponse>('/admin/group-rbac/groups', data);
    return res.data;
  },

  async updateGroup(
    groupId: string,
    data: GroupUpdate
  ): Promise<GroupResponse> {
    const res = await gatewayClient.put<GroupResponse>(
      `/admin/group-rbac/groups/${groupId}`,
      data
    );
    return res.data;
  },

  async deleteGroup(groupId: string): Promise<void> {
    await gatewayClient.delete(`/admin/group-rbac/groups/${groupId}`);
  },

  // ---- Group Members ----

  async getGroupMembers(groupId: string): Promise<MembershipResponse[]> {
    const res = await gatewayClient.get<MembershipResponse[]>(
      `/admin/group-rbac/groups/${groupId}/members`
    );
    return res.data;
  },

  async addGroupMember(
    groupId: string,
    data: MembershipCreate
  ): Promise<MembershipResponse> {
    const res = await gatewayClient.post<MembershipResponse>(
      `/admin/group-rbac/groups/${groupId}/members`,
      data
    );
    return res.data;
  },

  async updateMemberRole(
    groupId: string,
    userId: string,
    roleName: string
  ): Promise<void> {
    await gatewayClient.put(
      `/admin/group-rbac/groups/${groupId}/members/${userId}`,
      { user_id: userId, role_name: roleName }
    );
  },

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    await gatewayClient.delete(`/admin/group-rbac/groups/${groupId}/members/${userId}`);
  },

  // ---- Group Modules ----

  async getGroupModules(groupId: string): Promise<any[]> {
    const res = await gatewayClient.get(`/admin/group-rbac/groups/${groupId}/modules`);
    return res.data;
  },

  async assignModuleToGroup(
    groupId: string,
    data: ModuleAssign
  ): Promise<void> {
    await gatewayClient.post(`/admin/group-rbac/groups/${groupId}/modules`, data);
  },

  async removeModuleFromGroup(
    groupId: string,
    moduleId: string
  ): Promise<void> {
    await gatewayClient.delete(
      `/admin/group-rbac/groups/${groupId}/modules/${moduleId}`
    );
  },

  // ---- Group Files ----

  async getGroupFiles(groupId: string): Promise<any[]> {
    const res = await gatewayClient.get(`/admin/group-rbac/groups/${groupId}/files`);
    return res.data;
  },

  async assignFileToGroup(groupId: string, data: FileAssign): Promise<void> {
    await gatewayClient.post(`/admin/group-rbac/groups/${groupId}/files`, data);
  },

  async removeFileFromGroup(
    groupId: string,
    artifactId: string
  ): Promise<void> {
    await gatewayClient.delete(
      `/admin/group-rbac/groups/${groupId}/files/${artifactId}`
    );
  },

  // ---- Group Cases ----

  async getGroupCases(groupId: string): Promise<any[]> {
    const res = await gatewayClient.get(`/admin/group-rbac/groups/${groupId}/cases`);
    return res.data;
  },

  async assignCaseToGroup(groupId: string, data: CaseAssign): Promise<void> {
    await gatewayClient.post(`/admin/group-rbac/groups/${groupId}/cases`, data);
  },

  async removeCaseFromGroup(
    groupId: string,
    caseId: string
  ): Promise<void> {
    await gatewayClient.delete(`/admin/group-rbac/groups/${groupId}/cases/${caseId}`);
  },

  // ---- User Groups ----

  async getUserGroups(userId: string): Promise<any[]> {
    const res = await gatewayClient.get(`/admin/group-rbac/users/${userId}/groups`);
    return res.data;
  },

  /**
   * Get all groups the current authenticated user belongs to.
   *
   * Uses the user's token to determine identity â€” no user ID needed.
   *
   * @endpoint GET /admin/group-rbac/my-groups
   * @returns Array of group membership records with group info
   * @throws {AxiosError} 401 if unauthorized
   */
  async getMyGroups(): Promise<MyGroupMembership[]> {
    // âš ï¸ /admin/group-rbac/my-groups does not exist in API Gateway.
    // Uses GET /admin/group-rbac/effective to get current user's effective permissions
    // and extracts group membership info from the response.
    console.warn('[AdminService] getMyGroups: /admin/group-rbac/my-groups not available â€” using /admin/group-rbac/effective');
    console.info('[AdminService] Fetching current user groups via effective permissions...');
    try {
      const res = await gatewayClient.get('/admin/group-rbac/effective');
      const data = res.data;
      // Effective response may contain a groups or group_memberships array
      const groups: MyGroupMembership[] = Array.isArray(data?.groups)
        ? data.groups
        : Array.isArray(data?.group_memberships)
          ? data.group_memberships
          : [];
      console.info('[AdminService] Current user groups fetched:', {
        count: groups.length,
        groupNames: groups.map((g) => g.group_name),
      });
      return groups;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch current user groups:', error);
      throw error;
    }
  },

  /**
   * Get a user's group memberships (internal endpoint).
   *
   * This is an internal/admin endpoint for fetching any user's groups.
   * For the current user's groups, use getMyGroups() instead.
   *
   * @endpoint GET /admin/group-rbac/internal/user-groups/{user_id}
   * @param userId - Keycloak user UUID
   * @returns Array of group membership objects
   * @throws {AxiosError} 401 if unauthorized, 404 if user not found
   */
  async getInternalUserGroups(userId: string): Promise<MyGroupMembership[]> {
    // âš ï¸ /admin/group-rbac/internal/user-groups/{id} does not exist in API Gateway.
    // Uses GET /admin/group-rbac/users/{user_id}/groups instead.
    console.info('[AdminService] Fetching user groups:', { userId });
    try {
      const res = await gatewayClient.get<MyGroupMembership[]>(
        `/admin/group-rbac/users/${userId}/groups`
      );
      const groups = Array.isArray(res.data) ? res.data : [];
      console.info('[AdminService] User groups fetched:', {
        userId,
        count: groups.length,
      });
      return groups;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch user groups:', { userId, error });
      throw error;
    }
  },

  // ==========================================
  // Section Permissions (RBAC)
  // ==========================================

  async getSectionPermissions(): Promise<SectionPermissionsResponse> {
    const res = await gatewayClient.get('/admin/rbac/sections/permissions');
    return res.data as SectionPermissionsResponse;
  },

  async updateSectionPermissions(
    data: SectionPermissionsUpdate
  ): Promise<void> {
    await gatewayClient.put('/admin/rbac/sections/permissions', data);
  },

  async getAllPermissions(): Promise<Record<string, string[]>> {
    const res = await gatewayClient.get('/admin/rbac/permissions');
    return res.data;
  },

  async getRateLimits(): Promise<Record<string, any>> {
    const res = await gatewayClient.get('/admin/rbac/rate-limits');
    return res.data;
  },

  // ---- RBAC Config Management ----

  /**
   * GET /admin/rbac/config â€” Get RBAC configuration (roles, permissions, sections)
   */
  async getRbacConfig(): Promise<any> {
    const res = await gatewayClient.get('/admin/rbac/config');
    return res.data;
  },

  /**
   * PUT /admin/rbac/config â€” Update RBAC configuration
   */
  async updateRbacConfig(config: Record<string, any>): Promise<void> {
    await gatewayClient.put('/admin/rbac/config', config);
  },

  /**
   * POST /admin/rbac/config/export â€” Export full RBAC config as JSON
   */
  async exportRbacConfig(): Promise<any> {
    const res = await gatewayClient.post('/admin/rbac/config/export');
    return res.data;
  },

  /**
   * POST /admin/rbac/config/import â€” Import RBAC config from JSON
   */
  async importRbacConfig(config: Record<string, any>, merge = false): Promise<any> {
    const res = await gatewayClient.post('/admin/rbac/config/import', { config, merge });
    return res.data;
  },

  /**
   * POST /admin/rbac/config/reset â€” Reset RBAC config to defaults
   */
  async resetRbacConfig(): Promise<void> {
    await gatewayClient.post('/admin/rbac/config/reset');
  },

  /**
   * POST /admin/rbac/cache/invalidate â€” Invalidate RBAC cache
   */
  async invalidateRbacCache(): Promise<void> {
    await gatewayClient.post('/admin/rbac/cache/invalidate');
  },

  /**
   * Get live (runtime) RBAC configuration.
   *
   * Unlike /rbac/config which may return cached data, /rbac/config/live
   * reflects the current runtime RBAC state including any hot-reloaded changes.
   *
   * @endpoint GET /admin/rbac/config/live
   * @returns Live RBAC config with role_permissions, section_permissions, hierarchy, etc.
   * @throws {AxiosError} 401 if unauthorized
   */
  async getLiveRbacConfig(): Promise<LiveRbacConfig> {
    // âš ï¸ /admin/rbac/config/live does not exist in API Gateway.
    // Falls back to GET /admin/rbac/config (static config) with a warning.
    console.warn('[AdminService] getLiveRbacConfig: /admin/rbac/config/live not available â€” using /admin/rbac/config as fallback');
    console.info('[AdminService] Fetching RBAC config (live fallback)...');
    try {
      // Backend may wrap response in { config: {...} } â€” handle both shapes
      const res = await gatewayClient.get<LiveRbacConfig & { config?: LiveRbacConfig }>('/admin/rbac/config');
      const data: LiveRbacConfig = res.data.config ?? res.data;
      console.info('[AdminService] RBAC config fetched (live fallback):', {
        roleCount: Object.keys(data?.role_hierarchy || {}).length,
      });
      return data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch RBAC config (live fallback):', error);
      throw error;
    }
  },

  /**
   * Bulk update multiple permissions at once.
   *
   * More efficient than calling /rbac/permissions/assign for each change individually.
   *
   * @endpoint PUT /admin/rbac/permissions/bulk
   * @param changes - Array of { role, permission, action } changes
   * @throws {AxiosError} 401 if unauthorized, 403 if not admin
   */
  async bulkUpdatePermissions(changes: BulkPermissionsRequest['changes']): Promise<void> {
    // âš ï¸ PUT /admin/rbac/permissions/bulk does not exist in API Gateway.
    // Simulates bulk by calling POST /admin/rbac/permissions/assign for each change in parallel.
    console.warn('[AdminService] bulkUpdatePermissions: bulk endpoint not available â€” executing sequential POST /admin/rbac/permissions/assign calls');
    console.info('[AdminService] Bulk updating permissions via sequential calls:', { count: changes.length });
    try {
      await Promise.all(
        changes.map((change) =>
          gatewayClient.post('/admin/rbac/permissions/assign', {
            role: change.role,
            permission: change.permission,
            action: change.action, // 'grant' or 'revoke'
          })
        )
      );
      console.info('[AdminService] Bulk permission update complete:', { count: changes.length });
    } catch (error: unknown) {
      console.error('[AdminService] Failed to bulk update permissions:', { count: changes.length, error });
      throw error;
    }
  },

  // ---- Route Permissions ----

  /**
   * GET /admin/rbac/routes/permissions â€” Get route-level permissions
   */
  async getRoutePermissions(): Promise<Record<string, any>> {
    const res = await gatewayClient.get('/admin/rbac/routes/permissions');
    return res.data;
  },

  /**
   * PUT /admin/rbac/routes/permissions â€” Update route-level permissions
   */
  async updateRoutePermissions(data: Record<string, any>): Promise<void> {
    await gatewayClient.put('/admin/rbac/routes/permissions', data);
  },

  /**
   * PUT /admin/rbac/rate-limits â€” Update rate limits
   */
  async updateRateLimits(data: Record<string, any>): Promise<void> {
    await gatewayClient.put('/admin/rbac/rate-limits', data);
  },

  // ---- Events & Audit Log ----

  /**
   * GET /admin/events/types â€” List available event types.
   *
   * @endpoint GET /admin/events/types
   * @returns Array of event type strings
   * @throws {AxiosError} 403 if not authorized, 404 if endpoint unavailable
   *
   * NOTE: Backend may return non-array or wrapped data â€” always normalize to string[].
   */
  async getEventTypes(): Promise<string[]> {
    console.info('[AdminService] Fetching event types...');
    try {
      const res = await gatewayClient.get('/admin/events/types');
      const data = res.data;
      // Normalize: backend may return { event_types: [...] } or [...] or other shapes
      const types = Array.isArray(data)
        ? data
        : Array.isArray(data?.event_types)
          ? data.event_types
          : Array.isArray(data?.types)
            ? data.types
            : [];
      console.info('[AdminService] Event types fetched:', { count: types.length });
      return types.filter((t: unknown): t is string => typeof t === 'string');
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch event types:', error);
      throw error;
    }
  },

  /**
   * Get user events (login, logout, etc.) or admin events log.
   *
   * Routes to the correct endpoint based on whether a user ID is provided:
   * - With user: GET /admin/events/user/{user_id}?event_type=&first=&max=
   * - Without user: GET /admin/events/admin?first=&max=
   *
   * @endpoint GET /admin/events/user/{user_id} | GET /admin/events/admin
   * @param params.user - User ID to fetch events for (optional)
   * @param params.type - Filter by event type (optional)
   * @param params.first - Pagination offset (default 0)
   * @param params.max - Max results (default 100)
   * @returns Array of event objects
   * @throws {AxiosError} 401 if unauthorized
   */
  async getUserEvents(params?: {
    type?: string;
    user?: string;
    dateFrom?: string;
    dateTo?: string;
    first?: number;
    max?: number;
  }): Promise<any[]> {
    console.info('[AdminService] Fetching user events:', { params });
    try {
      let res;
      if (params?.user) {
        // GET /admin/events/user/{user_id} â€” per-user event log
        const { user, type, first, max } = params;
        res = await gatewayClient.get(`/admin/events/user/${user}`, {
          params: { event_type: type, first: first ?? 0, max: max ?? 100 },
        });
      } else {
        // Realm-wide user events (login/logout/register)
        res = await gatewayClient.get('/admin/events/user', {
          params: { first: params?.first ?? 0, max: params?.max ?? 100, type: params?.type },
        });
      }
      const payload = res.data;
      const data = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.events)
          ? payload.events
          : [];
      console.info('[AdminService] User events fetched:', { count: data.length });
      return data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch user events:', { params, error });
      throw error;
    }
  },

  /**
   * GET /admin/events/admin â€” Get admin audit events
   */
  async getAdminEvents(params?: {
    operation?: string[];
    resourceType?: string[];
    authUser?: string;
    dateFrom?: string;
    dateTo?: string;
    first?: number;
    max?: number;
  }): Promise<any[]> {
    const res = await gatewayClient.get('/admin/events/admin', { params });
    const payload = res.data;
    return Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.events)
        ? payload.events
        : [];
  },

  /**
   * GET /admin/events/config â€” Get events configuration
   */
  async getEventsConfig(): Promise<any> {
    const res = await gatewayClient.get('/admin/events/config');
    return res.data;
  },

  /**
   * PUT /admin/events/config â€” Update events configuration
   */
  async updateEventsConfig(config: Record<string, any>): Promise<void> {
    await gatewayClient.put('/admin/events/config', config);
  },

  // ==========================================
  // Fine-Grained Permissions (New endpoints)
  // ==========================================

  /**
   * Get current user's effective permissions.
   *
   * @endpoint GET /admin/group-rbac/effective
   * @returns Effective permissions including roles, global perms, sections
   */
  async getCurrentUserPermissions(): Promise<UserPermissionsResponse> {
    console.info('[AdminService] Fetching current user permissions...');
    try {
      const res = await gatewayClient.get<UserPermissionsResponse>(
        '/admin/group-rbac/effective'
      );
      console.info('[AdminService] Current user permissions fetched:', {
        roles: res.data.roles,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch current user permissions:', error);
      throw error;
    }
  },

  /**
   * Get all available sections in the system.
   *
   * Returns a list of modules/areas (chat, database, admin, etc.)
   * with their display names, descriptions, and associated role strings.
   *
   * @endpoint GET /auth/permissions/sections
   * @returns Object with sections array
   * @throws {AxiosError} 401 if unauthorized
   */
  async getPermissionSections(): Promise<SectionInfo[]> {
    console.info('[AdminService] Fetching permission sections...');
    try {
      const res = await gatewayClient.get<{ sections: SectionInfo[] }>('/auth/permissions/sections');
      const sections = res.data.sections || res.data;
      console.info('[AdminService] Permission sections fetched:', {
        count: Array.isArray(sections) ? sections.length : 0,
      });
      return Array.isArray(sections) ? sections : [];
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch permission sections:', error);
      throw error;
    }
  },

  /**
   * Check if current user has access to a specific section.
   *
   * @endpoint POST /admin/group-rbac/check
   * @param sectionId - Section ID to check (e.g. "admin", "chat")
   * @param scope - Access scope (default: "view")
   * @returns Whether access is allowed
   *
   * @throws {AxiosError} 500 â€” backend bug
   */
  async checkSectionAccess(sectionId: string, scope = 'view'): Promise<SectionCheckResponse> {
    console.info('[AdminService] Checking section access:', { sectionId, scope });
    try {
      const res = await gatewayClient.post<SectionCheckResponse>('/admin/group-rbac/check-access', {
        section_id: sectionId,
        scope,
      });
      console.info('[AdminService] Section access check result:', {
        sectionId,
        allowed: res.data.allowed,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to check section access:', { sectionId, scope, error });
      throw error;
    }
  },

  /**
   * Check if current user has access to a section, permission, or group.
   *
   * More flexible than checkSectionAccess â€” accepts section, permission,
   * or group_id individually or in combination.
   *
   * @endpoint POST /admin/group-rbac/check-access
   * @param request - Access check request (section, permission, group_id)
   * @returns Whether access is allowed, with context
   * @throws {AxiosError} 401 if unauthorized
   */
  async checkAccess(request: AccessCheckRequest): Promise<AccessCheckResponse> {
    console.info('[AdminService] Checking access:', request);
    try {
      const res = await gatewayClient.post<AccessCheckResponse>('/admin/group-rbac/check-access', request);
      console.info('[AdminService] Access check result:', {
        allowed: res.data.allowed,
        section: res.data.section,
        permission: res.data.permission,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to check access:', { request, error });
      throw error;
    }
  },

  /**
   * GET /admin/rbac/permissions â€” List all system permissions
   * Returns organized list of all available permissions
   */
  async getAllSystemPermissions(): Promise<AllPermissionsResponse> {
    const res = await gatewayClient.get<AllPermissionsResponse>(
      '/admin/rbac/permissions'
    );
    return res.data;
  },

  /**
   * GET /admin/group-rbac/permissions/matrix â€” Get permissions matrix by role
   * Returns matrix of roles and their permissions.
   *
   * @endpoint GET /admin/group-rbac/permissions/matrix
   * NOTE: /admin/rbac/permissions/matrix does NOT exist in API Gateway (404).
   *       The correct path is /admin/group-rbac/permissions/matrix.
   */
  async getPermissionsMatrix(): Promise<PermissionMatrixResponse> {
    console.info('[AdminService] Fetching permissions matrix...');
    try {
      const res = await gatewayClient.get<PermissionMatrixResponse>(
        '/admin/group-rbac/permissions/matrix'
      );
      const data = res.data;
      let labels = { ...(data.labels ?? {}) };
      const permissionIds = Object.keys(data.permissions ?? {});
      const needsCatalog = permissionIds.some(
        (pid) => pid.startsWith('map_layer:') && !labels[pid]
      );
      if (needsCatalog) {
        try {
          const catalogRes = await gatewayClient.get<{
            items?: Array<{
              permission_id: string;
              label?: string;
              metadata?: { name?: string };
            }>;
          }>('/admin/rbac/catalog', { params: { resource_type: 'map_layer' } });
          labels = mergePermissionLabels(labels, catalogRes.data?.items);
        } catch (catalogErr) {
          console.warn(
            '[AdminService] Could not enrich matrix labels from catalog:',
            catalogErr
          );
        }
      }
      console.info('[AdminService] Permissions matrix fetched:', {
        roles: data?.roles?.length ?? 0,
        permissions: permissionIds.length,
        labels: Object.keys(labels).length,
      });
      return { ...data, labels };
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch permissions matrix:', error);
      throw error;
    }
  },

  /**
   * Update role permissions via /admin/rbac/permissions/assign
   */
  async updateRolePermissions(
    roleName: string,
    data: RolePermissionsUpdate
  ): Promise<void> {
    const promises: Promise<any>[] = [];
    // Grant permissions
    if (data.grant?.length) {
      for (const perm of data.grant) {
        promises.push(
          gatewayClient.post('/admin/rbac/permissions/assign', {
            role: roleName,
            permission: perm,
            action: 'add',
          })
        );
      }
    }
    // Revoke permissions
    if (data.revoke?.length) {
      for (const perm of data.revoke) {
        promises.push(
          gatewayClient.post('/admin/rbac/permissions/assign', {
            role: roleName,
            permission: perm,
            action: 'remove',
          })
        );
      }
    }
    await Promise.allSettled(promises);
  },

  /**
   * Get user's effective permissions.
   *
   * @endpoint GET /admin/rbac/config + GET /admin/roles/user/{user_id}
   * @param userId - Keycloak user UUID
   * @returns User permissions data
   *
   * NOTE: /rbac/user/{id}/effective returns only a message, not data.
   *       Redirects to getUserEffectivePermissions() which derives from RBAC config.
   */
  async getUserPermissions(userId: string): Promise<UserPermissionsResponse> {
    console.info('[AdminService] getUserPermissions redirecting to derived method:', { userId });
    const effective = await this.getUserEffectivePermissions(userId);
    // Map the derived format to UserPermissionsResponse shape
    return {
      user_id: effective.user_id || userId,
      username: '', // Not available from this derivation
      permissions: effective.global_permissions || [],
      roles: effective.base_roles || [],
    };
  },

  /**
   * Update user permissions (per-user overrides)
   * Uses /admin/group-rbac/overrides/permissions for individual permission overrides.
   */
  async updateUserPermissions(
    userId: string,
    data: UserPermissionUpdate
  ): Promise<void> {
    const promises: Promise<any>[] = [];
    // Grant permissions
    if (data.grant?.length) {
      for (const perm of data.grant) {
        promises.push(
          gatewayClient.post('/admin/group-rbac/overrides/permissions', {
            user_id: userId,
            permission: perm,
            override_type: 'grant',
          })
        );
      }
    }
    // Deny permissions
    if (data.revoke?.length) {
      for (const perm of data.revoke) {
        promises.push(
          gatewayClient.post('/admin/group-rbac/overrides/permissions', {
            user_id: userId,
            permission: perm,
            override_type: 'deny',
          })
        );
      }
    }
    await Promise.allSettled(promises);
  },

  // ==========================================
  // System Settings (Gateway â€” /admin/settings)
  // ==========================================

  /**
   * Get all system settings.
   *
   * @endpoint GET /admin/settings (Gateway :8000)
   * @returns Array of system setting items
   * @throws {AxiosError} 401 if unauthorized, 403 if not admin
   */
  async getSystemSettings(): Promise<SystemSettingsResponse> {
    console.info('[AdminService] Fetching system settings...');
    try {
      const res = await gatewayClient.get<SystemSettingsResponse>(
        '/admin/settings',
        { headers: SKIP_ACCESS_DENIED_TOAST }
      );
      console.info('[AdminService] System settings fetched:', {
        count: Array.isArray(res.data) ? res.data.length : 'object',
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch system settings:', error);
      throw error;
    }
  },

  /**
   * Update system settings.
   *
   * @endpoint PUT /admin/settings (Gateway :8000)
   * @param settings - Settings key-value pairs to update
   * @throws {AxiosError} 401 if unauthorized, 403 if not admin
   */
  async updateSystemSettings(
    settings: Record<string, unknown>
  ): Promise<void> {
    console.info('[AdminService] Updating system settings:', { keys: Object.keys(settings) });
    try {
      await gatewayClient.put('/admin/settings', settings);
      console.info('[AdminService] System settings updated');
    } catch (error: unknown) {
      console.error('[AdminService] Failed to update system settings:', error);
      throw error;
    }
  },

  /**
   * Get self-registration policy settings.
   *
   * @endpoint GET /admin/settings/registration
   */
  async getRegistrationSettings(): Promise<RegistrationSettingsResponse> {
    console.info('[AdminService] Fetching registration settings...');
    const res = await gatewayClient.get<RegistrationSettingsResponse>(
      '/admin/settings/registration',
      { headers: SKIP_ACCESS_DENIED_TOAST }
    );
    return res.data;
  },

  /**
   * Update self-registration policy settings.
   *
   * @endpoint PUT /admin/settings/registration
   */
  async updateRegistrationSettings(
    settings: RegistrationSettingsResponse
  ): Promise<RegistrationSettingsResponse> {
    console.info('[AdminService] Updating registration settings...');
    const res = await gatewayClient.put<RegistrationSettingsResponse>(
      '/admin/settings/registration',
      settings
    );
    return res.data;
  },

  /**
   * Get platform UI default settings.
   *
   * @endpoint GET /admin/settings/appearance
   */
  async getAppearanceSettings(): Promise<AppearanceSettingsResponse> {
    console.info('[AdminService] Fetching appearance settings...');
    const res = await gatewayClient.get<AppearanceSettingsResponse>(
      '/admin/settings/appearance',
      { headers: SKIP_ACCESS_DENIED_TOAST }
    );
    return res.data;
  },

  /**
   * Update platform UI default settings.
   *
   * @endpoint PUT /admin/settings/appearance
   */
  async updateAppearanceSettings(
    settings: AppearanceSettingsResponse
  ): Promise<AppearanceSettingsResponse> {
    console.info('[AdminService] Updating appearance settings...');
    const res = await gatewayClient.put<AppearanceSettingsResponse>(
      '/admin/settings/appearance',
      settings
    );
    return res.data;
  },

  /**
   * Get LLM/AI model configuration.
   *
   * @endpoint GET /admin/settings/llm (Gateway :8000)
   * @returns LLM settings including models, default_model, temperature, max_tokens
   * @throws {AxiosError} 401 if unauthorized, 403 if not admin
   */
  async getLLMSettings(): Promise<LLMSettingsResponse> {
    console.info('[AdminService] Fetching LLM settings...');
    try {
      const res = await gatewayClient.get<LLMSettingsResponse>(
        '/admin/settings/llm',
        { headers: SKIP_ACCESS_DENIED_TOAST }
      );
      console.info('[AdminService] LLM settings fetched:', {
        default_model: res.data.default_model,
        modelCount: res.data.models?.length,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch LLM settings:', error);
      throw error;
    }
  },

  /**
   * Update LLM/AI model configuration.
   *
   * @endpoint PUT /admin/settings/llm (Gateway :8000)
   * @param settings - LLM settings to update
   * @throws {AxiosError} 401 if unauthorized, 403 if not admin
   */
  async updateLLMSettings(settings: Record<string, unknown>): Promise<void> {
    console.info('[AdminService] Updating LLM settings:', { keys: Object.keys(settings) });
    try {
      await gatewayClient.put('/admin/settings/llm', settings);
      console.info('[AdminService] LLM settings updated');
    } catch (error: unknown) {
      console.error('[AdminService] Failed to update LLM settings:', error);
      throw error;
    }
  },

  // ---- Permission Overrides (delete) ----

  async deletePermissionOverride(overrideId: string): Promise<void> {
    await gatewayClient.delete(`/admin/group-rbac/overrides/permissions/${overrideId}`);
  },

  // ---- File Overrides ----

  async getFileOverrides(userId?: string): Promise<FileOverrideResponse[]> {
    const res = await gatewayClient.get<FileOverrideResponse[]>('/admin/group-rbac/overrides/files', {
      params: userId ? { user_id: userId } : undefined,
    });
    return res.data;
  },

  async createFileOverride(
    data: FileOverrideCreate
  ): Promise<FileOverrideResponse> {
    const res = await gatewayClient.post<FileOverrideResponse>(
      '/admin/group-rbac/overrides/files',
      data
    );
    return res.data;
  },

  async deleteFileOverride(overrideId: string): Promise<void> {
    await gatewayClient.delete(`/admin/group-rbac/overrides/files/${overrideId}`);
  },

  // ---- User Effective Permissions (admin view) ----

  /**
   * Get the effective (resolved) permissions for a specific user.
   *
   * Uses GET /admin/rbac/user/{user_id} which proxies auth-service
   * /permissions/internal/effective/{id} (admin:users:read). Do not call
   * GET /admin/rbac/config here â€” that route is super-admin only.
   *
   * @endpoint GET /admin/rbac/user/{user_id}
   * @param userId - Keycloak user UUID
   * @returns Effective permissions object from the RBAC resolver
   */
  async getUserEffectivePermissions(userId: string): Promise<EffectivePermissions> {
    console.info('[AdminService] Fetching user effective permissions:', { userId });
    try {
      const res = await gatewayClient.get(`/admin/rbac/user/${userId}`);
      const data = res.data as Record<string, unknown>;

      const result: EffectivePermissions = {
        user_id: (typeof data.user_id === 'string' ? data.user_id : userId),
        base_roles: extractRoleNames(data),
        is_admin: Boolean(data.is_admin),
        is_super_admin: Boolean(data.is_super_admin),
        global_permissions: Array.isArray(data.global_permissions)
          ? data.global_permissions.filter((p): p is string => typeof p === 'string')
          : Array.isArray(data.permissions)
            ? data.permissions.filter((p): p is string => typeof p === 'string')
            : [],
        allowed_sections: Array.isArray(data.allowed_sections)
          ? data.allowed_sections.filter((s): s is string => typeof s === 'string')
          : [],
        groups: (typeof data.groups === 'object' && data.groups !== null
          ? data.groups
          : {}) as EffectivePermissions['groups'],
      };

      console.info('[AdminService] User effective permissions loaded:', {
        userId,
        roles: result.base_roles,
        permissionCount: result.global_permissions.length,
        sections: result.allowed_sections,
      });

      return result;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch user effective permissions:', { userId, error });
      throw error;
    }
  },

  // ==========================================
  // Sessions (Gateway â€” /admin/sessions/)
  // ==========================================

  /**
   * Get all active sessions for a user.
   *
   * @endpoint GET /admin/sessions/user/{user_id}
   * @param userId - Keycloak user UUID
   * @returns Array of user sessions (normalizes Keycloak session format)
   *
   * WHY mapping: Backend returns Keycloak session format with camelCase fields
   * (ipAddress, lastAccess, start) and unix-ms timestamps, but our UserSession
   * interface uses snake_case (ip_address, last_active, started_at) with ISO strings.
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    console.info('[AdminService] Fetching user sessions:', { userId });
    try {
      const res = await gatewayClient.get(`/admin/sessions/user/${userId}`);
      const data = res.data;

      // Backend returns: { sessions: [...], count: N } with Keycloak format
      let rawSessions: any[];
      if (Array.isArray(data)) {
        rawSessions = data;
      } else if (data && Array.isArray(data.sessions)) {
        rawSessions = data.sessions;
      } else if (data && Array.isArray(data.data)) {
        rawSessions = data.data;
      } else {
        console.warn('[AdminService] Unexpected sessions response format:', { userId, data });
        rawSessions = [];
      }

      // Map Keycloak session fields â†’ our UserSession interface
      const sessions: UserSession[] = rawSessions.map((s: any) => ({
        id: s.id,
        user_id: s.userId || s.user_id || userId,
        ip_address: s.ipAddress || s.ip_address || null,
        // Keycloak doesn't return user_agent; use clients info as fallback
        user_agent: s.user_agent || s.userAgent || (s.clients ? Object.values(s.clients).join(', ') : null),
        // Keycloak returns unix timestamps in milliseconds
        started_at: s.started_at || (s.start ? new Date(s.start).toISOString() : null),
        last_active: s.last_active || (s.lastAccess ? new Date(s.lastAccess).toISOString() : null),
        expires_at: s.expires_at || null,
        is_active: s.is_active ?? true, // Keycloak sessions are active by default
      }));

      console.info('[AdminService] User sessions fetched:', { userId, count: sessions.length });
      return sessions;
    } catch (error: unknown) {
      console.error('[AdminService] Failed to fetch user sessions:', { userId, error });
      throw error;
    }
  },

  async revokeSession(sessionId: string, userId?: string): Promise<void> {
    await gatewayClient.delete(`/admin/sessions/${sessionId}`, {
      params: userId ? { user_id: userId } : undefined,
    });
  },

  /**
   * GET /admin/sessions/stats â€” Session statistics by client
   */
  async getSessionStats(): Promise<any> {
    const res = await gatewayClient.get('/admin/sessions/stats');
    const data = res.data;
    if (!data || typeof data !== 'object') return data;
    const total = data.totalActiveSessions ?? data.count ?? 0;
    const stats = Array.isArray(data.stats) ? data.stats : [];
    return {
      totalActiveSessions: total,
      clients: stats.length,
      ...data,
    };
  },

  /**
   * Logout (delete) all sessions for a specific user.
   *
   * @endpoint DELETE /admin/sessions/user/{userId}
   * @param userId - Keycloak user ID whose sessions to terminate
   *
   * NOTE: The old endpoint POST /admin/sessions/user/{userId}/logout does NOT exist.
   *       Correct endpoint is DELETE /admin/sessions/user/{userId}.
   */
  async logoutUser(userId: string): Promise<void> {
    console.info('[AdminService] Logging out all sessions for user:', { userId });
    try {
      // âœ… Correct: DELETE /admin/sessions/user/{userId} (not POST .../logout)
      await gatewayClient.delete(`/admin/sessions/user/${userId}`);
      console.info('[AdminService] All sessions terminated for user:', { userId });
    } catch (error: unknown) {
      console.error('[AdminService] Failed to logout user sessions:', { userId, error });
      throw error;
    }
  },

  /**
   * POST /admin/sessions/logout-all â€” Logout ALL users (dangerous!)
   */
  async logoutAllUsers(): Promise<void> {
    await gatewayClient.post('/admin/sessions/logout-all');
  },

  // ==========================================
  // User Search (Gateway â€” /admin/users)
  // ==========================================

  /**
   * Search users by username or email (client-side filter).
   *
   * @endpoint GET /admin/users
   * @param query - Search string matched against username and email
   * @param limit - Maximum results to return (default 10)
   * @returns Filtered array of matching users
   *
   * NOTE: GET /admin/users does NOT support a `search` query parameter.
   *       We fetch a larger pool (up to 200) and filter client-side.
   *       The old code passed `?search=query` (ignored by backend) and
   *       tried to read `res.data.users` but the endpoint returns a plain array.
   */
  async searchUsers(query: string, limit = 10): Promise<UserResponse[]> {
    console.info('[AdminService] Searching users client-side:', { query, limit });
    try {
      // Fetch up to 200 users for client-side filtering (backend has no search param)
      const res = await gatewayClient.get<UserResponse[] | { users?: UserResponse[] }>('/admin/users', {
        params: { limit: 200 },
      });
      // Backend returns plain array; guard against legacy {users:[...]} shape
      const all: UserResponse[] = Array.isArray(res.data)
        ? res.data
        : (res.data as { users?: UserResponse[] }).users ?? [];

      if (!query.trim()) {
        return all.slice(0, limit);
      }
      const q = query.toLowerCase();
      const filtered = all.filter(
        (u) =>
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      );
      console.info('[AdminService] User search complete:', { query, matched: filtered.length });
      return filtered.slice(0, limit);
    } catch (error: unknown) {
      console.error('[AdminService] Failed to search users:', { query, error });
      throw error;
    }
  },

  // ==========================================
  // Batch username resolution
  // ==========================================

  /**
   * Batch resolve user IDs to full user info objects.
   * @endpoint POST /admin/users/resolve
   */
  async resolveUsers(userIds: string[]): Promise<BatchResolveResponse> {
    if (userIds.length === 0) return {};

    const dedupeKey = `admin:resolve-users:${[...userIds].sort().join(',')}`;
    return dedupeAsync(dedupeKey, async () => {
      const BATCH_SIZE = 50;
      const chunks: string[][] = [];
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        chunks.push(userIds.slice(i, i + BATCH_SIZE));
      }

      try {
        const results = await Promise.all(
          chunks.map((chunk) =>
            gatewayClient.post<BatchResolveResponse>('/admin/users/resolve', {
              user_ids: chunk,
            })
          )
        );

        const merged: BatchResolveResponse = {};
        for (const res of results) {
          Object.assign(merged, res.data);
        }
        return merged;
      } catch (batchError: unknown) {
        console.warn('[AdminService] Batch resolve failed, falling back to individual fetches:', batchError);

        const map: BatchResolveResponse = {};
        const results = await Promise.allSettled(
          userIds.map((id) => gatewayClient.get<UserResponse>(`/admin/users/${id}`))
        );
        results.forEach((r, i) => {
          const id = userIds[i];
          if (r.status === 'fulfilled') {
            const u = r.value.data;
            map[id] = {
              username: u.username,
              email: u.email ?? undefined,
              display_name: u.display_name ?? undefined,
            };
          } else {
            map[id] = id;
          }
        });
        return map;
      }
    });
  },

  /**
   * Batch resolve user IDs to usernames.
   * Uses POST /admin/users/resolve for efficient batch resolution.
   * Falls back to individual fetches if batch endpoint fails.
   *
   * Backend limit: 50 user IDs per request.
   * Automatically chunks larger arrays.
   *
   * @endpoint POST /admin/users/resolve
   * @param userIds - Array of user IDs to resolve
   * @returns Map of user_id â†’ username
   */
  async resolveUsernames(
    userIds: string[]
  ): Promise<Record<string, string>> {
    if (userIds.length === 0) return {};

    console.info('[AdminService] Resolving usernames:', { count: userIds.length });

    try {
      const full = await this.resolveUsers(userIds);
      const mergedMap: Record<string, string> = {};
      for (const [id, info] of Object.entries(full)) {
        if (typeof info === 'string') {
          mergedMap[id] = info !== id ? info : id;
        } else if (info && typeof info === 'object') {
          const display =
            info.display_name?.trim() ||
            [info.first_name, info.last_name].filter(Boolean).join(' ').trim() ||
            info.username ||
            info.email?.split('@')[0] ||
            id;
          mergedMap[id] = display;
        } else {
          mergedMap[id] = id;
        }
      }

      console.info('[AdminService] Batch resolve successful:', {
        requested: userIds.length,
        resolved: Object.keys(mergedMap).length,
      });
      return mergedMap;
    } catch (batchError: unknown) {
      console.warn('[AdminService] Batch resolve failed, falling back to individual fetches:', batchError);

      // Fallback: fetch each user individually
      const map: Record<string, string> = {};
      const results = await Promise.allSettled(
        userIds.map((id) => gatewayClient.get(`/admin/users/${id}`))
      );
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const u = r.value.data as UserResponse;
          map[userIds[i]] =
            u.display_name?.trim() ||
            u.username ||
            u.email ||
            userIds[i];
        } else {
          map[userIds[i]] = userIds[i];
        }
      });
      return map;
    }
  },
};

