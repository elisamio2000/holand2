import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { env } from '@/env.mjs';
import { pagesOptions } from './pages-options';
import {
  NEXT_AUTH_COOKIE_PREFIX,
  USE_SECURE_AUTH_COOKIES,
} from '@/lib/next-auth-cookie';
import { ALL_RBAC_SECTIONS } from '@/config/rbac-sections';

const AUTH_API_URL =
  process.env.AUTH_API_URL ||
  process.env.API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  '';

/**
 * All known UI sections used in sidebar menu items.
 * WHY: When both permission endpoints fail (e.g. backend 401 due to token
 * validation mismatch), super-admin users need a fallback so the sidebar
 * doesn't become empty. Shared source: `@/config/rbac-sections`.
 */

/**
 * Fetch effective permissions from backend for a given access token.
 * Returns roles, permissions, sections, admin status, and groups.
 */
async function fetchEffectivePermissions(
  accessToken: string
): Promise<{
  base_roles: string[];
  is_admin: boolean;
  is_super_admin: boolean;
  global_permissions: string[];
  allowed_sections: string[];
  groups: Record<string, any>;
} | null> {
  if (!AUTH_API_URL) return null;
  try {
    const res = await fetch(`${AUTH_API_URL}/admin/group-rbac/effective`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      base_roles: string[];
      is_admin: boolean;
      is_super_admin: boolean;
      global_permissions: string[];
      allowed_sections: string[];
      groups: Record<string, any>;
    };
  } catch {
    return null;
  }
}

/**
 * Fallback: fetch basic permissions from the simpler /auth/permissions/me endpoint.
 *
 * WHY: /admin/group-rbac/effective may return 403 for non-admin users or when
 * the admin service is unavailable. This fallback ensures `allowedSections` is
 * populated from the lighter endpoint so section-based menu filtering still works.
 *
 * @endpoint GET /auth/permissions/me
 */
