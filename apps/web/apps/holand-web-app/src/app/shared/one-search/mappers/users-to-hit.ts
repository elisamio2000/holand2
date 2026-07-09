// ============================================
// admin.users (client filter) → OneSearchHit
// ============================================

import { routes } from '@/config/routes';
import type { UserResponse } from '@/types/auth.types';
import type { OneSearchHit } from '@/types/one-search.types';

export const USERS_TOOL = 'admin.users';
export const USERS_ENDPOINT = 'GET /admin/users';

export function mapUsersToHits(
  users: UserResponse[],
  query: string,
  args: Record<string, unknown>
): OneSearchHit[] {
  return users.map((u) => ({
    id: `user-${u.id}`,
    title: u.username || u.email || u.id,
    snippet: [u.email, u.role].filter(Boolean).join(' · '),
    href: routes.profile,
    meta: {
      user_id: u.id,
      email: u.email,
      role: u.role,
      source: USERS_TOOL,
      sourceEndpoint: USERS_ENDPOINT,
      sourceArgs: args,
      lane: 'users',
      clientSideFilter: true,
    },
  }));
}
