/**
 * Permissions sub-tab keys and URL paths under /roles-permissions/permissions/.
 */
export const PERMISSIONS_SUB_TABS = [
  'matrix',
  'overrides',
  'file-overrides',
  'hierarchy',
  'sections',
  'routes',
  'rate-limits',
  'custom-roles',
  'audit-log',
  'config',
] as const;

export type PermissionsSubTab = (typeof PERMISSIONS_SUB_TABS)[number];

export const DEFAULT_PERMISSIONS_SUB_TAB: PermissionsSubTab = 'matrix';

/**
 * Validate permissions sub-tab segment from URL.
 * @param segment - URL path segment
 */
export function parsePermissionsSubTab(segment?: string): PermissionsSubTab {
  if (segment && PERMISSIONS_SUB_TABS.includes(segment as PermissionsSubTab)) {
    return segment as PermissionsSubTab;
  }
  return DEFAULT_PERMISSIONS_SUB_TAB;
}

/** Build full path for a permissions sub-tab. */
export function permissionsSubTabPath(subTab: PermissionsSubTab): string {
  return `/roles-permissions/permissions/${subTab}`;
}
