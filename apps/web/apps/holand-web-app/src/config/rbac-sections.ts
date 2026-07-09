/**
 * Canonical RBAC section IDs — keep in sync with backend Section enum
 * (auth-service `rbac/config.py` + `rbac_section_metadata` in Postgres).
 *
 * Used for super-admin login fallback when permission endpoints are unavailable.
 */
export const RBAC_SECTION_IDS = [
  'chat',
  'messages',
  'database',
  'face-recognition',
  'visual-search',
  'tools-panel',
  'case-viewer',
  'admin',
  'profile',
  'one-search',
  'file-manager',
  'boards',
  'projects',
  'reports',
  'calendar',
  'career-guidance',
  'counselor',
] as const;

export type RbacSectionId = (typeof RBAC_SECTION_IDS)[number];

/** All section IDs as a mutable array (e.g. NextAuth session fallback). */
export const ALL_RBAC_SECTIONS: string[] = [...RBAC_SECTION_IDS];
