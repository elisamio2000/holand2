/**
 * Auth routes that must work without a NextAuth session.
 * Keep in sync: middleware (`/api/gateway/...`) and api-client (`/auth/...`).
 */
export const PUBLIC_AUTH_GATEWAY_SUFFIXES = [
  '/auth/login',
  '/auth/register',
  '/auth/registration-info',
  '/auth/refresh',
  '/auth/logout',
] as const;

export const PUBLIC_GATEWAY_SUFFIXES = [
  ...PUBLIC_AUTH_GATEWAY_SUFFIXES,
  '/platform/defaults',
] as const;

/**
 * True when a Next.js middleware pathname is a public gateway proxy route.
 */
export function isPublicAuthGatewayProxyPath(pathname: string): boolean {
  if (!pathname.startsWith('/api/gateway/')) {
    return false;
  }
  const pathWithoutQuery = pathname.split('?')[0] ?? pathname;
  return PUBLIC_GATEWAY_SUFFIXES.some(
    (suffix) => pathWithoutQuery === `/api/gateway${suffix}`
  );
}

/**
 * True when an axios gatewayClient URL is a public auth route (relative path).
 */
export function isPublicAuthGatewayClientPath(url?: string): boolean {
  if (!url) {
    return false;
  }
  return PUBLIC_GATEWAY_SUFFIXES.some((suffix) => url.includes(suffix));
}
