/**
 * Maps frontend pathname prefixes to RBAC section IDs.
 * Used by sidebar (menu-items), route guard, and command palette filtering.
 */
export const NAV_PATH_SECTION_MAP: { prefix: string; section: string }[] = [
  { prefix: '/ai-chat', section: 'chat' },
  { prefix: '/one-search', section: 'one-search' },
  { prefix: '/case-importer', section: 'case-viewer' },
  { prefix: '/cases', section: 'case-viewer' },
  { prefix: '/file-manager', section: 'file-manager' },
  { prefix: '/file-explorer', section: 'file-manager' },
  { prefix: '/storage', section: 'database' },
  { prefix: '/boards', section: 'boards' },
  { prefix: '/graph-explorer', section: 'tools-panel' },
  { prefix: '/graph/visual-explorer', section: 'tools-panel' },
  { prefix: '/graph/edit-entities', section: 'tools-panel' },
  { prefix: '/plugins', section: 'tools-panel' },
  { prefix: '/projects', section: 'projects' },
  { prefix: '/messages', section: 'messages' },
  { prefix: '/event-calendar', section: 'calendar' },
  { prefix: '/reports', section: 'reports' },
  { prefix: '/roles-permissions', section: 'admin' },
  { prefix: '/admin-panel', section: 'admin' },
  { prefix: '/admin', section: 'admin' },
  { prefix: '/account', section: 'profile' },
  { prefix: '/forms/profile-settings', section: 'profile' },
  { prefix: '/workspace', section: 'profile' },
  { prefix: '/profile', section: 'profile' },
];

/** Optional fine-grained permission gates (any match grants access). */
export const NAV_PATH_PERMISSION_MAP: { prefix: string; permissions: string[] }[] = [
  { prefix: '/boards', permissions: ['boards:read'] },
  { prefix: '/projects', permissions: ['projects:read', 'tasks:read'] },
  { prefix: '/event-calendar', permissions: ['calendar:read'] },
  { prefix: '/account', permissions: ['profile:read'] },
  { prefix: '/forms/profile-settings', permissions: ['profile:read'] },
  { prefix: '/workspace', permissions: ['workspace:settings:read', 'profile:read'] },
  { prefix: '/admin-panel/settings/registration', permissions: ['admin:registration:read', 'admin:settings:read'] },
  { prefix: '/admin-panel/settings/system', permissions: ['admin:system:read', 'admin:settings:read'] },
  { prefix: '/admin-panel/settings/llm', permissions: ['admin:llm:read', 'admin:settings:read'] },
  { prefix: '/admin-panel/settings/appearance', permissions: ['admin:appearance:read', 'admin:settings:read'] },
];

/** Paths always allowed regardless of section (help, auth, dev hub basics). */
export const NAV_PUBLIC_AUTHENTICATED_PATHS = [
  '/',
  '/access-denied',
  '/dev',
  '/help',
  '/auth',
];

/**
 * Resolve required RBAC section for a pathname, if any.
 * @param pathname - Current route pathname
 * @returns Section id or null when no section gate applies
 */
export function resolveNavSectionForPath(pathname: string): string | null {
  if (NAV_PUBLIC_AUTHENTICATED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  for (const { prefix, section } of NAV_PATH_SECTION_MAP) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return section;
    }
  }

  return null;
}

/**
 * Resolve optional fine-grained permission requirement for a pathname.
 * @param pathname - Current route pathname
 * @returns Permission ids (any match grants access) or null
 */
export function resolveNavPermissionsForPath(pathname: string): string[] | null {
  for (const { prefix, permissions } of NAV_PATH_PERMISSION_MAP) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return permissions;
    }
  }
  return null;
}

/**
 * Check whether a nav href is visible for the given allowed sections.
 * @param href - Menu or palette href
 * @param allowedSections - Session allowed section ids
 * @param isSuperAdmin - Super-admin bypass
 */
export function isNavHrefAllowed(
  href: string | undefined,
  allowedSections: string[],
  isSuperAdmin?: boolean
): boolean {
  if (!href || isSuperAdmin) return true;
  const section = resolveNavSectionForPath(href);
  if (!section) return true;
  return allowedSections.includes(section);
}
