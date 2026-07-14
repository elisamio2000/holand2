// ============================================
// Holand Auth & User Types
// Generated from Holand Auth Service OpenAPI spec
// ============================================

// ---- Auth ----

export interface LoginRequest {
  username: string; // minLength: 3
  password: string; // minLength: 6
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string; // default: "Bearer"
  user?: LoginUser | null;
}

export interface LoginUser {
  id: string;
  username: string;
  email?: string;
  display_name?: string;
  role?: string;
  roles?: string[];
  realm_roles?: string[];
  permissions?: string[];
  is_admin?: boolean;
  is_super_admin?: boolean;
}

export interface TokenRefreshRequest {
  refresh_token: string;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string; // minLength: 8
}

export interface RegisterRequest {
  username: string; // minLength: 3, maxLength: 50
  email: string;
  password: string; // minLength: 8
  first_name: string;
  last_name: string;
  national_id: string;
  mobile_number: string;
  center_name: string;
}

export interface RegisterResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  user: LoginUser;
}

/** Public metadata from GET /auth/registration-info */
export interface RegistrationInfoResponse {
  allow_registration: boolean;
  can_self_register: boolean;
  policy: string;
  terms_version: string;
  require_terms: boolean;
  default_role: string;
  post_approval_role_hint?: string;
  can_login_after_register: boolean;
  requires_admin_activation: boolean;
  required_fields: string[];
  identity_validation: {
    full_name_enabled: boolean;
    national_id_enabled: boolean;
    mobile_number_enabled: boolean;
    provider_base_url?: string | null;
    provider_timeout_seconds: number;
  };
}

// ---- Users ----

export interface UserResponse {
  id: string;
  username: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  permissions?: string[];
  is_active?: boolean;
  /** Short bio / about text */
  bio?: string | null;
  /** User's timezone (e.g. "Asia/Tehran") */
  timezone?: string | null;
  /** Preferred language (e.g. "fa", "en") */
  language?: string | null;
  /** Notification preferences */
  notifications?: Record<string, boolean> | null;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
  page?: number | null;
  page_size?: number | null;
  offset?: number | null;
  limit?: number | null;
}

export interface UserUpdate {
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  is_active?: boolean | null;
  /** Short bio / about text */
  bio?: string | null;
  /** User's timezone (e.g. "Asia/Tehran") */
  timezone?: string | null;
  /** Preferred language (e.g. "fa", "en") */
  language?: string | null;
}

export interface UserInfo {
  id: string;
  username: string;
  email?: string | null;
  role: string;
  is_active: boolean;
  /** May be null if backend doesn't provide creation timestamp */
  created_at: string | null;
  last_login?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  timezone?: string | null;
  language?: string | null;
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  role_name?: string; // default: "user"
}

export interface PasswordResetRequest {
  new_password: string; // minLength: 8
}

// ---- Roles ----

export interface RoleResponse {
  id: string;
  name: string;
  description?: string | null;
  permissions?: string[];
  is_system?: boolean;
  /** Number of users assigned to this role (from include_user_count=true) */
  user_count?: number;
}

export interface RoleCreate {
  name: string; // minLength: 2, maxLength: 50
  description?: string | null;
  permissions?: string[];
}

export interface RoleAssignRequest {
  role_name: string;
  /** User ID to assign the role to (required for admin assignment) */
  user_id?: string;
}

/**
 * Request to revoke a role from a user.
 * @endpoint POST /roles/revoke
 */
export interface RoleRevokeRequest {
  role_name: string;
  user_id: string;
}

/**
 * Request to update a role's properties.
 * @endpoint PUT /roles/{role_name}
 */
export interface RoleUpdateRequest {
  description?: string | null;
  permissions?: string[];
}

export interface RoleInfo {
  id: string;
  name: string;
  description?: string | null;
  permissions?: any;
  is_system?: boolean | null;
  created_at?: string | null;
}

export interface CreateCustomRoleRequest {
  name: string; // minLength: 2, maxLength: 50
  level: number; // min: 1, max: 99
  sections?: string[];
  permissions?: string[];
  display_name?: string;
  rate_limits?: {
    requests_per_minute?: number;
    requests_per_hour?: number;
    burst_limit?: number;
  };
}

export interface CloneCustomRoleRequest {
  source_role: string;
  name: string;
  level?: number;
  display_name?: string;
}

// ---- Permissions ----

/**
 * Per-section permission details returned inside PermissionsResponse.sections.
 * Each key in the `sections` map is a section ID (e.g. 'chat', 'admin').
 */
export interface SectionAccess {
  /** Whether the user is allowed to access this section at all */
  allowed: boolean;
  /** Access scope within the section (e.g. 'view', 'edit', 'admin') */
  scope?: string;
  /** Fine-grained permissions for this section */
  permissions?: string[];
}

