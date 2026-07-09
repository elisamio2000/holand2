// ============================================
// Holand API Client â€” Unified Gateway Client
// All communication goes through API Gateway (port 8000).
// No direct service connections (auth:8003, storage:8004, etc.)
// ============================================

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { getSession, signOut } from 'next-auth/react';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { isPublicAuthGatewayClientPath } from '@/config/public-auth-api-paths';
import {
  getForbiddenMessage,
  shouldSkipAccessDeniedToast,
} from '@/lib/gateway-api-error';
import { pauseGatewayQueues } from '@/lib/gateway-retry';
import { resolveActiveGroupId } from '@/lib/workspace-group-id';

function resolveApiGatewayUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim() ||
    process.env.API_GATEWAY_URL?.trim() ||
    '';
  if (!url && process.env.NODE_ENV === 'production') {
    throw new Error(
      'API_GATEWAY_URL or NEXT_PUBLIC_API_GATEWAY_URL is required in production.'
    );
  }
  if (!url && typeof window === 'undefined') {
    console.warn(
      '[ApiClient] Gateway URL not configured â€” set API_GATEWAY_URL in .env.local'
    );
  }
  return url;
}

const API_GATEWAY_URL = resolveApiGatewayUrl();

// âš ï¸ Browser requests go through Next.js proxy to avoid CORS.
// Server-side can call the backend directly (no CORS in server-to-server).
const GATEWAY_CLIENT_URL =
  typeof window !== 'undefined'
    ? '/api/gateway' // Browser: proxy via Next.js rewrites (same origin â†’ no CORS)
    : API_GATEWAY_URL; // Server: direct call (no CORS)

// ---- Global 401 signOut guard ----
// Prevents multiple simultaneous 401 responses (e.g. batch requests) from
// triggering signOut() multiple times. Once one signOut is in flight, all
// subsequent 401s are ignored until the page redirects.
let isSigningOut = false;

const FORBIDDEN_TOAST_DEBOUNCE_MS = 4000;
const lastForbiddenToastAt = new Map<string, number>();

function maybeNotifyForbidden(error: AxiosError): void {
  if (typeof window === 'undefined') return;
  const config = error.config;
  if (shouldSkipAccessDeniedToast(config?.headers as Record<string, unknown>)) {
    return;
  }
  const path = config?.url ?? 'unknown';
  const now = Date.now();
  const last = lastForbiddenToastAt.get(path) ?? 0;
  if (now - last < FORBIDDEN_TOAST_DEBOUNCE_MS) {
    return;
  }
  lastForbiddenToastAt.set(path, now);
  toast.error(getForbiddenMessage(error), { duration: 5000 });
}

type RetriableAxiosConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

/** Gateway revoked the bearer token â€” NextAuth cookie still holds the old JWT. */
function isRevokedOrInvalidAuth(error: AxiosError): boolean {
  const data = error.response?.data as
    | { detail?: string; message?: string; error?: string }
    | undefined;
  const parts = [data?.detail, data?.message, data?.error]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase();
  if (!parts) return false;
  return (
    parts.includes('revoked') ||
    parts.includes('login required') ||
    parts.includes('invalid or expired token') ||
    parts.includes('authentication required')
  );
}

/**
 * Handle 401: if the gateway rejected our Bearer token (revoked/expired), sign out.
 * NextAuth still stores accessToken in the session cookie until signOut() runs.
 */
async function handleUnauthorized(error: AxiosError): Promise<void> {
  if (isSigningOut || typeof window === 'undefined') return;

  isSigningOut = true;

  try {
    const session = await getSession();

    if ((session?.user as any)?.error === 'RefreshTokenExpired') {
      console.warn('[ApiClient] Token refresh expired â€” signing out.');
      await signOut({ redirect: false });
      window.location.href = routes.signIn;
      return;
    }

    const hadBearer = Boolean(error.config?.headers?.Authorization);

    const config = error.config as RetriableAxiosConfig | undefined;
    if (config?._authRetried) {
      console.warn(
        '[ApiClient] Gateway rejected token after refresh retry â€” clearing NextAuth session.',
        { url: config.url, detail: error.response?.data }
      );
      await signOut({ redirect: false });
      window.location.href = routes.signIn;
      return;
    }

    if (isRevokedOrInvalidAuth(error) || (hadBearer && session?.user?.accessToken)) {
      console.warn(
        '[ApiClient] Gateway rejected token â€” clearing NextAuth session.',
        { url: error.config?.url, detail: error.response?.data }
      );
      await signOut({ redirect: false });
      window.location.href = routes.signIn;
      return;
    }

    if (!session?.user?.accessToken) {
      console.warn('[ApiClient] 401 and no access token â€” signing out.');
      await signOut({ redirect: false });
      window.location.href = routes.signIn;
      return;
    }

    isSigningOut = false;
  } catch (err) {
    console.error('[ApiClient] handleUnauthorized error:', err);
    isSigningOut = false;
  }
}

// ---- Unified Gateway Axios Instance ----
// ALL API calls go through the Gateway (port 8000).
// Routes: /auth/*, /admin/*, /chat/*, /storage/*, /tools/*, /import/*, /gpu/*

if (typeof window !== 'undefined') {
  console.info('[ApiClient] Module init (BROWSER):', {
    gatewayBaseURL: GATEWAY_CLIENT_URL,
  });
}

if (typeof window === 'undefined' && !API_GATEWAY_URL) {
  console.warn(
    '[ApiClient] API gateway URL is not configured. Set API_GATEWAY_URL or NEXT_PUBLIC_API_GATEWAY_URL in .env.local'
  );
}

