/**
 * Roles & Permissions — Utility helpers
 *
 * DEV NOTE: These are now helper functions for transforming backend data.
 * Static ROLES/PERMISSIONS/STATUSES constants from the template are no longer used.
 * All data comes from the backend via adminService.
 */

import type { TFunction } from 'i18next';

/** Status options for user filter dropdowns */
export const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
] as const;

/** Map backend is_active boolean to display status */
export function getStatusLabel(isActive: boolean): string {
  return isActive ? 'Active' : 'Inactive';
}

/** Format permission string for display: "chat:read" → "Chat Read" */
export function formatPermission(permission: string): string {
  return permission
    .split(':')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** i18n key for known system role display names (fallback: role name). */
export function roleDisplayNameKey(roleName: string): string {
  return `rolesGrid.roleNames.${roleName.trim().toLowerCase()}`;
}

/** Localized role display name with fallback to raw slug. */
export function roleDisplayNameI18n(roleName: string, t: TFunction): string {
  const normalized = roleName.trim().toLowerCase();
  return t(roleDisplayNameKey(normalized), { defaultValue: roleName });
}

/** i18n key for RBAC nav section slug (backend `section_id`). */
export function rbacSectionLabelKey(sectionId: string): string {
  return `permissions.sections.names.${sectionId.trim().toLowerCase()}`;
}

/**
 * Localized RBAC section label for permissions matrices.
 * Prefers frontend i18n over backend `section_metadata.name` (DB seed is locale-agnostic).
 */
export function rbacSectionLabelI18n(sectionId: string, t: TFunction): string {
  const normalized = sectionId.trim().toLowerCase();
  const key = rbacSectionLabelKey(normalized);
  const translated = t(key, { defaultValue: '' });
  if (translated && translated !== key) return translated;
  return normalized.replace(/-/g, ' ');
}

export interface PermissionCatalogItem {
  permission_id: string;
  label?: string | null;
  metadata?: { name?: string } | null;
}

/** File override action keys used in FileOverridesTab. */
export const FILE_OVERRIDE_ACTIONS = ['read', 'write', 'delete'] as const;

/** i18n key for file override action chip (read/write/delete). */
export function fileOverrideActionLabelKey(action: string): string {
  const map: Record<string, string> = {
    read: 'permissions.fileOverrides.actionRead',
    write: 'permissions.fileOverrides.actionWrite',
    delete: 'permissions.fileOverrides.actionDelete',
  };
  return map[action] ?? `permissions.actions.${action}`;
}

/** Translate file override action label. */
export function fileOverrideActionLabelI18n(action: string, t: TFunction): string {
  return t(fileOverrideActionLabelKey(action), { defaultValue: action });
}

/** i18n key for permission action suffix (read, write, import_shared, …). */
export function permissionActionLabelKey(action: string): string {
  return `permissions.actions.${action}`;
}

/** Translate permission action suffix with fallback to humanized text. */
export function permissionActionLabelI18n(action: string, t: TFunction): string {
  const key = permissionActionLabelKey(action);
  const translated = t(key, { defaultValue: '' });
  if (translated && translated !== key) return translated;
  return action.replace(/_/g, ' ');
}

/** i18n key for permission category header. */
export function permissionCategoryLabelKey(category: string): string {
  const normalized = category.replace(/-/g, '_').toLowerCase();
  return `permissions.categories.${normalized}`;
}

/** Translate permission category header. */
export function permissionCategoryLabelI18n(category: string, t: TFunction): string {
  const key = permissionCategoryLabelKey(category);
  return t(key, { defaultValue: category.replace(/_/g, ' ') });
}

/** Merge matrix.labels with permission_catalog rows (matrix API may omit labels). */
export function mergePermissionLabels(
  matrixLabels: Record<string, string> | null | undefined,
  catalogItems: PermissionCatalogItem[] | null | undefined
): Record<string, string> {
  const labels = { ...(matrixLabels ?? {}) };
  for (const item of catalogItems ?? []) {
    const pid = item.permission_id?.trim();
    if (!pid || labels[pid]) continue;
    const label = item.label?.trim();
    const metaName = item.metadata?.name?.trim();
    if (label) labels[pid] = label;
    else if (metaName) labels[pid] = `Map Layer: ${metaName}`;
  }
  return labels;
}

/** Matrix row label: prefer catalog label, else humanized permission id. */
export function matrixPermissionLabel(
  permission: string,
  labels?: Record<string, string> | null
): string {
  const catalog = labels?.[permission]?.trim();
  if (catalog) return catalog;
  if (permission.startsWith('map_layer:')) return 'Map Layer';
  const suffix = permission.split(':').slice(1).join(':');
  if (suffix && !/^[0-9a-f-]{36}$/i.test(suffix)) return suffix;
  return formatPermission(permission);
}

/**
 * Matrix row label with i18n fallbacks for actions and map layers.
 * Prefers backend catalog label when present.
 */
export function matrixPermissionLabelI18n(
  permission: string,
  labels: Record<string, string> | null | undefined,
  t: TFunction
): string {
  const catalog = labels?.[permission]?.trim();
  if (catalog) return catalog;

  if (permission.startsWith('map_layer:')) {
    const suffix = permission.split(':').slice(1).join(':');
    if (suffix && !/^[0-9a-f-]{36}$/i.test(suffix)) {
      return t('permissions.mapLayerNamed', { name: suffix, defaultValue: suffix });
    }
    return t('permissions.mapLayer');
  }

  const parts = permission.split(':');
  const action = parts[parts.length - 1] ?? '';
  const resource = parts.slice(0, -1).join(':');

  if (action && !/^[0-9a-f-]{36}$/i.test(action)) {
    const actionLabel = permissionActionLabelI18n(action, t);
    if (resource) {
      const categoryLabel = permissionCategoryLabelI18n(resource, t);
      return `${categoryLabel} — ${actionLabel}`;
    }
    return actionLabel;
  }

  return formatPermission(permission);
}

/** Group permissions by resource category: "chat:read", "chat:write" → { chat: ["read", "write"] } */
export function groupPermissions(
  permissions: string[]
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const perm of permissions) {
    const parts = perm.split(':');
    const category = parts.slice(0, -1).join(':') || 'other';
    const action = parts[parts.length - 1];
    if (!groups[category]) groups[category] = [];
    groups[category].push(action);
  }
  return groups;
}
