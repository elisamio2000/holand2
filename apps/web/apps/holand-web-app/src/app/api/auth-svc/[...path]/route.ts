// ============================================
// Auth Service Proxy — DEPRECATED
// This proxy route is no longer used.
// All communication now goes through the API Gateway (port 8000)
// via /api/gateway/[...path] proxy route.
//
// Kept as a 410 Gone stub to prevent silent failures if
// any code still references this route.
// ============================================

import { NextResponse } from 'next/server';

// Required for catch-all API routes in Next.js 14 production builds
export const dynamic = 'force-dynamic';

/**
 * DEPRECATED — All auth service calls now route through API Gateway.
 *
 * Returns 410 Gone to indicate this endpoint is permanently removed.
 * Frontend should use gatewayClient (→ /api/gateway/*) for all API calls.
 */
function deprecatedHandler() {
  console.warn('[AuthProxy] DEPRECATED: /api/auth-svc/* is no longer available. Use /api/gateway/* instead.');
  return NextResponse.json(
    {
      detail: 'This proxy route is deprecated. All requests should go through /api/gateway/*.',
      migration: 'Use gatewayClient from @/lib/api-client instead of direct Auth Service calls.',
    },
    { status: 410 }
  );
}

// Export handlers for all HTTP methods
export const GET = deprecatedHandler;
export const POST = deprecatedHandler;
export const PUT = deprecatedHandler;
export const PATCH = deprecatedHandler;
export const DELETE = deprecatedHandler;
