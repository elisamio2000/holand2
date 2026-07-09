/**
 * Edge-safe middleware logger (no Node.js APIs like process.stdout).
 * English-only, one line per auth failure in compact mode.
 */

import { isPublicAuthGatewayProxyPath } from '@/config/public-auth-api-paths';

export interface MiddlewareHttpLogEntry {
  method: string;
  path: string;
  clientIp?: string;
  auth?: 'missing' | 'denied';
}

function resolveHttpLogMode(): 'compact' | 'verbose' | 'off' {
  const raw = (process.env.HTTP_LOG ?? 'compact').toLowerCase();
  if (raw === 'verbose' || raw === 'off') return raw;
  return 'compact';
}

function shouldLogAuthFailure(mode: 'compact' | 'verbose' | 'off'): boolean {
  return mode !== 'off';
}

export const middlewareLogger = {
  http(entry: MiddlewareHttpLogEntry): void {
    const mode = resolveHttpLogMode();
    if (!shouldLogAuthFailure(mode)) return;
    if (entry.auth !== 'missing' && entry.auth !== 'denied') return;

    const ts = new Date().toISOString();
    const method = entry.method.toUpperCase().padEnd(6);
    const client = entry.clientIp ? ` client=${entry.clientIp}` : '';
    console.log(
      `${ts} INFO  [middleware] ${method} ${entry.path} -> auth=${entry.auth}${client}`
    );
  },
};

/** Paths that never need middleware auth logs (static assets, session polling, RSC). */
export function isSilentMiddlewarePath(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/api/auth/session')) return true;
  if (pathname.startsWith('/api/auth/_log')) return true;
  if (isPublicAuthGatewayProxyPath(pathname)) return true;
  if (pathname === '/api/health') return true;
  if (pathname === '/icon' || pathname === '/apple-icon') return true;
  if (/\.(png|jpe?g|gif|webp|ico|svg|woff2?|css|js|mjs|map|txt)$/i.test(pathname)) return true;
  return false;
}
