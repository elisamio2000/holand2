// ============================================
// Admin User Update — Server-side proxy API route
// Proxies PATCH requests to the API Gateway.
// Browser → /api/admin/users/{userId} → Next.js → Gateway (8000)
//
// Why server-side proxy?
// Serves as a server-side fallback for admin user updates.
// All communication goes through the API Gateway (port 8000).
//
// Known backend limitations:
// - is_active: Auth Service accepts but silently ignores (Keycloak mapping bug — BUG-001)
// ============================================

import { NextRequest, NextResponse } from 'next/server';

const API_GATEWAY_URL =
  process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';

/**
 * PATCH /api/admin/users/[userId]
 * Server-side proxy for updating user fields via API Gateway.
 *
 * Accepts: { email?, display_name?, bio?, is_active?, role_name? }
 * - email, display_name, bio → PATCH to Gateway /admin/users/{user_id} ✅
 * - is_active → PATCH to Gateway /admin/users/{user_id} ⚠️ (accepted but not applied — BUG-001)
 * - role_name → POST to Gateway /admin/roles/assign with user_id ✅
 *
 * @endpoint Gateway: PATCH /admin/users/{user_id}
 * @endpoint Gateway: POST /admin/roles/assign
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    if (!API_GATEWAY_URL) {
      return NextResponse.json(
        { detail: 'API_GATEWAY_URL is not configured' },
        { status: 500 }
      );
    }

    // Next.js 14+ may require awaiting params
    const resolvedParams = await Promise.resolve(context.params);
    const userId = resolvedParams.userId;

    if (!userId) {
      console.error('[API Route] Missing userId in params');
      return NextResponse.json(
        { detail: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      console.error('[API Route] Failed to parse request body');
      return NextResponse.json(
        { detail: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Forward the Authorization header from the client
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[API Route] No authorization header provided');
      return NextResponse.json(
        { detail: 'Authorization header is required' },
        { status: 401 }
      );
    }

    // Separate role_name from Auth Service fields
    // Auth Service PATCH /users/{user_id} accepts: email, display_name, bio, avatar_url, is_active
    // Role assignment is handled separately via POST /roles/assign
    const { role_name, ...userFields } = body;
    const warnings: string[] = [];

    // ---- Step 1: Update user fields via Gateway ----
    let userData: Record<string, unknown> = {};

    if (Object.keys(userFields).length > 0) {
      const targetUrl = `${API_GATEWAY_URL}/admin/users/${userId}`;
      console.info('[API Route] Updating user fields:', {
        targetUrl,
        fields: Object.keys(userFields),
      });

      const response = await fetch(targetUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(userFields),
      });

      const responseText = await response.text();
      let data: Record<string, unknown> | null = null;
      try {
        if (responseText) {
          data = JSON.parse(responseText) as Record<string, unknown>;
        }
      } catch {
        console.warn('[API Route] Non-JSON response:', responseText.slice(0, 200));
      }

      if (!response.ok) {
        console.error('[API Route] Gateway error:', {
          userId,
          status: response.status,
          data,
        });
        return NextResponse.json(
          data || { detail: `Gateway returned ${response.status}` },
          { status: response.status }
        );
      }

      userData = data || {};

      // ⚠️ Detect is_active silent ignore: backend returns 200 but
      // doesn't apply the change (Keycloak mapping bug — BUG-001)
      if (
        userFields.is_active !== undefined &&
        userData.is_active !== userFields.is_active
      ) {
        console.warn('[API Route] is_active change was ignored by backend:', {
          sent: userFields.is_active,
          returned: userData.is_active,
        });
        warnings.push(
          'Active status change was not applied. This is a known backend limitation.'
        );
      }

      console.info('[API Route] User fields updated via Gateway:', { userId });
    }

    // ---- Step 2: Handle role_name change via Gateway ----
    if (role_name !== undefined && typeof role_name === 'string') {
      // POST /admin/roles/assign supports admin assigning roles to other users
      // by including user_id in the request body
      console.info('[API Route] Assigning role to user:', { userId, role_name });
      try {
        const roleUrl = `${API_GATEWAY_URL}/admin/roles/assign`;
        const roleResponse = await fetch(roleUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({ role_name, user_id: userId }),
        });

        if (!roleResponse.ok) {
          const roleError = await roleResponse.text();
          console.error('[API Route] Role assignment failed:', {
            userId,
            role_name,
            status: roleResponse.status,
            error: roleError,
          });
          warnings.push(
            `Role change to "${role_name}" failed: ${roleResponse.status}`
          );
        } else {
          console.info('[API Route] Role assigned successfully:', { userId, role_name });
        }
      } catch (roleErr: unknown) {
        const msg = roleErr instanceof Error ? roleErr.message : String(roleErr);
        console.error('[API Route] Role assignment error:', { userId, role_name, error: msg });
        warnings.push(`Role assignment failed: ${msg}`);
      }
    }

    // Build the response
    const responseData = {
      ...userData,
      ...(warnings.length > 0 ? { _warnings: warnings } : {}),
    };

    console.info('[API Route] Update complete:', {
      userId,
      warnings: warnings.length,
    });
    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API Route] Proxy error:', message, error);
    return NextResponse.json(
      { detail: `Server error: ${message}` },
      { status: 502 }
    );
  }
}