async function fetchBasicPermissions(
  accessToken: string
): Promise<{
  allowed_sections: string[];
  realm_roles: string[];
} | null> {
  if (!AUTH_API_URL) return null;
  try {
    const res = await fetch(`${AUTH_API_URL}/auth/permissions/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      allowed_sections: string[];
      realm_roles: string[];
    };
  } catch {
    return null;
  }
}

/**
 * Refresh the access token using the refresh token.
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  if (!AUTH_API_URL) return null;
  try {
    const res = await fetch(`${AUTH_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    return (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  } catch {
    return null;
  }
}

/**
 * Cookie name prefix based on PORT to separate dev/prod sessions.
 * Prevents cookie sharing between localhost:3000, localhost:3001, localhost:3002, etc.
 *
 * WHY: NextAuth sets cookies for entire "localhost" domain by default (no port isolation).
 * This causes logout on port 3002 to also logout port 3001 â€” sessions are shared!
 *
 * SOLUTION: Use PORT-based cookie names:
 *   - PORT=3000 â†’ next-auth-3000.session-token
 *   - PORT=3001 â†’ next-auth-3001.session-token (production)
 *   - PORT=3002 â†’ next-auth-3002.session-token (development)
 *
 * @see /logo.png
 */

const DEV_LOGIN_BYPASS_HINT =
  ' For UI-only login without a gateway: set AUTH_DEV_BYPASS=true in .env.local, restart the app, then use username admin / password admin123. If you use `next start` (NODE_ENV=production), also set AUTH_DEV_BYPASS_IN_PRODUCTION=true â€” see apps/holand-web-app/docs/AUTH-BACKEND-NEXTAUTH-BYPASS.md.';

function formatAuthNetworkError(error: unknown, baseUrl: string): string {
  const err = error as { message?: string; cause?: { code?: string } };
  const code = err?.cause?.code;
  const devHint = process.env.NODE_ENV === 'development' ? DEV_LOGIN_BYPASS_HINT : '';
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
    return `Cannot reach the auth API at ${baseUrl} (${code}). Start the API gateway or fix AUTH_API_URL / API_GATEWAY_URL.${devHint}`;
  }
  const msg = err?.message || '';
  if (/fetch failed/i.test(msg) || msg === 'fetch failed') {
    return `Auth service unreachable (${baseUrl}). Check that the gateway is running and env AUTH_API_URL or API_GATEWAY_URL matches it.${devHint}`;
  }
  return msg || 'Authentication failed';
}

/**
 * Determine cookie `Secure` flag from NEXTAUTH_URL protocol, NOT NODE_ENV.
 *
 * WHY: `next build` + `next start` sets NODE_ENV=production automatically.
 * When the app runs on an internal network over HTTP (e.g. http://10.9.0.4:3002),
 * `secure: true` causes browsers to REJECT all cookies â†’ login fails silently
 * because session-token cookie is never stored.
 *
 * SOLUTION: Derive `secure` from whether NEXTAUTH_URL uses HTTPS.
 *   - NEXTAUTH_URL=/logo.png â†’ secure=true
 *   - NEXTAUTH_URL=http://10.9.0.4:3002   â†’ secure=false
 *   - No NEXTAUTH_URL set                   â†’ secure=false (safe default)
 */

/**
 * WHY trustHost is needed:
 * When NEXTAUTH_URL=http://10.9.0.4:3002 but a developer accesses via localhost:3002,
 * NextAuth rejects the CSRF token because the Host header doesn't match NEXTAUTH_URL.
 * Setting trustHost=true tells NextAuth to accept any host the server receives,
 * which is safe for internal network / dev deployments (not public internet).
 *
 * This is the NextAuth v4 equivalent of NEXTAUTH_URL_INTERNAL.
 * See: /logo.png
 */
const TRUST_HOST =
  process.env.NEXTAUTH_TRUST_HOST === 'true' ||
  process.env.NODE_ENV === 'development' ||
  !(process.env.NEXTAUTH_URL || '').startsWith('https://');

export const authOptions: NextAuthOptions = {
  // debug: true,
  // WHY: allow login from both IP and localhost without CSRF mismatch
  // Safe on internal HTTP networks â€” only disable for public HTTPS production
  ...(TRUST_HOST && { trustHost: true }),
  pages: {
    ...pagesOptions,
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours - only update session once per day to reduce API calls
  },
  cookies: {
    sessionToken: {
      name: `${NEXT_AUTH_COOKIE_PREFIX}.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: USE_SECURE_AUTH_COOKIES,
      },
    },
    callbackUrl: {
      name: `${NEXT_AUTH_COOKIE_PREFIX}.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: USE_SECURE_AUTH_COOKIES,
      },
    },
    csrfToken: {
      name: `${NEXT_AUTH_COOKIE_PREFIX}.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: USE_SECURE_AUTH_COOKIES,
      },
    },
  },
  callbacks: {
    async session({ session, token }: { session: any; token: any }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          username: token.username as string,
          displayName: token.displayName as string,
          email: token.email as string,
          avatarUrl: (token.avatarUrl as string | null | undefined) ?? null,
          image: (token.image as string | undefined) ?? session.user?.image,
          accessToken: token.accessToken as string,
          refreshToken: token.refreshToken as string,
          // Keycloak RBAC
          roles: (token.roles as string[]) || [],
          permissions: (token.permissions as string[]) || [],
          allowedSections: (token.allowedSections as string[]) || [],
          isAdmin: (token.isAdmin as boolean) || false,
          isSuperAdmin: (token.isSuperAdmin as boolean) || false,
          groups: token.groups || {},
          accessTokenExpires: token.accessTokenExpires || 0,
          // Error state (for client-side handling)
          ...(token.error ? { error: token.error } : {}),
        },
      };
    },

    async jwt({ token, user, trigger, session }: { token: any; user?: any; trigger?: string; session?: any }) {
      if (trigger === 'update' && session) {
        if (session.avatarUrl !== undefined) token.avatarUrl = session.avatarUrl;
        if (session.image !== undefined) token.image = session.image;
        if (session.displayName !== undefined) {
          token.displayName = session.displayName;
          token.name = session.displayName;
        }
        return token;
      }

      // ---- Initial login: store everything from authorize() ----
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.displayName = (user as any).displayName;
        token.email = (user as any).email;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.accessTokenExpires = (user as any).accessTokenExpires;
        // RBAC data fetched in authorize()
        token.roles = (user as any).roles || [];
        token.permissions = (user as any).permissions || [];
        token.allowedSections = (user as any).allowedSections || [];
        token.isAdmin = (user as any).isAdmin || false;
        token.isSuperAdmin = (user as any).isSuperAdmin || false;
        token.groups = (user as any).groups || {};
        token.error = undefined;
        return token;
      }

      // ---- Token still valid: return as-is ----
      const now = Date.now();
      const expiresAt = (token.accessTokenExpires as number) || 0;
      // Refresh 60 seconds before expiry
      if (now < expiresAt - 60 * 1000) {
        return token;
      }

      // ---- Token expired: refresh ----
      if (token.accessToken === 'dev-bypass-placeholder') {
        // Dev bypass session â€” never call real /auth/refresh with a fake token.
        return { ...token, accessTokenExpires: Date.now() + 365 * 24 * 60 * 60 * 1000 };
      }
      const refreshed = await refreshAccessToken(token.refreshToken as string);
      if (!refreshed) {
        // Refresh failed â€” token invalid, user must re-login
        return { ...token, error: 'RefreshTokenExpired' };
      }

      // Update token with new values
      token.accessToken = refreshed.access_token;
      token.refreshToken = refreshed.refresh_token;
      token.accessTokenExpires = now + refreshed.expires_in * 1000;

      // Re-fetch permissions on refresh (roles may have changed).
      // Fallback to /auth/permissions/me if group-rbac/effective is unavailable.
      const perms = await fetchEffectivePermissions(refreshed.access_token);
      const basicPerms = perms
        ? null
        : await fetchBasicPermissions(refreshed.access_token);

      if (perms) {
        token.roles = perms.base_roles || [];
        token.permissions = perms.global_permissions || [];
        token.allowedSections = perms.allowed_sections || [];
        token.isAdmin = perms.is_admin || false;
        token.isSuperAdmin = perms.is_super_admin || false;
        token.groups = perms.groups || {};
      } else if (basicPerms) {
        // Partial update: sections and roles from simple endpoint; keep existing admin flags
        token.roles = basicPerms.realm_roles || [];
        token.allowedSections = basicPerms.allowed_sections || [];
        // permissions, isAdmin, isSuperAdmin, groups remain from previous token (stale but better than empty)
      }
      // WHY: If both endpoints failed, keep existing token data (roles, sections, admin flags)
      // from initial login â€” stale data is better than empty data that hides all pages.
      token.error = undefined;

      return token;
    },

    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allow relative URLs and same-origin URLs; reject external URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Record<string, string> | undefined) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Username and password are required');
        }

        /**
         * Local UI-only login (development). NextAuth still issues a real JWT cookie,
         * but tokens are placeholders â€” gateway API calls need a real login or will 401.
         * Set in `.env.local`: AUTH_DEV_BYPASS=true
         *
         * WHY branch before fetch: if bypass is on but password is wrong, we must NOT
         * call the gateway â€” otherwise users see "Auth service unreachable" instead of
         * a clear dev-login hint.
         */
        // Read bypass from process.env first: @t3-oss/env-nextjs optional keys can be
        // out of sync with .env.local in some dev reload paths; bypass must be reliable
        // when the gateway is down.
        const devBypassRaw = String(
          process.env.AUTH_DEV_BYPASS ?? env.AUTH_DEV_BYPASS ?? ''
        )
          .toLowerCase()
          .trim();
        const bypassRequested =
          devBypassRaw === 'true' ||
          devBypassRaw === '1' ||
          devBypassRaw === 'yes';
        const bypassInProdAllowed =
          String(
            process.env.AUTH_DEV_BYPASS_IN_PRODUCTION ??
              env.AUTH_DEV_BYPASS_IN_PRODUCTION ??
              ''
          )
            .toLowerCase()
            .trim() === 'true';
        const isDevRuntime =
          process.env.NODE_ENV === 'development' || env.NODE_ENV === 'development';
        const bypassRuntimeOk = isDevRuntime || bypassInProdAllowed;
        const devBypass = bypassRequested && bypassRuntimeOk;

        if (bypassRequested && !bypassRuntimeOk && credentials.username === 'admin') {
          throw new Error(
            'AUTH_DEV_BYPASS is set but ignored in production (NODE_ENV=production). For admin-only UI login without a gateway: set AUTH_DEV_BYPASS_IN_PRODUCTION=true, restart, then use admin / admin123 â€” or use `next dev`. See docs/AUTH-BACKEND-NEXTAUTH-BYPASS.md.'
          );
        }

        if (devBypass) {
          if (credentials.username === 'admin') {
            if (credentials.password !== 'admin123') {
              throw new Error(
                'AUTH_DEV_BYPASS is on: use password admin123 for user admin (gateway login is skipped).'
              );
            }
            console.warn(
              '[NextAuth] AUTH_DEV_BYPASS: mock admin session (no real access_token from gateway).'
            );
            return {
              id: 'dev-admin',
              username: 'admin',
              displayName: 'Holand Admin',
              email: 'admin@localhost',
              name: 'Holand Admin',
              avatarUrl: '/brand/brand-mark-4x.svg',
              image: '/brand/brand-mark-4x.svg',
              accessToken: 'dev-bypass-placeholder',
              refreshToken: 'dev-bypass-placeholder',
              // Long TTL so jwt() rarely hits the refresh branch (placeholder cannot refresh).
              accessTokenExpires: Date.now() + 365 * 24 * 60 * 60 * 1000,
              roles: ['super-admin'],
              permissions: [],
              allowedSections: ALL_RBAC_SECTIONS,
              isAdmin: true,
              isSuperAdmin: true,
              groups: {},
            };
          }
          throw new Error(
            'AUTH_DEV_BYPASS is on: without a reachable gateway, only username admin / password admin123 is supported (gateway login is skipped for that pair).'
          );
        }

        if (!AUTH_API_URL) {
          throw new Error('AUTH_API_URL (or API_GATEWAY_URL) is not configured');
        }

        try {
          // Step 1: Login
          const response = await fetch(`${AUTH_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });

          if (!response.ok) {
            const errorData = (await response.json().catch(() => null)) as {
              detail?: string;
            } | null;
            throw new Error(
              errorData?.detail || 'Invalid username or password'
            );
          }

          const data = (await response.json()) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            user?: {
              id?: string;
              username?: string;
              display_name?: string;
              email?: string;
              roles?: string[];
              is_admin?: boolean;
              is_super_admin?: boolean;
            };
          };

          // Step 2: Fetch effective permissions with the new token.
          // Fallback to /auth/permissions/me if group-rbac/effective returns null
          // (e.g. 403 for non-admin users or service unavailable).
          const perms = await fetchEffectivePermissions(data.access_token);
          const basicPerms = perms
            ? null
            : await fetchBasicPermissions(data.access_token);

          // WHY: When both RBAC endpoints fail (e.g. backend token validation
          // mismatch after Keycloak config change), the login response itself
          // contains enough role/admin info to keep the UI functional.
          // Super-admin users get all sections so the sidebar isn't empty.
          const loginRoles = data.user?.roles ?? [];
          const loginIsAdmin = data.user?.is_admin ?? false;
          const loginIsSuperAdmin =
            data.user?.is_super_admin ?? loginRoles.includes('super-admin');

          return {
            id: data.user?.id || '',
            username: data.user?.username || credentials.username,
            displayName:
              data.user?.display_name ||
              data.user?.username ||
              credentials.username,
            email: data.user?.email || '',
            name:
              data.user?.display_name ||
              data.user?.username ||
              credentials.username,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            accessTokenExpires: Date.now() + data.expires_in * 1000,
            // RBAC from /admin/group-rbac/effective â†’ /auth/permissions/me â†’ login response
            roles: perms?.base_roles ?? basicPerms?.realm_roles ?? loginRoles,
            permissions: perms?.global_permissions ?? [],
            allowedSections:
              perms?.allowed_sections ??
              basicPerms?.allowed_sections ??
              (loginIsSuperAdmin ? ALL_RBAC_SECTIONS : []),
            isAdmin: perms?.is_admin ?? loginIsAdmin,
            isSuperAdmin: perms?.is_super_admin ?? loginIsSuperAdmin,
            groups: perms?.groups ?? {},
          };
        } catch (error: unknown) {
          const message = formatAuthNetworkError(error, AUTH_API_URL);
          console.error('[NextAuth] credentials authorize error:', error);
          throw new Error(message);
        }
      },
    }),
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],
};

