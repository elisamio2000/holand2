import { DefaultSession } from 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      displayName?: string;
      avatarUrl?: string | null;
      accessToken: string;
      refreshToken: string;
      // Keycloak RBAC
      roles: string[];
      permissions: string[];
      allowedSections: string[];
      isAdmin: boolean;
      isSuperAdmin: boolean;
      groups: Record<
        string,
        {
          role: string;
          group_name: string;
          permissions: string[];
          modules: string[];
        }
      >;
      // Token expiry tracking
      accessTokenExpires: number;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string | null;
    image?: string | null;
    accessToken?: string;
    refreshToken?: string;
    // Keycloak RBAC
    roles?: string[];
    permissions?: string[];
    allowedSections?: string[];
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    groups?: Record<string, any>;
    // Token lifecycle
    accessTokenExpires?: number;
    error?: string;
  }
}
