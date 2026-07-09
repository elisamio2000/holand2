import { pagesOptions } from '@/app/api/auth/[...nextauth]/pages-options';
import withAuth from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { isSilentMiddlewarePath, middlewareLogger } from '@/lib/edge-middleware-logger';
import { isPublicAuthGatewayProxyPath } from '@/config/public-auth-api-paths';

/**
 * Cookie prefix matching auth-options.ts — isolates sessions per PORT.
 *
 * @see auth-options.ts COOKIE_PREFIX
 */
const COOKIE_PREFIX = process.env.PORT
  ? `next-auth-${process.env.PORT}`
  : 'next-auth';

function applyDevelopmentNoCacheHeaders(response: NextResponse) {
  if (process.env.NODE_ENV === 'development') {
    response.headers.set(
      'Cache-Control',
      'private, no-cache, no-store, max-age=0, must-revalidate'
    );
  }
}

function clientIp(req: { headers: { get: (name: string) => string | null } }): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export default withAuth(
  function middleware(req) {
    const url = req.nextUrl.pathname;
    const token = req.nextauth.token;

    if (!token && url.startsWith('/api/') && !isPublicAuthGatewayProxyPath(url)) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = NextResponse.next();
    applyDevelopmentNoCacheHeaders(response);
    return response;
  },
  {
    pages: {
      ...pagesOptions,
    },
    cookies: {
      sessionToken: {
        name: `${COOKIE_PREFIX}.session-token`,
      },
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const url = req.nextUrl.pathname;
        const hasToken = !!token;

        /** Public pages — no session required (same policy as /auth/*). */
        if (url.startsWith('/legal/')) {
          return true;
        }

        if (!hasToken && !isSilentMiddlewarePath(url)) {
          middlewareLogger.http({
            method: req.method,
            path: url,
            clientIp: clientIp(req),
            auth: url.startsWith('/api/') ? 'missing' : 'denied',
          });
        }

        if (url.startsWith('/api/')) {
          return true;
        }

        return hasToken;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api/auth|api/health|auth/|legal/|access-denied|not-found|maintenance|coming-soon|welcome|icon|apple-icon)(?!.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|json|woff|woff2|ttf|eot|map|txt|xml|pdf|pbf|webm|mp4|mp3|m4a|wav|ogg|flac|aac|html)$).*)',
  ],
};
