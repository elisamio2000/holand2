// ============================================
// Holand Auth Service
// Handles authentication API calls via Gateway
// All requests go through API Gateway (port 8000)
// ============================================

import { gatewayClient } from '@/lib/api-client';
import type {
  LoginRequest,
  LoginResponse,
  TokenRefreshRequest,
  TokenRefreshResponse,
  PasswordChangeRequest,
  RegisterRequest,
  RegisterResponse,
  RegistrationInfoResponse,
  EffectivePermissions,
  PermissionsResponse,
  UserInfo,
} from '@/types/auth.types';

export const authService = {
  // ==========================================
  // Authentication (Gateway â€” /auth/)
  // ==========================================

  /**
   * Login with username/password.
   *
   * @endpoint POST /auth/login
   * @param data - Login credentials (username, password)
   * @returns Access token, refresh token, and user info
   * @throws {AxiosError} 401 if credentials are invalid
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    console.info('[AuthService] Logging in:', { username: data.username });
    try {
      const res = await gatewayClient.post<LoginResponse>('/auth/login', data);
      console.info('[AuthService] Login successful:', { username: data.username });
      return res.data;
    } catch (error: unknown) {
      console.error('[AuthService] Login failed:', { username: data.username, error });
      throw error;
    }
  },

  /**
   * Register a new user.
   *
   * @endpoint POST /auth/register
   * @param data - Registration data (username, email, password, accepted_terms)
   * @returns Created user info with policy status fields
   * @throws {AxiosError} 409 if username/email already exists
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    console.info('[AuthService] Registering user:', { username: data.username });
    try {
      const res = await gatewayClient.post<RegisterResponse>('/auth/register', {
        ...data,
        accepted_terms: data.accepted_terms ?? false,
      });
      console.info('[AuthService] Registration successful:', {
        username: data.username,
        status: res.data.status,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[AuthService] Registration failed:', { username: data.username, error });
      throw error;
    }
  },

  /**
   * Public self-registration metadata (policy, terms version).
   *
   * @endpoint GET /auth/registration-info
   * @returns Registration policy and gateway toggle state
   */
  async getRegistrationInfo(): Promise<RegistrationInfoResponse> {
    console.info('[AuthService] Fetching registration info...');
    try {
      const res = await gatewayClient.get<RegistrationInfoResponse>(
        '/auth/registration-info'
      );
      return res.data;
    } catch (error: unknown) {
      console.error('[AuthService] Failed to fetch registration info:', error);
      throw error;
    }
  },

  /**
   * Refresh the access token.
   *
   * @endpoint POST /auth/refresh
   * @param data - Refresh token
   * @returns New access token and refresh token
   * @throws {AxiosError} 401 if refresh token is expired
   */
  async refreshToken(
    data: TokenRefreshRequest
  ): Promise<TokenRefreshResponse> {
    console.info('[AuthService] Refreshing token...');
    try {
      const res = await gatewayClient.post<TokenRefreshResponse>('/auth/refresh', data);
      console.info('[AuthService] Token refreshed successfully');
      return res.data;
    } catch (error: unknown) {
      console.error('[AuthService] Token refresh failed:', error);
      throw error;
    }
  },

  /**
   * Logout and invalidate refresh token.
   *
   * @endpoint POST /auth/logout
   * @param refreshToken - The refresh token to invalidate (sent in request body)
   * @throws {AxiosError} 401 if already logged out
   *
   * NOTE: Backend requires refresh_token in request BODY (not query param).
   * The server uses it to revoke the Keycloak session server-side.
   */
  async logout(refreshToken: string): Promise<void> {
    console.info('[AuthService] Logging out...');
    try {
      // âš ï¸ Backend requires refresh_token in the request body, not as a query param.
      // Sending it as a param causes 422 â€” body is the only accepted location.
      await gatewayClient.post('/auth/logout', { refresh_token: refreshToken });
      console.info('[AuthService] Logout successful');
    } catch (error: unknown) {
      console.error('[AuthService] Logout failed:', error);
      throw error;
    }
  },

  /**
   * Get current user info.
   *
   * @endpoint GET /auth/me
   * @returns Current user profile data (id, username, email, role, is_active, etc.)
   * @throws {AxiosError} 401 if token is invalid
   */
  async me(): Promise<UserInfo> {
    console.info('[AuthService] Fetching current user info...');
    try {
      const res = await gatewayClient.get<UserInfo>('/auth/me');
      console.info('[AuthService] User info fetched:', { id: res.data?.id, username: res.data?.username });
      return res.data;
    } catch (error: unknown) {
      console.error('[AuthService] Failed to fetch user info:', error);
      throw error;
    }
  },

  /**
   * Change current user's password (self-service).
   *
   * @endpoint POST /auth/change-password
   * @param data - Old and new password
   * @throws {AxiosError} 401 if old password is wrong
   */
  async changePassword(data: PasswordChangeRequest): Promise<void> {
    console.info('[AuthService] Changing password...');
    try {
      await gatewayClient.post('/auth/change-password', data);
      console.info('[AuthService] Password changed successfully');
    } catch (error: unknown) {
      console.error('[AuthService] Password change failed:', error);
      throw error;
    }
  },

  /**
   * Get current user's own activity log.
   *
   * @endpoint GET /auth/activity-log
   * @param params.limit - Max rows to return (default: 50)
   * @param params.offset - Pagination offset (default: 0)
   * @param params.action - Optional filter by action name
   * @returns Activity entries for the authenticated user only
   * @throws {AxiosError} 401 if token is invalid
   */
  async getMyActivityLog(params?: {
    limit?: number;
    offset?: number;
    action?: string;
  }): Promise<Array<Record<string, unknown>>> {
    console.info('[AuthService] Fetching my activity log:', { params });
    try {
      const res = await gatewayClient.get('/auth/activity-log', { params });
      const payload = res.data;
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
      console.info('[AuthService] My activity log fetched:', { count: rows.length });
      return rows;
    } catch (error: unknown) {
      console.error('[AuthService] Failed to fetch my activity log:', { params, error });
      throw error;
    }
  },

  /**
   * Upload avatar for the current authenticated user.
   *
   * @endpoint POST /auth/avatar
   * @param file - Image file selected by user
   * @returns Avatar upload result containing avatar_url
   */
  async uploadMyAvatar(file: File): Promise<{ avatar_url: string }> {
    console.info('[AuthService] Uploading avatar:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await gatewayClient.post<{ avatar_url: string }>('/auth/avatar', formData);
      console.info('[AuthService] Avatar uploaded successfully');
      return res.data;
    } catch (error: unknown) {
      console.error('[AuthService] Avatar upload failed:', error);
      throw error;
    }
  },

  /**
   * Delete avatar for the current authenticated user.
   *
   * @endpoint DELETE /auth/avatar
   */
  async deleteMyAvatar(): Promise<void> {
    console.info('[AuthService] Deleting avatar...');
    try {
      await gatewayClient.delete('/auth/avatar');
      console.info('[AuthService] Avatar deleted successfully');
    } catch (error: unknown) {
      console.error('[AuthService] Avatar delete failed:', error);
      throw error;
    }
  },

  // ==========================================
  // Permissions (Gateway â€” /auth/permissions/)
  // ==========================================

  /**
   * Get current user's RBAC permissions.
   *
   * @endpoint GET /auth/permissions/me
   * @returns User's permissions, roles, and allowed sections
   * @throws {AxiosError} 401 if token is invalid
   */
  async getMyPermissions(): Promise<PermissionsResponse> {
    console.info('[AuthService] Fetching my permissions...');
    try {
      const res = await gatewayClient.get<PermissionsResponse>('/auth/permissions/me');
      console.info('[AuthService] Permissions fetched:', {
        roles: res.data?.realm_roles?.length,
        sections: res.data?.allowed_sections?.length,
      });
      return res.data;
    } catch (error: unknown) {
      console.error('[AuthService] Failed to fetch permissions:', error);
      throw error;
    }
  },

  /**
   * Get current user's effective permissions (including group-scoped).
   *
   * @endpoint GET /admin/group-rbac/effective
   * @returns Effective permissions resolved from roles + overrides + groups
   * @throws {AxiosError} 401 if token is invalid
   */
  async getEffectivePermissions(): Promise<EffectivePermissions> {
    console.info('[AuthService] Fetching effective permissions...');
    try {
      const res = await gatewayClient.get<EffectivePermissions>(
        '/admin/group-rbac/effective'
      );
      console.info('[AuthService] Effective permissions fetched');
      return res.data;
    } catch (error: unknown) {
      console.error('[AuthService] Failed to fetch effective permissions:', error);
      throw error;
    }
  },
};