export const gatewayClient: AxiosInstance = axios.create({
  baseURL: GATEWAY_CLIENT_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---- Request interceptor: attach Bearer token + group context ----
gatewayClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip auth for login/register/refresh/logout
    // logout uses refresh_token in body â€” no Bearer token needed (and token may already be expired)
    const isPublic = isPublicAuthGatewayClientPath(config.url);

    // Fetch session once and reuse for both Authorization and X-Group-Id.
    // WHY: Calling getSession() multiple times in the same interceptor wastes
    // round-trips and can create race conditions.
    let session = isPublic ? null : await getSession();

    if (!isPublic) {
      // If session is null on first try, retry with exponential backoff.
      // WHY: After page refresh, NextAuth SessionProvider may not be
      // initialized yet. A single 500ms wait was not always sufficient
      // on slow networks, causing requests to go out without a token â†’ 401.
      if (!session?.user?.accessToken) {
        const retryDelays = [300, 600, 1100];
        for (const delay of retryDelays) {
          console.warn(
            `[ApiClient] getSession() returned no token, retrying in ${delay}ms...`,
            { url: config.url, attempt: retryDelays.indexOf(delay) + 1, hasSession: !!session, hasUser: !!session?.user }
          );
          await new Promise((r) => setTimeout(r, delay));
          session = await getSession();
          if (session?.user?.accessToken) break;
        }
      }

      if (session?.user?.accessToken) {
        // âš ï¸ Check if the token refresh has failed â€” the session still holds the
        // OLD expired accessToken (spread from previous jwt state) but it will
        // always be rejected by the backend. Don't bother sending it.
        if ((session.user as any)?.error === 'RefreshTokenExpired') {
          console.warn('[ApiClient] Token refresh expired â€” redirecting to login.');
          if (!isSigningOut && typeof window !== 'undefined') {
            isSigningOut = true;
            signOut({ redirect: false }).then(() => {
              window.location.href = routes.signIn;
            });
          }
          return Promise.reject(
            new Error('Session expired. Redirecting to login...')
          );
        }
        config.headers.Authorization = `Bearer ${session.user.accessToken}`;
      } else {
        // âš ï¸ CRITICAL: Do NOT send the request without a token â€” it will
        // always fail with 401 "No token provided" and may trigger the
        // handleUnauthorized() sign-out flow needlessly.
        console.error(
          '[ApiClient] No access token available after retries â€” rejecting request.',
          {
            url: `${config.baseURL}${config.url}`,
            hasSession: !!session,
            hasUser: !!session?.user,
            sessionError: (session?.user as any)?.error,
          }
        );
        return Promise.reject(
          new Error(
            'No authentication token available. Please reload the page or sign in again.'
          )
        );
      }
    }

    // âš ï¸ Gateway requires X-Group-Id when the user belongs to multiple groups.
    // Prefer the user's selected workspace (localStorage), then first session group.
    if (!isPublic && !config.headers['X-Group-Id'] && session) {
      const groups = (session.user as Record<string, unknown>)?.groups;
      const groupId = resolveActiveGroupId(groups);
      if (groupId) {
        config.headers['X-Group-Id'] = groupId;
      }
    }

    // âš ï¸ For multipart/form-data (FormData), Axios must auto-detect Content-Type
    // and append the correct multipart boundary. If we keep the instance-default
    // 'application/json' header, the boundary is missing â†’ backend returns 422.
    // Deleting the header here lets Axios set it correctly for each request type.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Response interceptor: handle 401 and 403 ----
// Uses handleUnauthorized() which re-checks session before signing out.
// This prevents batch requests (Promise.allSettled) from triggering multiple signOuts.
gatewayClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && error.config) {
      const config = error.config as RetriableAxiosConfig;

      if (isPublicAuthGatewayClientPath(config.url)) {
        return Promise.reject(error);
      }

      console.error('[ApiClient] 401 Error Response:', {
        url: config.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        retried: Boolean(config._authRetried),
      });

      if (!isRevokedOrInvalidAuth(error) && !config._authRetried) {
        config._authRetried = true;
        try {
          const session = await getSession();
          if ((session?.user as { error?: string })?.error === 'RefreshTokenExpired') {
            await handleUnauthorized(error);
            return Promise.reject(error);
          }
          const token = session?.user?.accessToken;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            isSigningOut = false;
            return gatewayClient.request(config);
          }
        } catch (retryErr) {
          console.warn('[ApiClient] 401 refresh-retry failed:', retryErr);
        }
      }

      await handleUnauthorized(error);
    }

    if (error.response?.status === 403) {
      // 403 = authenticated but not authorized for this resource.
      console.warn('[ApiClient] 403 Access Denied:', {
        url: error.config?.url,
        data: error.response?.data,
      });
      maybeNotifyForbidden(error);
      // Do NOT sign out â€” the session is valid; only this specific endpoint is forbidden.
    }

    if (error.response?.status === 429) {
      pauseGatewayQueues(3000);
    }

    return Promise.reject(error);
  }
);

// ---- Default export: same gatewayClient for backward compatibility ----
// Previously `apiClient` pointed to Auth Service directly (port 8003).
// Now ALL traffic goes through Gateway (port 8000) with proper route prefixes.
const apiClient = gatewayClient;
export default apiClient;

// ---- Server-side API client (for use in Server Components / API routes) ----

export function createServerApiClient(accessToken: string): AxiosInstance {
  const client = axios.create({
    baseURL: API_GATEWAY_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return client;
}