export interface PermissionsResponse {
  user_id?: string;
  username?: string;
  realm_roles: string[];
  /** Per-section access detail keyed by section ID (e.g. 'chat', 'admin', 'database') */
  sections?: Record<string, SectionAccess>;
  is_admin?: boolean;
  is_super_admin?: boolean;
  allowed_sections: string[];
}

// ---- Fine-Grained Permissions (from /auth/permissions/me and /admin/permissions/*) ----

export interface UserPermissionsResponse {
  user_id: string;
  username: string;
  permissions: string[];
  roles: string[];
  custom_grants?: string[];
  custom_denies?: string[];
}

export interface PermissionCategory {
  name: string;
  description?: string;
  permissions: PermissionItem[];
}

export interface PermissionItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export interface AllPermissionsResponse {
  categories: PermissionCategory[];
  total: number;
}

export interface PermissionMatrixResponse {
  roles: string[];
  permissions: Record<string, Record<string, boolean>>;
  /** Runtime-effective grants (e.g. super-admin bypass) keyed by role â†’ permission. */
  effective?: Record<string, Record<string, boolean>>;
  categories?: Record<string, string[]>;
  /** Human-readable labels from permission_catalog (permission_id â†’ label). */
  labels?: Record<string, string>;
}

export interface RolePermissionsUpdate {
  grant?: string[];
  revoke?: string[];
}

export interface UserPermissionUpdate {
  grant?: string[];
  revoke?: string[];
}

/**
 * Individual system setting item from backend.
 * Backend returns array of these from GET /admin/settings
 */
export interface SystemSettingItem {
  id: string;
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  updated_at?: string;
}

/**
 * Response from GET /admin/settings.
 *
 * Backend returns a flat object like:
 * { system_name: "Holand Platform", maintenance_mode: false, max_upload_size_mb: 100, ... }
 *
 * Not an array of SystemSettingItem as originally assumed.
 */
export type SystemSettingsResponse = Record<string, unknown>;

/** Response from GET /admin/settings/registration */
export interface RegistrationSettingsResponse {
  registration_enabled: boolean;
  registration_policy: string;
  registration_default_role: string;
  registration_post_approval_role: string;
  registration_terms_version: string;
  registration_require_terms: boolean;
  registration_activation_deadline_days: number | null;
}

/** Response from GET /admin/settings/appearance */
export interface AppearanceSettingsResponse {
  platform_default_language: string;
  platform_default_theme: string;
  platform_default_layout: string;
}

/** Response from GET /platform/defaults */
export interface PlatformDefaultsResponse {
  language: string;
  theme: string;
  layout: string;
}

export interface LLMSettingsResponse {
  /** Available models list (backend field name: available_models) */
  available_models?: string[];
  /** @deprecated Frontend alias â€” backend uses available_models */
  models?: string[];
  default_model: string;
  temperature?: number;
  max_tokens?: number;
  streaming_enabled?: boolean;
  /** Any additional LLM config fields from backend */
  [key: string]: unknown;
}

export interface EffectivePermissions {
  user_id?: string;
  base_roles: string[];
  is_admin: boolean;
  is_super_admin: boolean;
  global_permissions: string[];
  allowed_sections: string[];
  groups: Record<
    string,
    {
      role: string;
      group_name: string;
      permissions: string[];
      modules: string[];
    }
  >;
}

export interface PermissionsMatrix {
  roles: string[];
  permissions: Record<string, Record<string, boolean>>;
  /** Runtime-effective grants (super-admin bypass) keyed by role â†’ permission. */
  effective?: Record<string, Record<string, boolean>>;
  categories?: Record<string, string[]>;
  /** Human-readable labels from permission_catalog (permission_id â†’ label). */
  labels?: Record<string, string>;
}

export interface SectionCheckRequest {
  section_id: string;
  scope?: string; // default: "view"
}

export interface SectionCheckResponse {
  section_id: string;
  allowed: boolean;
  scope: string;
}

export interface AccessCheckRequest {
  section?: string | null;
  permission?: string | null;
  group_id?: string | null;
}

export interface PermissionAssignRequest {
  role: string;
  permission: string;
  action: 'add' | 'remove';
}

export interface SectionAssignRequest {
  role: string;
  section: string;
  action: 'add' | 'remove';
}

export interface RoleHierarchyUpdate {
  hierarchy: Record<string, number>;
}

// ---- Permission Overrides ----

export interface PermissionOverrideCreate {
  user_id: string;
  permission: string;
  override_type: 'grant' | 'deny';
  scope_group_id?: string | null;
  reason?: string | null;
  expires_at?: string | null;
}

export interface PermissionOverrideResponse {
  id: string;
  user_id: string;
  permission: string;
  override_type: string;
  scope_group_id?: string | null;
  reason?: string | null;
  expires_at?: string | null;
  created_at: string;
  created_by?: string | null;
}

