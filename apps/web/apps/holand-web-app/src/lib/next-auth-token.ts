import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import {
  NEXT_AUTH_SESSION_COOKIE,
  USE_SECURE_AUTH_COOKIES,
} from '@/lib/next-auth-cookie';

/** Decode the NextAuth JWT from the request cookie (PORT-scoped cookie name). */
export async function getRequestAuthToken(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const primary = await getToken({
    req: request,
    secret,
    secureCookie: USE_SECURE_AUTH_COOKIES,
    cookieName: NEXT_AUTH_SESSION_COOKIE,
  });
  if (primary) return primary;

  // Fallback for sessions created before PORT-based prefix was introduced
  return getToken({
    req: request,
    secret,
    secureCookie: USE_SECURE_AUTH_COOKIES,
    cookieName: 'next-auth.session-token',
  });
}
