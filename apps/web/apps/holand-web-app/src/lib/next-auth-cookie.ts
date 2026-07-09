/**
 * NextAuth cookie names — must match auth-options.ts and middleware.ts.
 * PORT-based prefix isolates sessions per dev server port.
 */
export const NEXT_AUTH_COOKIE_PREFIX = process.env.PORT
  ? `next-auth-${process.env.PORT}`
  : 'next-auth';

export const NEXT_AUTH_SESSION_COOKIE = `${NEXT_AUTH_COOKIE_PREFIX}.session-token`;

export const USE_SECURE_AUTH_COOKIES = (process.env.NEXTAUTH_URL || '').startsWith('https://');