// ---- System Stats ----

export interface SystemStats {
  total_users: number;
  total_sessions: number;
  total_messages: number;
  active_users_24h: number;
}

// ---- Groups (Group RBAC) ----

export interface GroupResponse {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  metadata?: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupCreate {
  name: string;
  description?: string | null;
  parent_id?: string | null;
  metadata?: Record<string, any> | null;
}

export interface GroupUpdate {
  name?: string | null;
  description?: string | null;
  parent_id?: string | null;
  metadata?: Record<string, any> | null;
  is_active?: boolean | null;
}

export interface MembershipCreate {
  user_id: string;
  role_name?: string; // default: "user"
}

export interface MembershipResponse {
  id: string;
  user_id: string;
  group_id: string;
  role_name: string;
  joined_at: string;
  added_by?: string | null;
}

export interface ModuleAssign {
  module_id: string; // e.g. chat, database, face-recognition
}

export interface FileAssign {
  artifact_id: string;
}

export interface CaseAssign {
  case_id: string;
}

// ---- File Overrides ----

export interface FileOverrideCreate {
  user_id: string;
  artifact_id: string;
  permissions?: string[]; // read, write, delete
  reason?: string | null;
  expires_at?: string | null;
}

export interface FileOverrideResponse {
  id: string;
  user_id: string;
  artifact_id: string;
  permissions: string[];
  reason?: string | null;
  expires_at?: string | null;
  created_at: string;
  created_by?: string | null;
}

// ---- Batch / Bulk Operations ----

/**
 * Request to resolve multiple usernames by their IDs in a single call.
 * @endpoint POST /users/resolve
 */
export interface BatchResolveRequest {
  user_ids: string[];
}

/**
 * Response from POST /users/resolve
 * Maps user_id â†’ user info object.
 *
 * Backend returns: { "uuid": { username, email, first_name, last_name } }
 * NOT a simple string map as originally assumed.
 */
export interface BatchResolveUserInfo {
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
}

export interface BatchResolveResponse {
  [user_id: string]: BatchResolveUserInfo | string;
}

/**
 * Bulk permissions update request.
 * @endpoint PUT /rbac/permissions/bulk
 */
export interface BulkPermissionsRequest {
  changes: {
    role: string;
    permission: string;
    action: 'add' | 'remove';
  }[];
}

// ---- Sections (from GET /permissions/sections) ----

/**
 * Response from GET /permissions/sections
 * Each section represents a module/area in the system.
 */
export interface SectionInfo {
  /** Section identifier (e.g. "chat", "admin", "database") */
  id: string;
  /** Display name (may be in Farsi) */
  name: string;
  /** Description of what this section controls */
  description?: string;
  /** Associated role string (e.g. "section:chat") */
  role?: string;
}

/**
 * Response from POST /permissions/check-access
 * Indicates whether the current user has access to a section/permission/group.
 */
export interface AccessCheckResponse {
  allowed: boolean;
  section?: string | null;
  permission?: string | null;
  group_id?: string | null;
}

/**
 * Live RBAC configuration from GET /rbac/config or /rbac/config/live.
 * Same structure for both endpoints â€” reflects runtime state.
 *
 * NOTE: role_permissions, section_permissions, route_permissions are
 * arrays of strings (string[]), NOT space-separated strings.
 */
export interface LiveRbacConfig {
  /** Role name â†’ array of permission strings */
  role_permissions: Record<string, string[]>;
  /** Role name â†’ array of section names */
  section_permissions: Record<string, string[]>;
  /** Role name â†’ numeric priority (higher = more powerful) */
  role_hierarchy: Record<string, number>;
  /** "METHOD:/path" â†’ array of required permissions */
  route_permissions: Record<string, string[]>;
  /** Role â†’ rate limit settings */
  role_rate_limits: Record<string, Record<string, number>>;
  /** Category name â†’ array of permissions in that category */
  permission_categories: Record<string, string[]>;
  version: string;
  updated_at: string;
}

/**
 * Membership info from GET /group-rbac/my-groups
 * Represents a group the current user belongs to.
 */
export interface MyGroupMembership {
  id: string;
  group_id: string;
  group_name: string;
  group_description?: string | null;
  role_name: string;
  joined_at: string;
}

// ---- Sessions ----

export interface UserSession {
  id: string;
  user_id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  started_at?: string | null;
  last_active?: string | null;
  expires_at?: string | null;
  is_active?: boolean;
}

// ---- Section Permissions ----

export interface SectionPermissionsResponse {
  permissions: Record<string, string[]>;
  available_sections: string[];
  section_metadata?: Record<string, { name?: string; description?: string; icon?: string }>;
}

export interface SectionPermissionsUpdate {
  permissions: Record<string, string[]>; // role â†’ sections[]
}
