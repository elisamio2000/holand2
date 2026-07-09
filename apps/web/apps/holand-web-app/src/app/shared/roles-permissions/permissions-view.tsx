'use client';

import { Tooltip, IconTooltip } from '@/components/tooltip';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ActionIcon, Badge, Button, Empty, Input, Loader, Select, Text, Title } from 'rizzui';
import {
  PiCheckBold,
  PiXBold,
  PiTrashBold,
  PiPlusBold,
  PiCopyBold,
  PiArrowsClockwiseBold,
  PiShieldCheckBold,
  PiFunnelBold,
  PiWarningBold,
  PiTreeStructureBold,
  PiGaugeBold,
  PiPathBold,
  PiSquaresFourBold,
  PiClockCounterClockwiseBold,
  PiGearSixBold,
  PiExportBold,
  PiUploadBold,
  PiArrowCounterClockwiseBold,
  PiLightningBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiPencilSimpleBold,
  PiFloppyDiskBold,
  PiCrownBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { adminService } from '@/services/admin.service';
import {
  matrixPermissionLabel,
  matrixPermissionLabelI18n,
  fileOverrideActionLabelI18n,
  permissionCategoryLabelI18n,
  rbacSectionLabelI18n,
  roleDisplayNameI18n,
} from '@/app/shared/roles-permissions/utils';
import {
  type PermissionsSubTab,
  permissionsSubTabPath,
} from '@/app/shared/roles-permissions/permissions-sub-tabs';
import type {
  PermissionsMatrix,
  PermissionOverrideResponse,
  FileOverrideResponse,
  CreateCustomRoleRequest,
  CloneCustomRoleRequest,
} from '@/types/auth.types';

/**
 * Permissions View — Full permissions management tab
 * Sub-tabs: Matrix | Overrides | File Overrides
 *
 * ✅ GET /rbac/permissions/matrix
 * ✅ POST /rbac/permissions — toggle permission per role
 * ✅ GET /overrides/permissions — list overrides
 * ✅ POST /overrides/permissions — create override
 * ✅ DELETE /overrides/permissions/:id — delete override
 * ✅ GET /overrides/files — list file overrides
 * ✅ POST /overrides/files — create file override
 * ✅ DELETE /overrides/files/:id — delete file override
 */

type SubTab = PermissionsSubTab;

/** Extract HTTP status and role list from a gateway 403 response. */
function parseAxiosForbiddenDetail(err: unknown): {
  status?: number;
  apiRoles?: string[];
} {
  const axiosErr = err as {
    response?: { status?: number; data?: { detail?: string | Record<string, unknown> } };
  };
  const status = axiosErr?.response?.status;
  const detail = axiosErr?.response?.data?.detail;
  let apiRoles: string[] | undefined;
  if (detail && typeof detail === 'object' && Array.isArray((detail as { your_roles?: string[] }).your_roles)) {
    apiRoles = (detail as { your_roles: string[] }).your_roles;
  }
  return { status, apiRoles };
}

/** Localized role display name with fallback to raw slug. */
function roleDisplayName(t: (key: string, options?: { defaultValue?: string }) => string, role: string): string {
  return roleDisplayNameI18n(role, t);
}

interface PermissionsViewProps {
  /** Initial sub-tab from URL segment */
  initialSubTab?: SubTab;
}

export default function PermissionsView({
  initialSubTab = 'matrix',
}: PermissionsViewProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);

  const handleSubTabChange = useCallback(
    (tab: SubTab) => {
      console.info('[PermissionsView] Sub-tab changed:', { to: tab });
      setSubTab(tab);
      router.replace(permissionsSubTabPath(tab), { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const tabs: { key: SubTab; labelKey: string; icon: React.ReactNode }[] = [
    { key: 'matrix', labelKey: 'permissions.subTabs.matrix', icon: <PiSquaresFourBold className="h-3.5 w-3.5" /> },
    { key: 'overrides', labelKey: 'permissions.subTabs.overrides', icon: <PiShieldCheckBold className="h-3.5 w-3.5" /> },
    { key: 'file-overrides', labelKey: 'permissions.subTabs.fileOverrides', icon: <PiShieldCheckBold className="h-3.5 w-3.5" /> },
    { key: 'hierarchy', labelKey: 'permissions.subTabs.hierarchy', icon: <PiTreeStructureBold className="h-3.5 w-3.5" /> },
    { key: 'sections', labelKey: 'permissions.subTabs.sections', icon: <PiSquaresFourBold className="h-3.5 w-3.5" /> },
    { key: 'routes', labelKey: 'permissions.subTabs.routes', icon: <PiPathBold className="h-3.5 w-3.5" /> },
    { key: 'rate-limits', labelKey: 'permissions.subTabs.rateLimits', icon: <PiGaugeBold className="h-3.5 w-3.5" /> },
    { key: 'custom-roles', labelKey: 'permissions.subTabs.customRoles', icon: <PiCrownBold className="h-3.5 w-3.5" /> },
    { key: 'audit-log', labelKey: 'permissions.subTabs.auditLog', icon: <PiClockCounterClockwiseBold className="h-3.5 w-3.5" /> },
    { key: 'config', labelKey: 'permissions.subTabs.config', icon: <PiGearSixBold className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-tab selector — bg/border must live on the scroll container so overflow tabs stay styled */}
      <div className="flex flex-wrap gap-1 overflow-x-auto rounded-xl border border-muted bg-gray-100 p-1 dark:bg-gray-200/70 lg:flex-nowrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleSubTabChange(tab.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all sm:px-4 sm:text-sm',
              subTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50 dark:bg-gray-50 dark:ring-gray-300/30'
                : 'text-gray-500 hover:bg-white/50 hover:text-gray-700 dark:hover:bg-gray-50/30'
            )}
          >
            <span className={cn(
              'transition-colors',
              subTab === tab.key ? 'text-primary' : 'text-gray-400'
            )}>
              {tab.icon}
            </span>
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {subTab === 'matrix' && <PermissionsMatrixTab />}
      {subTab === 'overrides' && <PermissionOverridesTab />}
      {subTab === 'file-overrides' && <FileOverridesTab />}
      {subTab === 'hierarchy' && <RoleHierarchyTab />}
      {subTab === 'sections' && <SectionPermissionsTab />}
      {subTab === 'routes' && <RoutePermissionsTab />}
      {subTab === 'rate-limits' && <RateLimitsTab />}
      {subTab === 'custom-roles' && <CustomRolesTab />}
      {subTab === 'audit-log' && <AuditLogTab />}
      {subTab === 'config' && <RbacConfigTab />}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Permissions Matrix Tab
   ════════════════════════════════════════════════ */
function PermissionsMatrixTab() {
  const { t } = useTranslation();
  const [matrix, setMatrix] = useState<PermissionsMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  /** HTTP status code when fetch fails — used to show 404/403 banners */
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setErrorStatus(null);
    try {
      const data = await adminService.getPermissionsMatrix();
      setMatrix(data);
    } catch (err: any) {
      const status = err?.response?.status;
      setErrorStatus(status || 0);
      console.error('[PermissionsMatrixTab] Failed to load matrix:', { status, error: err });
      if (status === 404) {
        // Don't toast for 404 — we show a banner instead
        console.warn('[PermissionsMatrixTab] Endpoint not found (404) — backend not implemented');
      } else if (status === 403) {
        console.warn('[PermissionsMatrixTab] Access denied (403)');
      } else {
        toast.error(t('permissions.matrix.loadError'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const handleToggle = async (
    role: string,
    permission: string,
    currentValue: boolean
  ) => {
    const key = `${role}:${permission}`;
    setSaving(key);
    try {
      await adminService.assignPermission({
        role,
        permission,
        action: currentValue ? 'remove' : 'add',
      });
      // Update local state
      setMatrix((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          permissions: {
            ...prev.permissions,
            [permission]: {
              ...prev.permissions[permission],
              [role]: !currentValue,
            },
          },
        };
      });
      toast.success(t('permissions.matrix.updateSuccess'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('permissions.matrix.updateError'));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  if (!matrix) {
    // Show specific error banner based on HTTP status code
    if (errorStatus === 404) {
      return (
        <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-6 dark:border-orange-800 dark:bg-orange-950/30">
          <div className="flex items-start gap-3">
            <PiWarningBold className="h-6 w-6 shrink-0 text-orange-500" />
            <div>
              <Title as="h5" className="font-semibold text-orange-700 dark:text-orange-400">
                {t('permissions.common.backendNotAvailable')}
              </Title>
              <Text className="mt-1 text-sm text-orange-600 dark:text-orange-300">
                {t('permissions.matrix.endpoint404Hint')}
              </Text>
              <div className="mt-3 rounded-md bg-orange-100 p-3 dark:bg-orange-900/30">
                <code className="text-xs text-orange-700 dark:text-orange-300">
                  {t('permissions.matrix.endpoint404')}
                </code>
              </div>
              <Text className="mt-3 text-xs text-orange-500">
                {t('permissions.common.backendNotAvailableHint')}
              </Text>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={fetchMatrix}
              >
                <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
                {t('permissions.common.retry')}
              </Button>
            </div>
          </div>
        </div>
      );
    }
    if (errorStatus === 403) {
      return (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <PiWarningBold className="h-6 w-6 shrink-0 text-red-500" />
            <div>
              <Title as="h5" className="font-semibold text-red-700 dark:text-red-400">
                {t('permissions.common.accessDeniedTitle')}
              </Title>
              <Text className="mt-1 text-sm text-red-600 dark:text-red-300">
                {t('permissions.matrix.accessDeniedMessage')}
              </Text>
              <div className="mt-3 rounded-md bg-red-100 p-3 dark:bg-red-900/30">
                <code className="text-xs text-red-700 dark:text-red-300">
                  {t('permissions.matrix.endpoint403')}
                </code>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
        <Empty
          text={t('permissions.matrix.loadError')}
          textClassName="text-sm text-gray-500 mt-2"
        />
        <Button variant="outline" size="sm" onClick={fetchMatrix}>
          <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
          {t('permissions.common.retry')}
        </Button>
      </div>
    );
  }

  const allPermissions = Object.keys(matrix.permissions);

  // Group permissions by category
  const categoryMap: Record<string, string[]> = {};
  if (matrix.categories) {
    Object.entries(matrix.categories).forEach(([cat, perms]) => {
      categoryMap[cat] = perms;
    });
  } else {
    allPermissions.forEach((perm) => {
      const cat = perm.split(':')[0] || 'other';
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(perm);
    });
  }

  // Filter
  const filteredCategories = Object.entries(categoryMap)
    .map(([cat, perms]) => [
      cat,
      filter
        ? perms.filter((p) => {
            const needle = filter.toLowerCase();
            const label = matrixPermissionLabelI18n(p, matrix.labels, t).toLowerCase();
            return (
              p.toLowerCase().includes(needle) ||
              label.includes(needle) ||
              cat.toLowerCase().includes(needle)
            );
          })
        : perms,
    ] as [string, string[]])
    .filter(([, perms]) => perms.length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiShieldCheckBold className="h-5 w-5 text-primary" />
          {t('permissions.matrix.title')}
        </Title>
        <div className="flex items-center gap-2">
          <Input
            prefix={<PiFunnelBold className="h-4 w-4" />}
            placeholder={t('permissions.matrix.filterPlaceholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            size="sm"
            className="w-64"
          />
          <IconTooltip content={t('permissions.common.refreshTooltip')} preset="toolbar">
            <ActionIcon variant="outline" onClick={fetchMatrix} size="sm">
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
        </div>
      </div>

      {/* Matrix table */}
      <div className="overflow-auto rounded-lg border border-muted">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-200/70">
            <tr>
              <th className="sticky start-0 z-10 bg-gray-100 px-4 py-3 text-start font-medium dark:bg-gray-200/70">
                {t('permissions.matrix.permissionHeader')}
              </th>
              {matrix.roles.map((role) => (
                <th
                  key={role}
                  className="px-4 py-3 text-center font-medium"
                >
                  {roleDisplayName(t, role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {filteredCategories.map(([category, perms]) => (
              <Fragment key={category}>
                {/* Category header row */}
                <tr>
                  <td
                    colSpan={matrix.roles.length + 1}
                    className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-100/50"
                  >
                    {permissionCategoryLabelI18n(category, t)}
                  </td>
                </tr>
                {/* Permission rows */}
                {perms.map((perm) => {
                  const action = matrixPermissionLabelI18n(perm, matrix.labels, t);
                  return (
                    <tr
                      key={perm}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                    >
                      <td className="sticky start-0 z-10 bg-white px-4 py-2 font-mono text-xs dark:bg-gray-50">
                        <Tooltip content={perm} placement="right">
                          <span>{action}</span>
                        </Tooltip>
                      </td>
                      {matrix.roles.map((role) => {
                        const dbGranted =
                          matrix.permissions[perm]?.[role] ?? false;
                        const granted =
                          matrix.effective?.[role]?.[perm] ?? dbGranted;
                        const key = `${role}:${perm}`;
                        const isSaving = saving === key;
                        return (
                          <td
                            key={role}
                            className="px-4 py-2 text-center"
                          >
                            <button
                              onClick={() =>
                                handleToggle(role, perm, dbGranted)
                              }
                              disabled={isSaving}
                              className={cn(
                                'inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all',
                                granted
                                  ? 'border-green-300 bg-green-50 text-green-600 hover:bg-green-100'
                                  : 'border-gray-200 bg-white text-gray-300 hover:border-gray-400 hover:text-gray-500 dark:bg-gray-50',
                                granted && !dbGranted && 'ring-1 ring-green-400/60',
                                isSaving && 'animate-pulse'
                              )}
                            >
                              {granted ? (
                                <PiCheckBold className="h-3.5 w-3.5" />
                              ) : (
                                <PiXBold className="h-3 w-3" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Text className="text-xs text-gray-500">
        {t('permissions.matrix.description')}
      </Text>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Permission Overrides Tab
   ════════════════════════════════════════════════ */
function PermissionOverridesTab() {
  const { t } = useTranslation();
  const [overrides, setOverrides] = useState<PermissionOverrideResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    permission: '',
    override_type: 'grant' as 'grant' | 'deny',
    reason: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getPermissionOverrides();
      setOverrides(data);
    } catch {
      toast.error(t('permissions.overrides.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const handleCreate = async () => {
    if (!formData.user_id || !formData.permission) return;
    setCreating(true);
    try {
      await adminService.createPermissionOverride({
        user_id: formData.user_id,
        permission: formData.permission,
        override_type: formData.override_type,
        reason: formData.reason || null,
      });
      toast.success(t('permissions.overrides.addSuccess'));
      setFormData({ user_id: '', permission: '', override_type: 'grant', reason: '' });
      setShowForm(false);
      fetchOverrides();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('permissions.overrides.addError'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('permissions.overrides.deleteConfirm'))) return;
    try {
      await adminService.deletePermissionOverride(id);
      toast.success(t('permissions.overrides.deleteSuccess'));
      setOverrides((prev) => prev.filter((o) => o.id !== id));
    } catch {
      toast.error(t('permissions.overrides.deleteError'));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiWarningBold className="h-5 w-5 text-orange-500" />
          {t('permissions.overrides.title')}
        </Title>
        <div className="flex gap-2">
          <IconTooltip content={t('permissions.common.refreshTooltip')} preset="toolbar">
            <ActionIcon variant="outline" onClick={fetchOverrides} size="sm">
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
          <Button
            size="sm"
            variant={showForm ? 'outline' : 'solid'}
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1"
          >
            <PiPlusBold size={14} />
            {showForm ? t('common.cancel') : t('permissions.overrides.newOverride')}
          </Button>
        </div>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label={`${t('permissions.overrides.userIdHeader')} *`}
              size="sm"
              value={formData.user_id}
              onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            />
            <Input
              label={`${t('permissions.overrides.permissionHeader')} *`}
              size="sm"
              placeholder={t('permissions.overrides.permissionPlaceholder')}
              value={formData.permission}
              onChange={(e) => setFormData({ ...formData, permission: e.target.value })}
            />
            <Select
              label={t('permissions.overrides.typeHeader')}
              size="sm"
              options={[
                { value: 'grant', label: t('permissions.overrides.grant') },
                { value: 'deny', label: t('permissions.overrides.deny') },
              ]}
              value={
                formData.override_type === 'grant'
                  ? { value: 'grant', label: t('permissions.overrides.grant') }
                  : { value: 'deny', label: t('permissions.overrides.deny') }
              }
              onChange={(opt: any) =>
                setFormData({ ...formData, override_type: opt?.value || 'grant' })
              }
            />
            <Input
              label={t('permissions.overrides.reasonLabel')}
              size="sm"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleCreate} isLoading={creating}>
              {t('permissions.overrides.createOverride')}
            </Button>
          </div>
        </div>
      )}

      {/* Overrides list */}
      {overrides.length === 0 ? (
        <Empty
          text={t('common.noData')}
          textClassName="text-sm text-gray-500 mt-2"
        />
      ) : (
        <div className="overflow-auto rounded-lg border border-muted">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-200/70">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.overrides.userIdHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.overrides.permissionHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.overrides.typeHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.overrides.reasonHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.overrides.createdHeader')}</th>
                <th className="px-3 py-2 text-end font-medium">{t('permissions.overrides.actionHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {overrides.map((o) => (
                <tr key={o.id}>
                  <td className="px-3 py-2 font-mono text-xs">{o.user_id}</td>
                  <td className="px-3 py-2 font-mono text-xs">{o.permission}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="flat"
                      color={o.override_type === 'grant' ? 'success' : 'danger'}
                      size="sm"
                    >
                      {o.override_type === 'grant'
                        ? t('permissions.overrides.grant')
                        : t('permissions.overrides.deny')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {o.reason || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <IconTooltip content={t('permissions.common.deleteTooltip')} preset="toolbar" placement="left">
                      <ActionIcon
                        size="sm"
                        variant="outline"
                        color="danger"
                        onClick={() => handleDelete(o.id)}
                      >
                        <PiTrashBold size={14} />
                      </ActionIcon>
                    </IconTooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   File Overrides Tab
   ════════════════════════════════════════════════ */
function FileOverridesTab() {
  const { t } = useTranslation();
  const [overrides, setOverrides] = useState<FileOverrideResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    artifact_id: '',
    permissions: ['read'] as string[],
    reason: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getFileOverrides();
      setOverrides(data);
    } catch {
      toast.error(t('errors.loadData'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const handleCreate = async () => {
    if (!formData.user_id || !formData.artifact_id) return;
    setCreating(true);
    try {
      await adminService.createFileOverride({
        user_id: formData.user_id,
        artifact_id: formData.artifact_id,
        permissions: formData.permissions,
        reason: formData.reason || null,
      });
      toast.success(t('permissions.fileOverrides.addSuccess'));
      setFormData({ user_id: '', artifact_id: '', permissions: ['read'], reason: '' });
      setShowForm(false);
      fetchOverrides();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('permissions.fileOverrides.addError'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('permissions.fileOverrides.deleteConfirm'))) return;
    try {
      await adminService.deleteFileOverride(id);
      toast.success(t('permissions.fileOverrides.deleteSuccess'));
      setOverrides((prev) => prev.filter((o) => o.id !== id));
    } catch {
      toast.error(t('permissions.fileOverrides.deleteError'));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          {t('permissions.fileOverrides.title')}
        </Title>
        <div className="flex gap-2">
          <IconTooltip content={t('permissions.common.refreshTooltip')} preset="toolbar">
            <ActionIcon variant="outline" onClick={fetchOverrides} size="sm">
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
          <Button
            size="sm"
            variant={showForm ? 'outline' : 'solid'}
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1"
          >
            <PiPlusBold size={14} />
            {showForm ? t('common.cancel') : t('permissions.fileOverrides.newOverride')}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label={t('permissions.fileOverrides.userIdLabel')}
              size="sm"
              value={formData.user_id}
              onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            />
            <Input
              label={t('permissions.fileOverrides.artifactIdLabel')}
              size="sm"
              value={formData.artifact_id}
              onChange={(e) => setFormData({ ...formData, artifact_id: e.target.value })}
            />
            <div>
              <Text className="mb-1 text-sm font-medium">{t('permissions.fileOverrides.permissionsLabel')}</Text>
              <div className="flex flex-wrap gap-2">
                {['read', 'write', 'delete'].map((p) => {
                  const checked = formData.permissions.includes(p);
                  return (
                    <label
                      key={p}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        checked
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? formData.permissions.filter((x) => x !== p)
                            : [...formData.permissions, p];
                          setFormData({ ...formData, permissions: next });
                        }}
                      />
                      {fileOverrideActionLabelI18n(p, t)}
                    </label>
                  );
                })}
              </div>
            </div>
            <Input
              label={t('permissions.fileOverrides.reasonLabel')}
              size="sm"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleCreate} isLoading={creating}>
              {t('permissions.fileOverrides.createOverride')}
            </Button>
          </div>
        </div>
      )}

      {overrides.length === 0 ? (
        <Empty
          text={t('common.noData')}
          textClassName="text-sm text-gray-500 mt-2"
        />
      ) : (
        <div className="overflow-auto rounded-lg border border-muted">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-200/70">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.fileOverrides.userIdHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.fileOverrides.artifactIdHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.fileOverrides.permissionsHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.fileOverrides.reasonHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('permissions.fileOverrides.expiresHeader')}</th>
                <th className="px-3 py-2 text-end font-medium">{t('permissions.fileOverrides.actionHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {overrides.map((o) => (
                <tr key={o.id}>
                  <td className="px-3 py-2 font-mono text-xs">{o.user_id}</td>
                  <td className="px-3 py-2 font-mono text-xs">{o.artifact_id}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {o.permissions?.map((p) => (
                        <Badge key={p} variant="flat" size="sm">
                          {fileOverrideActionLabelI18n(p, t)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {o.reason || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {o.expires_at
                      ? new Date(o.expires_at).toLocaleDateString()
                      : t('permissions.fileOverrides.neverExpires')}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <IconTooltip content={t('permissions.common.deleteTooltip')} preset="toolbar" placement="left">
                      <ActionIcon
                        size="sm"
                        variant="outline"
                        color="danger"
                        onClick={() => handleDelete(o.id)}
                      >
                        <PiTrashBold size={14} />
                      </ActionIcon>
                    </IconTooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Role Hierarchy Tab
   GET /rbac/roles/hierarchy — view & edit role priority levels
   PUT /rbac/roles/hierarchy — save changes
   ════════════════════════════════════════════════ */

/**
 * RoleHierarchyTab — Displays and allows editing of role hierarchy levels.
 *
 * Each role has a numeric priority (higher = more privileged).
 * Admin can adjust levels and save via PUT /rbac/roles/hierarchy.
 *
 * @endpoint GET /rbac/roles/hierarchy
 * @endpoint PUT /rbac/roles/hierarchy
 */
function RoleHierarchyTab() {
  const { t } = useTranslation();
  const { isSuperAdmin, roles: sessionRoles, isLoading: permissionsLoading } = usePermissions();
  const [hierarchy, setHierarchy] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [apiRoles, setApiRoles] = useState<string[] | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchHierarchy = useCallback(async () => {
    if (!isSuperAdmin) {
      setErrorStatus(403);
      setHierarchy({});
      setEditValues({});
      setLoading(false);
      setHasFetched(true);
      console.warn('[RoleHierarchyTab] Skipping fetch — super-admin required');
      return;
    }

    console.info('[RoleHierarchyTab] Fetching hierarchy...');
    setLoading(true);
    setErrorStatus(null);
    setApiRoles(null);
    try {
      const res = await adminService.getRoleHierarchy();
      console.info('[RoleHierarchyTab] Hierarchy loaded:', { count: Object.keys(res).length });
      const h = (res as { hierarchy?: Record<string, number> }).hierarchy ?? res;
      setHierarchy(h);
      setEditValues(h);
      setHasFetched(true);
    } catch (err: unknown) {
      const { status, apiRoles: rolesFromApi } = parseAxiosForbiddenDetail(err);
      setErrorStatus(status || 0);
      setApiRoles(rolesFromApi ?? null);
      setHierarchy({});
      setEditValues({});
      setHasFetched(true);
      console.error('[RoleHierarchyTab] Failed to load hierarchy:', { status, error: err });
      if (status === 404) {
        console.warn('[RoleHierarchyTab] Endpoint not found (404)');
      } else if (status === 403) {
        console.warn('[RoleHierarchyTab] Access denied (403)');
      } else {
        toast.error(t('permissions.hierarchy.loadError'));
      }
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, t]);

  useEffect(() => {
    if (permissionsLoading) return;
    fetchHierarchy();
  }, [fetchHierarchy, permissionsLoading]);

  const handleSave = async () => {
    console.info('[RoleHierarchyTab] Saving hierarchy:', { editValues });
    setSaving(true);
    try {
      await adminService.updateRoleHierarchy({ hierarchy: editValues });
      setHierarchy(editValues);
      setEditing(false);
      toast.success(t('permissions.hierarchy.saveSuccess'));
      console.info('[RoleHierarchyTab] Hierarchy saved');
    } catch (err: unknown) {
      const { status } = parseAxiosForbiddenDetail(err);
      console.error('[RoleHierarchyTab] Failed to save hierarchy:', { status, error: err });
      if (status === 403) {
        toast.error(t('permissions.hierarchy.accessDeniedMessage'));
      } else {
        toast.error(t('permissions.hierarchy.saveError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const showActions = errorStatus !== 403 && errorStatus !== 404;

  if (loading || permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  if (errorStatus === 403) {
    return (
      <div className="space-y-4">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiTreeStructureBold className="h-5 w-5 text-secondary" />
          {t('permissions.hierarchy.title')}
        </Title>
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <PiWarningBold className="h-6 w-6 shrink-0 text-red-500" />
            <div>
              <Title as="h5" className="font-semibold text-red-700 dark:text-red-400">
                {t('permissions.hierarchy.accessDeniedTitle')}
              </Title>
              <Text className="mt-1 text-sm text-red-600 dark:text-red-300">
                {t('permissions.hierarchy.accessDeniedMessage')}
              </Text>
              <div className="mt-3 rounded-md bg-red-100 p-3 dark:bg-red-900/30">
                <code className="text-xs text-red-700 dark:text-red-300">
                  {t('permissions.hierarchy.endpointLabel')}
                </code>
              </div>
              {sessionRoles.length > 0 && (
                <Text className="mt-3 text-xs text-red-600 dark:text-red-300">
                  {t('permissions.hierarchy.sessionRolesLabel', {
                    roles: sessionRoles.join(', '),
                  })}
                </Text>
              )}
              {apiRoles && apiRoles.length > 0 && (
                <Text className="mt-1 text-xs text-red-600 dark:text-red-300">
                  {t('permissions.hierarchy.tokenRolesLabel', {
                    roles: apiRoles.join(', '),
                  })}
                </Text>
              )}
              <Text className="mt-3 text-xs text-red-500">
                {t('permissions.hierarchy.accessDeniedHint')}
              </Text>
              <Text className="mt-1 text-xs text-red-500">
                {t('permissions.common.contactAdmin')}
              </Text>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchHierarchy}>
                <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
                {t('permissions.common.retry')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorStatus === 404) {
    return (
      <div className="space-y-4">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiTreeStructureBold className="h-5 w-5 text-secondary" />
          {t('permissions.hierarchy.title')}
        </Title>
        <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-6 dark:border-orange-800 dark:bg-orange-950/30">
          <div className="flex items-start gap-3">
            <PiWarningBold className="h-6 w-6 shrink-0 text-orange-500" />
            <div>
              <Title as="h5" className="font-semibold text-orange-700 dark:text-orange-400">
                {t('permissions.common.backendNotAvailable')}
              </Title>
              <Text className="mt-1 text-sm text-orange-600 dark:text-orange-300">
                {t('permissions.common.backendNotAvailableHint')}
              </Text>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchHierarchy}>
                <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
                {t('permissions.common.retry')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sortedRoles = Object.entries(editing ? editValues : hierarchy).sort(
    ([, a], [, b]) => b - a
  );

  if (hasFetched && sortedRoles.length === 0 && !errorStatus) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Title as="h5" className="flex items-center gap-2 font-semibold">
            <PiTreeStructureBold className="h-5 w-5 text-secondary" />
            {t('permissions.hierarchy.title')}
          </Title>
          <IconTooltip content={t('common.refresh')} preset="toolbar">
            <ActionIcon variant="outline" onClick={fetchHierarchy} size="sm">
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
        </div>
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
          <Empty
            text={t('permissions.hierarchy.emptyState')}
            textClassName="text-sm text-gray-500 mt-2"
          />
          <Button variant="outline" size="sm" onClick={fetchHierarchy}>
            <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
            {t('permissions.common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (errorStatus && errorStatus !== 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
        <Empty
          text={t('permissions.hierarchy.loadError')}
          textClassName="text-sm text-gray-500 mt-2"
        />
        <Button variant="outline" size="sm" onClick={fetchHierarchy}>
          <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
          {t('permissions.common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiTreeStructureBold className="h-5 w-5 text-secondary" />
          {t('permissions.hierarchy.title')}
        </Title>
        <div className="flex gap-2">
          <IconTooltip content={t('common.refresh')} preset="toolbar">
            <ActionIcon variant="outline" onClick={fetchHierarchy} size="sm">
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
          {showActions && (editing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditValues(hierarchy);
                  setEditing(false);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                isLoading={saving}
                className="flex items-center gap-1"
              >
                <PiFloppyDiskBold size={14} />
                {t('common.save')}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1"
            >
              <PiPencilSimpleBold size={14} />
              {t('common.edit')}
            </Button>
          ))}
        </div>
      </div>

      <Text className="text-xs text-gray-500">
        {t('permissions.hierarchy.description')}
      </Text>

      <div className="overflow-auto rounded-lg border border-muted">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-200/70">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">{t('permissions.hierarchy.roleHeader')}</th>
              <th className="px-4 py-2.5 text-center font-medium">{t('permissions.hierarchy.priorityHeader')}</th>
              <th className="px-4 py-2.5 text-end font-medium">{t('permissions.hierarchy.visualHeader')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {sortedRoles.map(([role, level]) => (
              <tr key={role} className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30">
                <td className="px-4 py-2.5 font-medium">{roleDisplayName(t, role)}</td>
                <td className="px-4 py-2.5 text-center">
                  {editing ? (
                    <Input
                      type="number"
                      size="sm"
                      className="mx-auto w-24"
                      value={editValues[role] ?? 0}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [role]: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                    />
                  ) : (
                    <Badge variant="flat" color="primary" size="sm">
                      {level}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2.5 text-end">
                  <div className="ms-auto h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-gray-200 dark:bg-gray-300">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min((level / 100) * 100, 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Section Permissions Tab
   GET /rbac/sections/permissions — which roles can access which sections
   PUT /rbac/sections/permissions — update section permissions
   ════════════════════════════════════════════════ */

/**
 * SectionPermissionsTab — Displays and edits section-level access per role.
 *
 * Shows a table where each row is a role and columns are accessible sections.
 * Toggle checkmarks to add/remove section access per role, then save.
 *
 * @endpoint GET /rbac/sections/permissions
 * @endpoint PUT /rbac/sections/permissions
 */
function SectionPermissionsTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<Record<string, string[]>>({});
  const [editData, setEditData] = useState<Record<string, string[]>>({});
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    console.info('[SectionPermissionsTab] Fetching section permissions...');
    setLoading(true);
    try {
      const res = await adminService.getSectionPermissions();
      const perms = res.permissions ?? {};
      console.info('[SectionPermissionsTab] Loaded:', {
        roles: Object.keys(perms).length,
        sections: res.available_sections?.length ?? 0,
      });
      setData(perms);
      setEditData(JSON.parse(JSON.stringify(perms)) as Record<string, string[]>);
      setAvailableSections(
        Array.from(
          new Set(
            res.available_sections?.length
              ? res.available_sections
              : Object.values(perms).flat()
          )
        ).sort()
      );
    } catch (err: unknown) {
      console.error('[SectionPermissionsTab] Failed:', err);
      toast.error(t('errors.loadData'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Toggle a section for a role in edit mode */
  const toggleSection = (role: string, section: string) => {
    setEditData((prev) => {
      const current = prev[role] || [];
      const has = current.includes(section);
      return {
        ...prev,
        [role]: has ? current.filter((s) => s !== section) : [...current, section],
      };
    });
  };

  /** Save section permission changes */
  const handleSave = async () => {
    console.info('[SectionPermissionsTab] Saving section permissions...');
    setSaving(true);
    try {
      await adminService.updateSectionPermissions({ permissions: editData });
      setData(JSON.parse(JSON.stringify(editData)) as Record<string, string[]>);
      setEditing(false);
      toast.success(t('permissions.sections.saveSuccess'));
      console.info('[SectionPermissionsTab] Save successful');
    } catch (err: unknown) {
      console.error('[SectionPermissionsTab] Save failed:', err);
      toast.error(t('permissions.sections.saveError'));
    } finally {
      setSaving(false);
    }
  };

  /** Cancel editing, revert changes */
  const handleCancel = () => {
    setEditData(JSON.parse(JSON.stringify(data)) as Record<string, string[]>);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  // All catalog sections (not only already-assigned) for matrix columns
  const allSections = (
    availableSections.length
      ? availableSections
      : Array.from(new Set(Object.values(editing ? editData : data).flat()))
  ).sort();

  const displayData = editing ? editData : data;
  const roles = Object.keys(displayData).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiSquaresFourBold className="h-5 w-5 text-blue-500" />
          {t('permissions.sections.title')}
        </Title>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} isLoading={saving}>
                <PiFloppyDiskBold className="me-1.5 h-4 w-4" />
                {t('permissions.sections.saveChanges')}
              </Button>
            </>
          ) : (
            <>
              <IconTooltip content={t('permissions.common.editTooltip')} preset="toolbar">
                <ActionIcon variant="outline" onClick={() => setEditing(true)} size="sm">
                  <PiPencilSimpleBold className="h-4 w-4" />
                </ActionIcon>
              </IconTooltip>
              <IconTooltip content={t('permissions.common.refreshTooltip')} preset="toolbar">
                <ActionIcon variant="outline" onClick={fetchData} size="sm">
                  <PiArrowsClockwiseBold className="h-4 w-4" />
                </ActionIcon>
              </IconTooltip>
            </>
          )}
        </div>
      </div>

      <Text className="text-xs text-gray-500">
        {t('permissions.sections.description')}
        {editing && (
          <span className="ms-1 font-medium text-orange-500">
            {t('permissions.sections.descriptionEditing')}
          </span>
        )}
      </Text>

      <div className="overflow-auto rounded-lg border border-muted">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-200/70">
            <tr>
              <th className="sticky start-0 z-10 bg-gray-100 px-4 py-2.5 text-start font-medium dark:bg-gray-200/70">
                {t('permissions.hierarchy.roleHeader')}
              </th>
              {allSections.map((sec) => (
                <th key={sec} className="px-3 py-2.5 text-center font-medium">
                  {rbacSectionLabelI18n(sec, t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {roles.map((role) => (
              <tr key={role} className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30">
                <td className="sticky start-0 z-10 bg-white px-4 py-2.5 font-medium dark:bg-gray-50">
                  {roleDisplayName(t, role)}
                </td>
                {allSections.map((sec) => {
                  const hasAccess = displayData[role]?.includes(sec);
                  return (
                    <td
                      key={sec}
                      className={cn('px-3 py-2.5 text-center', editing && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-200/50')}
                      onClick={editing ? () => toggleSection(role, sec) : undefined}
                      title={sec}
                    >
                      {hasAccess ? (
                        <PiCheckBold className="mx-auto h-4 w-4 text-green-500" />
                      ) : (
                        <PiXBold className="mx-auto h-3.5 w-3.5 text-gray-300" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Route Permissions Tab
   GET /rbac/routes/permissions — which routes require which permissions
   PUT /rbac/routes/permissions — update route permissions
   ════════════════════════════════════════════════ */

/**
 * RoutePermissionsTab — Displays and edits route-level permission requirements.
 *
 * Shows which backend API routes require which permissions.
 * In edit mode, allows adding/removing permission requirements per route.
 *
 * @endpoint GET /rbac/routes/permissions
 * @endpoint PUT /rbac/routes/permissions
 */
function RoutePermissionsTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<Record<string, string[]>>({});
  const [editData, setEditData] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPermInput, setNewPermInput] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    console.info('[RoutePermissionsTab] Fetching route permissions...');
    setLoading(true);
    try {
      const res = await adminService.getRoutePermissions();
      console.info('[RoutePermissionsTab] Loaded:', { count: Object.keys(res).length });
      // Unwrap if response has .route_permissions wrapper
      const routes = (res as Record<string, unknown>)?.route_permissions ?? res;
      setData(routes as Record<string, string[]>);
      setEditData(JSON.parse(JSON.stringify(routes)) as Record<string, string[]>);
    } catch (err: unknown) {
      console.error('[RoutePermissionsTab] Failed:', err);
      toast.error(t('errors.loadData'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Remove a permission from a route */
  const removePermission = (route: string, perm: string) => {
    setEditData((prev) => ({
      ...prev,
      [route]: (prev[route] || []).filter((p) => p !== perm),
    }));
  };

  /** Add a permission to a route */
  const addPermission = (route: string) => {
    const perm = newPermInput[route]?.trim();
    if (!perm) return;
    setEditData((prev) => ({
      ...prev,
      [route]: Array.from(new Set([...(prev[route] || []), perm])),
    }));
    setNewPermInput((prev) => ({ ...prev, [route]: '' }));
  };

  /** Save route permission changes */
  const handleSave = async () => {
    console.info('[RoutePermissionsTab] Saving route permissions...');
    setSaving(true);
    try {
      await adminService.updateRoutePermissions({ route_permissions: editData } as never);
      setData(JSON.parse(JSON.stringify(editData)) as Record<string, string[]>);
      setEditing(false);
      toast.success(t('permissions.routes.saveSuccess'));
      console.info('[RoutePermissionsTab] Save successful');
    } catch (err: unknown) {
      console.error('[RoutePermissionsTab] Save failed:', err);
      toast.error(t('permissions.routes.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData(JSON.parse(JSON.stringify(data)) as Record<string, string[]>);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  const displayData = editing ? editData : data;
  const filteredRoutes = Object.entries(displayData)
    .filter(
      ([route, perms]) =>
        !filter ||
        route.toLowerCase().includes(filter.toLowerCase()) ||
        perms.some((p) => p.toLowerCase().includes(filter.toLowerCase()))
    )
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiPathBold className="h-5 w-5 text-orange-500" />
          {t('permissions.routes.title')}
        </Title>
        <div className="flex items-center gap-2">
          <Input
            prefix={<PiFunnelBold className="h-4 w-4" />}
            placeholder={t('permissions.routes.filterPlaceholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            size="sm"
            className="w-64"
          />
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} isLoading={saving}>
                <PiFloppyDiskBold className="me-1.5 h-4 w-4" />
                {t('common.save')}
              </Button>
            </>
          ) : (
            <>
              <IconTooltip content={t('permissions.common.editTooltip')} preset="toolbar">
                <ActionIcon variant="outline" onClick={() => setEditing(true)} size="sm">
                  <PiPencilSimpleBold className="h-4 w-4" />
                </ActionIcon>
              </IconTooltip>
              <IconTooltip content={t('permissions.common.refreshTooltip')} preset="toolbar">
                <ActionIcon variant="outline" onClick={fetchData} size="sm">
                  <PiArrowsClockwiseBold className="h-4 w-4" />
                </ActionIcon>
              </IconTooltip>
            </>
          )}
        </div>
      </div>

      <Text className="text-xs text-gray-500">
        {t('permissions.routes.routesCount', { count: filteredRoutes.length })}
      </Text>

      <div className="overflow-auto rounded-lg border border-muted">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-200/70">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">{t('permissions.routes.methodRouteHeader')}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t('permissions.routes.requiredPermissions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {filteredRoutes.map(([route, perms]) => {
              // Parse "METHOD:/path" format
              const colonIdx = route.indexOf(':');
              const method = colonIdx > 0 ? route.substring(0, colonIdx) : '';
              const path = colonIdx > 0 ? route.substring(colonIdx + 1) : route;
              const methodColor: Record<string, string> = {
                GET: 'success',
                POST: 'primary',
                PUT: 'warning',
                PATCH: 'warning',
                DELETE: 'danger',
              };
              return (
                <tr
                  key={route}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {method && (
                        <Badge
                          variant="flat"
                          color={(methodColor[method] as any) || 'secondary'}
                          size="sm"
                          className="min-w-[52px] justify-center font-mono text-[10px]"
                        >
                          {method}
                        </Badge>
                      )}
                      <code className="text-xs">{path}</code>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {perms.map((p) => (
                        <Badge
                          key={p}
                          variant="outline"
                          size="sm"
                          className={cn(
                            'border-muted text-xs font-normal text-gray-600',
                            editing && 'cursor-pointer hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20'
                          )}
                          onClick={editing ? () => removePermission(route, p) : undefined}
                        >
                          {matrixPermissionLabelI18n(p, null, t)}
                          {editing && <PiXBold className="ms-1 h-2.5 w-2.5" />}
                        </Badge>
                      ))}
                      {editing && (
                        <div className="flex items-center gap-1">
                          <Input
                            size="sm"
                            placeholder={t('permissions.routes.addPlaceholder')}
                            className="w-28"
                            value={newPermInput[route] || ''}
                            onChange={(e) => setNewPermInput((prev) => ({ ...prev, [route]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && addPermission(route)}
                          />
                          <IconTooltip content={t('permissions.common.addTooltip')} preset="toolbar">
                            <ActionIcon size="sm" variant="outline" onClick={() => addPermission(route)}>
                              <PiPlusBold className="h-3 w-3" />
                            </ActionIcon>
                          </IconTooltip>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Rate Limits Tab
   GET /rbac/rate-limits — rate limits per role
   PUT /rbac/rate-limits — update rate limits
   ════════════════════════════════════════════════ */

/**
 * RateLimitsTab — Displays and allows editing rate limits per role.
 *
 * Shows requests_per_minute, requests_per_hour, burst_limit per role.
 * In edit mode, allows inline editing of values.
 *
 * @endpoint GET /rbac/rate-limits
 * @endpoint PUT /rbac/rate-limits
 */
function RateLimitsTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<Record<string, any>>({});
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    console.info('[RateLimitsTab] Fetching rate limits...');
    setLoading(true);
    try {
      const res = await adminService.getRateLimits();
      console.info('[RateLimitsTab] Loaded:', { roles: Object.keys(res).length });
      // Unwrap if response has .rate_limits wrapper
      const limits = (res as any)?.rate_limits ?? res;
      setData(limits);
    } catch (err: unknown) {
      console.error('[RateLimitsTab] Failed:', err);
      toast.error(t('errors.loadData'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  /**
   * handleEdit — Enter edit mode with deep clone of current data.
   */
  const handleEdit = () => {
    setEditData(JSON.parse(JSON.stringify(data)) as Record<string, unknown>);
    setEditing(true);
  };

  /**
   * handleCancel — Discard changes and exit edit mode.
   */
  const handleCancel = () => {
    setEditing(false);
    setEditData({});
  };

  /**
   * handleSave — Persist edited rate limits to backend.
   * @endpoint PUT /rbac/rate-limits
   */
  const handleSave = async () => {
    console.info('[RateLimitsTab] Saving rate limits:', { roles: Object.keys(editData) });
    setSaving(true);
    try {
      await adminService.updateRateLimits(editData);
      console.info('[RateLimitsTab] Rate limits saved successfully');
      toast.success(t('permissions.rateLimits.saveSuccess'));
      setData(JSON.parse(JSON.stringify(editData)) as Record<string, unknown>);
      setEditing(false);
    } catch (err: unknown) {
      console.error('[RateLimitsTab] Save failed:', err);
      toast.error(t('permissions.rateLimits.saveError'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * updateField — Update a single rate limit field for a role in edit state.
   */
  const updateField = (role: string, field: string, value: string) => {
    const numericValue = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(numericValue)) return;
    setEditData((prev: Record<string, any>) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [field]: numericValue,
      },
    }));
  };

  const displayData = editing ? editData : data;
  const roles = Object.keys(displayData).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiGaugeBold className="h-5 w-5 text-red-500" />
          {t('permissions.rateLimits.title')}
        </Title>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={saving}
                className="gap-1"
              >
                <PiXBold className="h-3.5 w-3.5" />
                {t('common.cancel')}
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={handleSave}
                isLoading={saving}
                className="gap-1"
              >
                <PiFloppyDiskBold className="h-3.5 w-3.5" />
                {t('common.save')}
              </Button>
            </>
          ) : (
            <IconTooltip content={t('permissions.rateLimits.editTooltip')} preset="toolbar">
              <ActionIcon variant="outline" onClick={handleEdit} size="sm">
                <PiPencilSimpleBold className="h-4 w-4" />
              </ActionIcon>
            </IconTooltip>
          )}
          <IconTooltip content={t('permissions.common.refreshTooltip')} preset="toolbar">
            <ActionIcon variant="outline" onClick={fetchData} size="sm" disabled={editing}>
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
        </div>
      </div>

      <Text className="text-xs text-gray-500">
        {t('permissions.rateLimits.description')}
        {editing && (
          <span className="ms-1 font-medium text-orange-500">
            {t('permissions.rateLimits.editingMode')}
          </span>
        )}
      </Text>

      <div className="overflow-auto rounded-lg border border-muted">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-200/70">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">{t('permissions.rateLimits.roleHeader')}</th>
              <th className="px-4 py-2.5 text-center font-medium">{t('permissions.rateLimits.requestsPerMin')}</th>
              <th className="px-4 py-2.5 text-center font-medium">{t('permissions.rateLimits.requestsPerHour')}</th>
              <th className="px-4 py-2.5 text-center font-medium">{t('permissions.rateLimits.burstLimit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {roles.map((role) => {
              const limits = displayData[role] || {};
              return (
                <tr key={role} className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30">
                  <td className="px-4 py-2.5 font-medium">{roleDisplayName(t, role)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {editing ? (
                      <Input
                        type="number"
                        size="sm"
                        min={0}
                        value={limits.requests_per_minute ?? 0}
                        onChange={(e) => updateField(role, 'requests_per_minute', e.target.value)}
                        className="mx-auto w-24"
                        inputClassName="text-center"
                      />
                    ) : (
                      <Badge variant="flat" color="primary" size="sm">{limits.requests_per_minute ?? '—'}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {editing ? (
                      <Input
                        type="number"
                        size="sm"
                        min={0}
                        value={limits.requests_per_hour ?? 0}
                        onChange={(e) => updateField(role, 'requests_per_hour', e.target.value)}
                        className="mx-auto w-24"
                        inputClassName="text-center"
                      />
                    ) : (
                      <Badge variant="flat" color="secondary" size="sm">{limits.requests_per_hour ?? '—'}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {editing ? (
                      <Input
                        type="number"
                        size="sm"
                        min={0}
                        value={limits.burst_limit ?? 0}
                        onChange={(e) => updateField(role, 'burst_limit', e.target.value)}
                        className="mx-auto w-24"
                        inputClassName="text-center"
                      />
                    ) : (
                      <Badge variant="flat" color="warning" size="sm">{limits.burst_limit ?? '—'}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Custom Roles Tab
   GET /rbac/custom-roles — list custom roles
   POST /rbac/custom-roles — create custom role
   DELETE /rbac/custom-roles/:name — delete custom role
   ════════════════════════════════════════════════ */

/**
 * CustomRolesTab — CRUD management for custom roles.
 *
 * Lists existing custom roles and provides create/delete functionality.
 * Each custom role has a name, level, optional sections, permissions, and rate limits.
 *
 * @endpoint GET /rbac/custom-roles
 * @endpoint POST /rbac/custom-roles
 * @endpoint DELETE /rbac/custom-roles/:name
 */
function CustomRolesTab() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cloning, setCloning] = useState<string | null>(null);
  const [showClone, setShowClone] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create form state
  const [newRole, setNewRole] = useState<CreateCustomRoleRequest>({
    name: '',
    level: 10,
    sections: [],
    permissions: [],
    rate_limits: {
      requests_per_minute: 60,
      requests_per_hour: 1000,
      burst_limit: 10,
    },
  });
  const [newSection, setNewSection] = useState('');
  const [newPerm, setNewPerm] = useState('');

  /**
   * fetchRoles — Load custom roles from backend.
   */
  const fetchRoles = useCallback(async () => {
    console.info('[CustomRolesTab] Fetching custom roles...');
    setLoading(true);
    try {
      const data = await adminService.getCustomRoles();
      console.info('[CustomRolesTab] Custom roles loaded:', { count: data.length });
      setRoles(data);
    } catch (err: unknown) {
      console.error('[CustomRolesTab] Failed to load custom roles:', err);
      toast.error(t('errors.loadData'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  /**
   * handleCreate — Create a new custom role.
   */
  const handleCreate = async () => {
    if (!newRole.name.trim() || newRole.name.length < 2) {
      toast.error(t('permissions.customRoles.nameMinLength'));
      return;
    }
    console.info('[CustomRolesTab] Creating custom role:', { name: newRole.name, level: newRole.level });
    setCreating(true);
    try {
      await adminService.createCustomRole(newRole);
      console.info('[CustomRolesTab] Custom role created:', { name: newRole.name });
      toast.success(t('permissions.customRoles.createSuccess'));
      // Reset form
      setNewRole({
        name: '',
        level: 10,
        sections: [],
        permissions: [],
        rate_limits: { requests_per_minute: 60, requests_per_hour: 1000, burst_limit: 10 },
      });
      setShowCreate(false);
      fetchRoles();
    } catch (err: unknown) {
      console.error('[CustomRolesTab] Failed to create custom role:', err);
      toast.error(t('permissions.customRoles.createError'));
    } finally {
      setCreating(false);
    }
  };

  /**
   * handleClone — Clone an existing role into a new custom role.
   */
  const handleClone = async (sourceRole: string) => {
    const trimmed = cloneName.trim();
    if (trimmed.length < 2) {
      toast.error(t('permissions.customRoles.nameMinLength'));
      return;
    }
    console.info('[CustomRolesTab] Cloning role:', { sourceRole, name: trimmed });
    setCloning(sourceRole);
    try {
      const payload: CloneCustomRoleRequest = {
        source_role: sourceRole,
        name: trimmed,
      };
      await adminService.cloneCustomRole(payload);
      toast.success(t('permissions.customRoles.cloneSuccess'));
      setShowClone(null);
      setCloneName('');
      fetchRoles();
    } catch (err: unknown) {
      console.error('[CustomRolesTab] Failed to clone role:', err);
      toast.error(t('permissions.customRoles.cloneError'));
    } finally {
      setCloning(null);
    }
  };

  /**
   * handleDelete — Delete a custom role by name.
   */
  const handleDelete = async (roleName: string) => {
    if (!confirm(t('permissions.customRoles.deleteConfirm', { roleName }))) return;
    console.info('[CustomRolesTab] Deleting custom role:', { roleName });
    setDeleting(roleName);
    try {
      await adminService.deleteCustomRole(roleName);
      console.info('[CustomRolesTab] Custom role deleted:', { roleName });
      toast.success(t('permissions.customRoles.deleteSuccess'));
      fetchRoles();
    } catch (err: unknown) {
      console.error('[CustomRolesTab] Failed to delete custom role:', err);
      toast.error(t('permissions.customRoles.deleteError'));
    } finally {
      setDeleting(null);
    }
  };

  /**
   * addSection — Add a section string to the new role form.
   */
  const addSection = () => {
    if (!newSection.trim()) return;
    setNewRole((prev) => ({
      ...prev,
      sections: [...(prev.sections || []), newSection.trim()],
    }));
    setNewSection('');
  };

  /**
   * addPermission — Add a permission string to the new role form.
   */
  const addPermission = () => {
    if (!newPerm.trim()) return;
    setNewRole((prev) => ({
      ...prev,
      permissions: [...(prev.permissions || []), newPerm.trim()],
    }));
    setNewPerm('');
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiCrownBold className="h-5 w-5 text-amber-500" />
          {t('permissions.customRoles.title')}
        </Title>
        <div className="flex items-center gap-2">
          <Button
            variant={showCreate ? 'outline' : 'solid'}
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
            className="gap-1"
          >
            {showCreate ? (
              <>
                <PiXBold className="h-3.5 w-3.5" />
                {t('common.cancel')}
              </>
            ) : (
              <>
                <PiPlusBold className="h-3.5 w-3.5" />
                {t('permissions.customRoles.newRole')}
              </>
            )}
          </Button>
          <IconTooltip content={t('permissions.common.refreshTooltip')} preset="toolbar">
            <ActionIcon variant="outline" onClick={fetchRoles} size="sm">
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-primary/30 bg-gray-50 p-4 dark:bg-gray-100">
          <Text className="mb-3 text-sm font-semibold">{t('permissions.customRoles.createTitle')}</Text>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              size="sm"
              label={t('permissions.customRoles.roleNameRequired')}
              placeholder={t('permissions.customRoles.namePlaceholder')}
              value={newRole.name}
              onChange={(e) => setNewRole((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              size="sm"
              type="number"
              label={t('permissions.customRoles.levelLabel')}
              min={1}
              max={99}
              value={newRole.level}
              onChange={(e) => setNewRole((prev) => ({ ...prev, level: parseInt(e.target.value, 10) || 1 }))}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                size="sm"
                type="number"
                label={t('permissions.customRoles.reqPerMin')}
                min={0}
                value={newRole.rate_limits?.requests_per_minute ?? 60}
                onChange={(e) => setNewRole((prev) => ({
                  ...prev,
                  rate_limits: { ...prev.rate_limits, requests_per_minute: parseInt(e.target.value, 10) || 0 },
                }))}
              />
              <Input
                size="sm"
                type="number"
                label={t('permissions.customRoles.reqPerHour')}
                min={0}
                value={newRole.rate_limits?.requests_per_hour ?? 1000}
                onChange={(e) => setNewRole((prev) => ({
                  ...prev,
                  rate_limits: { ...prev.rate_limits, requests_per_hour: parseInt(e.target.value, 10) || 0 },
                }))}
              />
              <Input
                size="sm"
                type="number"
                label={t('permissions.customRoles.burst')}
                min={0}
                value={newRole.rate_limits?.burst_limit ?? 10}
                onChange={(e) => setNewRole((prev) => ({
                  ...prev,
                  rate_limits: { ...prev.rate_limits, burst_limit: parseInt(e.target.value, 10) || 0 },
                }))}
              />
            </div>
          </div>

          {/* Sections */}
          <div className="mt-3">
            <Text className="mb-1 text-xs font-medium text-gray-600">{t('permissions.customRoles.sectionsLabel')}</Text>
            <div className="mb-2 flex flex-wrap gap-1">
              {(newRole.sections || []).map((s, i) => (
                <Badge
                  key={i}
                  variant="flat"
                  color="info"
                  size="sm"
                  className="cursor-pointer gap-1"
                  onClick={() => setNewRole((prev) => ({
                    ...prev,
                    sections: prev.sections?.filter((_, idx) => idx !== i),
                  }))}
                >
                  {s}
                  <PiXBold className="h-3 w-3" />
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Input
                size="sm"
                placeholder={t('permissions.customRoles.addSectionPlaceholder')}
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSection())}
                className="max-w-[200px]"
              />
              <IconTooltip content={t('permissions.common.addTooltip')} preset="toolbar">
                <ActionIcon variant="outline" size="sm" onClick={addSection}>
                  <PiPlusBold className="h-3.5 w-3.5" />
                </ActionIcon>
              </IconTooltip>
            </div>
          </div>

          {/* Permissions */}
          <div className="mt-3">
            <Text className="mb-1 text-xs font-medium text-gray-600">{t('permissions.customRoles.permissionsLabel')}</Text>
            <div className="mb-2 flex flex-wrap gap-1">
              {(newRole.permissions || []).map((p, i) => (
                <Badge
                  key={i}
                  variant="flat"
                  color="secondary"
                  size="sm"
                  className="cursor-pointer gap-1"
                  onClick={() => setNewRole((prev) => ({
                    ...prev,
                    permissions: prev.permissions?.filter((_, idx) => idx !== i),
                  }))}
                >
                  {p}
                  <PiXBold className="h-3 w-3" />
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Input
                size="sm"
                placeholder={t('permissions.customRoles.addPermissionPlaceholder')}
                value={newPerm}
                onChange={(e) => setNewPerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPermission())}
                className="max-w-[200px]"
              />
              <IconTooltip content={t('permissions.common.addTooltip')} preset="toolbar">
                <ActionIcon variant="outline" size="sm" onClick={addPermission}>
                  <PiPlusBold className="h-3.5 w-3.5" />
                </ActionIcon>
              </IconTooltip>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              variant="solid"
              size="sm"
              onClick={handleCreate}
              isLoading={creating}
              disabled={!newRole.name.trim() || newRole.name.length < 2}
              className="gap-1"
            >
              <PiCheckBold className="h-3.5 w-3.5" />
              {t('permissions.customRoles.createRole')}
            </Button>
          </div>
        </div>
      )}

      {/* Roles list */}
      {roles.length === 0 && !showCreate ? (
        <Empty text={t('common.noData')} textClassName="text-sm text-gray-500 mt-2" />
      ) : (
        <div className="overflow-auto rounded-lg border border-muted">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-200/70">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">{t('permissions.customRoles.nameHeader')}</th>
                <th className="px-4 py-2.5 text-center font-medium">{t('permissions.customRoles.levelHeader')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('permissions.customRoles.sectionsHeader')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('permissions.customRoles.permissionsHeader')}</th>
                <th className="px-4 py-2.5 text-center font-medium">{t('permissions.customRoles.rateLimitsHeader')}</th>
                <th className="px-4 py-2.5 text-center font-medium">{t('permissions.customRoles.actionsHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {roles.map((role, idx) => {
                const name = role.name || role.role_name || `role-${idx}`;
                const level = role.level ?? '—';
                const sections: string[] = role.sections || [];
                const perms: string[] = role.permissions || [];
                const rl = role.rate_limits || {};
                return (
                  <tr key={name} className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30">
                    <td className="px-4 py-2.5 font-medium capitalize">{name}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant="flat" color="primary" size="sm">{level}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {sections.length > 0
                          ? sections.map((s) => (
                              <Badge key={s} variant="flat" color="info" size="sm">{s}</Badge>
                            ))
                          : <span className="text-xs text-gray-400">{t('permissions.customRoles.none')}</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {perms.length > 0
                          ? perms.slice(0, 3).map((p) => (
                              <Badge key={p} variant="flat" color="secondary" size="sm">{p}</Badge>
                            ))
                          : <span className="text-xs text-gray-400">{t('permissions.customRoles.none')}</span>
                        }
                        {perms.length > 3 && (
                          <Badge variant="flat" color="secondary" size="sm">+{perms.length - 3}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                        <span>{rl.requests_per_minute ?? '—'}/m</span>
                        <span>·</span>
                        <span>{rl.requests_per_hour ?? '—'}/h</span>
                        <span>·</span>
                        <span>{rl.burst_limit ?? '—'}b</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {showClone === name ? (
                          <div className="flex items-center gap-1">
                            <Input
                              size="sm"
                              placeholder={t('permissions.customRoles.namePlaceholder')}
                              value={cloneName}
                              onChange={(e) => setCloneName(e.target.value)}
                              className="w-32"
                            />
                            <Button
                              size="sm"
                              variant="solid"
                              isLoading={cloning === name}
                              onClick={() => handleClone(name)}
                            >
                              {t('permissions.customRoles.cloneConfirm')}
                            </Button>
                            <ActionIcon
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowClone(null);
                                setCloneName('');
                              }}
                            >
                              <PiXBold className="h-3.5 w-3.5" />
                            </ActionIcon>
                          </div>
                        ) : (
                          <>
                            <IconTooltip content={t('permissions.customRoles.cloneRoleTooltip')} preset="toolbar">
                              <ActionIcon
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowClone(name);
                                  setCloneName(`${name}-copy`);
                                }}
                              >
                                <PiCopyBold className="h-3.5 w-3.5" />
                              </ActionIcon>
                            </IconTooltip>
                            <IconTooltip content={t('permissions.customRoles.deleteRoleTooltip')} preset="toolbar">
                              <ActionIcon
                                variant="outline"
                                color="danger"
                                size="sm"
                                onClick={() => handleDelete(name)}
                                disabled={deleting === name}
                              >
                                {deleting === name ? (
                                  <Loader variant="spinner" size="sm" />
                                ) : (
                                  <PiTrashBold className="h-3.5 w-3.5" />
                                )}
                              </ActionIcon>
                            </IconTooltip>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Audit Log Tab
   GET /events/admin — admin operations (CREATE, UPDATE, DELETE)
   GET /events/user — user events (LOGIN, LOGOUT, etc.)
   GET /events/types — available event types
   ════════════════════════════════════════════════ */

/**
 * AuditLogTab — Shows admin and user event audit logs from Keycloak.
 *
 * Two sub-views: Admin Events and User Events, each with filtering.
 * Supports event type, date range, and user ID filters.
 *
 * @endpoint GET /events/admin
 * @endpoint GET /events/user
 * @endpoint GET /events/types
 */
function AuditLogTab() {
  const { t } = useTranslation();
  const [view, setView] = useState<'admin' | 'user'>('admin');
  const [adminEvents, setAdminEvents] = useState<any[]>([]);
  const [userEvents, setUserEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxResults, setMaxResults] = useState(25);
  /** HTTP error status for Access Denied / Not Found banners */
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // ---- Filters ----
  const [showFilters, setShowFilters] = useState(false);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Fetch available event types on mount
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await adminService.getEventTypes();
        console.info('[AuditLogTab] Event types loaded:', { count: types.length });
        setEventTypes(Array.isArray(types) ? types : []);
      } catch {
        // Non-critical — filters work without types
        console.warn('[AuditLogTab] Could not load event types');
      }
    };
    loadTypes();
  }, []);

  const fetchEvents = useCallback(async () => {
    console.info('[AuditLogTab] Fetching events:', { view, max: maxResults, filterType, filterUser, filterDateFrom, filterDateTo });
    setLoading(true);
    setErrorStatus(null);
    try {
      if (view === 'admin') {
        const params: Record<string, any> = { first: 0, max: maxResults };
        if (filterType) params.operation = [filterType];
        if (filterUser) params.authUser = filterUser;
        if (filterDateFrom) params.dateFrom = filterDateFrom;
        if (filterDateTo) params.dateTo = filterDateTo;
        const res = await adminService.getAdminEvents(params);
        const events = (res as any)?.events ?? (Array.isArray(res) ? res : []);
        console.info('[AuditLogTab] Admin events loaded:', { count: events.length });
        setAdminEvents(events);
      } else {
        const params: Record<string, any> = { first: 0, max: maxResults };
        if (filterType) params.type = [filterType];
        if (filterUser) params.user = filterUser;
        if (filterDateFrom) params.dateFrom = filterDateFrom;
        if (filterDateTo) params.dateTo = filterDateTo;
        const res = await adminService.getUserEvents(params);
        const events = (res as any)?.events ?? (Array.isArray(res) ? res : []);
        console.info('[AuditLogTab] User events loaded:', { count: events.length });
        setUserEvents(events);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      console.error('[AuditLogTab] Failed to load events:', { status, error: err });
      if (status === 403) {
        // Don't toast for 403 — we render an Access Denied banner in the UI
        setErrorStatus(403);
      } else if (status === 404) {
        setErrorStatus(404);
      } else {
        setErrorStatus(status || 0);
        toast.error(t('permissions.auditLog.loadError'));
      }
    } finally {
      setLoading(false);
    }
  }, [view, maxResults, filterType, filterUser, filterDateFrom, filterDateTo, t]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /**
   * clearFilters — Reset all filter fields.
   */
  const clearFilters = () => {
    setFilterType('');
    setFilterUser('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const renderAdminEvents = () => {
    if (adminEvents.length === 0) {
      return <Empty text={t('common.noData')} textClassName="text-sm text-gray-500 mt-2" />;
    }
    return (
      <div className="overflow-auto rounded-lg border border-muted">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-200/70">
            <tr>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.timeHeader')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.operationHeader')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.resourceTypeHeader')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.resourcePathHeader')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.authorHeader')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {adminEvents.map((ev, idx) => {
              const time = ev.time ? new Date(ev.time).toLocaleString() : '—';
              const op = ev.operationType || '—';
              const resType = ev.resourceType || '—';
              const resPath = ev.resourcePath || '—';
              const auth =
                ev.authDetails?.userId?.substring?.(0, 8) ||
                ev.authDetails?.realmId?.substring?.(0, 8) ||
                '—';
              return (
                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{time}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="flat"
                      color={
                        op === 'CREATE'
                          ? 'success'
                          : op === 'DELETE'
                            ? 'danger'
                            : op === 'UPDATE'
                              ? 'warning'
                              : 'secondary'
                      }
                      size="sm"
                    >
                      {op}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{resType}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-gray-500" title={resPath}>
                    {resPath}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{auth}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderUserEvents = () => {
    if (userEvents.length === 0) {
      return <Empty text={t('common.noData')} textClassName="text-sm text-gray-500 mt-2" />;
    }
    return (
      <div className="overflow-auto rounded-lg border border-muted">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-200/70">
            <tr>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.timeHeader')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.eventTypeHeader')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.clientHeader')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.userIdHeader')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('permissions.auditLog.ipAddressHeader')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted">
            {userEvents.map((ev, idx) => {
              const time = ev.time ? new Date(ev.time).toLocaleString() : '—';
              const evType = ev.type || '—';
              const client = ev.clientId || '—';
              const userId = ev.userId?.substring?.(0, 12) || '—';
              const ip = ev.ipAddress || '—';
              const isError = evType.includes('ERROR');
              return (
                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{time}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="flat"
                      color={isError ? 'danger' : evType.includes('LOGIN') ? 'success' : evType.includes('LOGOUT') ? 'warning' : 'secondary'}
                      size="sm"
                    >
                      {evType}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{client}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{userId}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{ip}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiClockCounterClockwiseBold className="h-5 w-5 text-purple-500" />
          {t('permissions.auditLog.title')}
        </Title>
        <div className="flex items-center gap-2">
          {/* Admin/User toggle */}
          <div className="flex rounded-md border border-muted">
            <button
              type="button"
              onClick={() => setView('admin')}
              className={cn(
                'rounded-s-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'admin'
                  ? 'bg-primary text-white'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-100'
              )}
            >
              {t('permissions.auditLog.adminEvents')}
            </button>
            <button
              type="button"
              onClick={() => setView('user')}
              className={cn(
                'rounded-e-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'user'
                  ? 'bg-primary text-white'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-100'
              )}
            >
              {t('permissions.auditLog.userEvents')}
            </button>
          </div>
          <Select
            size="sm"
            className="w-24"
            options={[
              { value: 25, label: '25' },
              { value: 50, label: '50' },
              { value: 100, label: '100' },
            ]}
            value={{ value: maxResults, label: String(maxResults) }}
            onChange={(opt: any) => setMaxResults(opt?.value ?? 25)}
          />
          <IconTooltip
            content={showFilters ? t('permissions.auditLog.hideFilters') : t('permissions.auditLog.showFilters')}
            preset="toolbar"
          >
            <ActionIcon
              variant={showFilters ? 'solid' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
              size="sm"
            >
              <PiFunnelBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
          <IconTooltip content={t('permissions.common.refreshTooltip')} preset="toolbar">
            <ActionIcon variant="outline" onClick={fetchEvents} size="sm">
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="rounded-lg border border-muted bg-gray-50 p-4 dark:bg-gray-100">
          <div className="mb-3 flex items-center justify-between">
            <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t('permissions.auditLog.filtersLabel')}</Text>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-primary hover:underline"
            >
              {t('permissions.auditLog.clearAll')}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Event type / Operation filter */}
            {eventTypes.length > 0 ? (
              <Select
                size="sm"
                label={view === 'admin' ? t('permissions.auditLog.operationType') : t('permissions.auditLog.eventType')}
                options={[
                  { value: '', label: t('permissions.common.all') },
                  ...eventTypes.map((type) => ({ value: type, label: type })),
                ]}
                value={filterType ? { value: filterType, label: filterType } : { value: '', label: t('permissions.common.all') }}
                onChange={(opt: any) => setFilterType(opt?.value ?? '')}
              />
            ) : (
              <Input
                size="sm"
                label={view === 'admin' ? t('permissions.auditLog.operationType') : t('permissions.auditLog.eventType')}
                placeholder={t('permissions.auditLog.eventTypePlaceholder')}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              />
            )}

            {/* User filter */}
            <Input
              size="sm"
              label={t('permissions.auditLog.userIdHeader')}
              placeholder={t('permissions.auditLog.userIdPlaceholder')}
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            />

            {/* Date from */}
            <Input
              size="sm"
              type="date"
              label={t('permissions.auditLog.fromDate')}
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />

            {/* Date to */}
            <Input
              size="sm"
              type="date"
              label={t('permissions.auditLog.toDate')}
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader variant="spinner" size="lg" />
        </div>
      ) : errorStatus === 403 ? (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <PiWarningBold className="h-6 w-6 shrink-0 text-red-500" />
            <div>
              <Title as="h5" className="font-semibold text-red-700 dark:text-red-400">
                {t('permissions.common.accessDeniedTitle')}
              </Title>
              <Text className="mt-1 text-sm text-red-600 dark:text-red-300">
                {t('permissions.auditLog.accessDeniedMessage', {
                  view: view === 'admin'
                    ? t('permissions.auditLog.adminEvents')
                    : t('permissions.auditLog.userEvents'),
                })}
              </Text>
              <div className="mt-3 rounded-md bg-red-100 p-3 dark:bg-red-900/30">
                <code className="text-xs text-red-700 dark:text-red-300">
                  {view === 'admin'
                    ? t('permissions.auditLog.endpoint403Admin')
                    : t('permissions.auditLog.endpoint403User')}
                </code>
              </div>
              <Text className="mt-3 text-xs text-red-500">
                {t('permissions.auditLog.accessDeniedHint')}
              </Text>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => { setErrorStatus(null); fetchEvents(); }}
              >
                <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
                {t('permissions.common.retry')}
              </Button>
            </div>
          </div>
        </div>
      ) : errorStatus === 404 ? (
        <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-6 dark:border-orange-800 dark:bg-orange-950/30">
          <div className="flex items-start gap-3">
            <PiWarningBold className="h-6 w-6 shrink-0 text-orange-500" />
            <div>
              <Title as="h5" className="font-semibold text-orange-700 dark:text-orange-400">
                {t('permissions.common.backendNotAvailable')}
              </Title>
              <Text className="mt-1 text-sm text-orange-600 dark:text-orange-300">
                {t('permissions.auditLog.endpoint404Hint')}
              </Text>
              <div className="mt-3 rounded-md bg-orange-100 p-3 dark:bg-orange-900/30">
                <code className="text-xs text-orange-700 dark:text-orange-300">
                  {t('permissions.auditLog.endpoint404', { view })}
                </code>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => { setErrorStatus(null); fetchEvents(); }}
              >
                <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
                {t('permissions.common.retry')}
              </Button>
            </div>
          </div>
        </div>
      ) : view === 'admin' ? (
        renderAdminEvents()
      ) : (
        renderUserEvents()
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   RBAC Config Tab
   POST /rbac/config/export — export full config
   POST /rbac/config/import — import config
   POST /rbac/config/reset — reset to defaults
   POST /rbac/cache/invalidate — invalidate cache
   ════════════════════════════════════════════════ */

/**
 * RbacConfigTab — RBAC configuration management actions.
 *
 * Provides export, import, reset, and cache invalidation controls.
 *
 * @endpoint POST /rbac/config/export
 * @endpoint POST /rbac/config/import
 * @endpoint POST /rbac/config/reset
 * @endpoint POST /rbac/cache/invalidate
 */
function RbacConfigTab() {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [invalidating, setInvalidating] = useState(false);
  const [exportData, setExportData] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  /** Export full RBAC config as JSON */
  const handleExport = async () => {
    console.info('[RbacConfigTab] Exporting RBAC config...');
    setExporting(true);
    try {
      const data = await adminService.exportRbacConfig();
      const json = JSON.stringify(data, null, 2);
      setExportData(json);
      console.info('[RbacConfigTab] Export successful:', { size: json.length });
      toast.success(t('permissions.config.exportSuccess'));

      // Also trigger JSON download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rbac-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error('[RbacConfigTab] Export failed:', err);
      toast.error(t('permissions.config.exportError'));
    } finally {
      setExporting(false);
    }
  };

  /** Import RBAC config from JSON */
  const handleImport = async () => {
    if (!importText.trim()) return;
    console.info('[RbacConfigTab] Importing RBAC config...');
    setImporting(true);
    try {
      const config = JSON.parse(importText) as Record<string, any>;
      await adminService.importRbacConfig(config, false);
      toast.success(t('permissions.config.importSuccess'));
      console.info('[RbacConfigTab] Import successful');
      setImportText('');
      setShowImport(false);
    } catch (err: unknown) {
      console.error('[RbacConfigTab] Import failed:', err);
      if (err instanceof SyntaxError) {
        toast.error(t('permissions.config.invalidJson'));
      } else {
        toast.error(t('permissions.config.importError'));
      }
    } finally {
      setImporting(false);
    }
  };

  /** Reset RBAC to defaults — requires confirmation */
  const handleReset = async () => {
    const confirmed = window.confirm(t('permissions.config.resetConfirm'));
    if (!confirmed) return;

    console.info('[RbacConfigTab] Resetting RBAC config...');
    setResetting(true);
    try {
      await adminService.resetRbacConfig();
      toast.success(t('permissions.config.resetSuccess'));
      console.info('[RbacConfigTab] Reset successful');
    } catch (err: unknown) {
      console.error('[RbacConfigTab] Reset failed:', err);
      toast.error(t('permissions.config.resetError'));
    } finally {
      setResetting(false);
    }
  };

  /** Invalidate RBAC cache */
  const handleInvalidateCache = async () => {
    console.info('[RbacConfigTab] Invalidating RBAC cache...');
    setInvalidating(true);
    try {
      await adminService.invalidateRbacCache();
      toast.success(t('permissions.config.invalidateSuccess'));
      console.info('[RbacConfigTab] Cache invalidated');
    } catch (err: unknown) {
      console.error('[RbacConfigTab] Cache invalidation failed:', err);
      toast.error(t('permissions.config.invalidateError'));
    } finally {
      setInvalidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiGearSixBold className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          {t('permissions.config.title')}
        </Title>
      </div>

      {/* Action cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Export */}
        <div className="rounded-lg border border-muted p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-content-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30">
              <PiExportBold className="h-5 w-5" />
            </div>
            <div>
              <Title as="h6" className="text-sm font-semibold">{t('permissions.config.exportTitle')}</Title>
              <Text className="text-xs text-gray-500">{t('permissions.config.exportDesc')}</Text>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            isLoading={exporting}
            className="w-full"
          >
            {t('permissions.config.exportTitle')}
          </Button>
        </div>

        {/* Import */}
        <div className="rounded-lg border border-muted p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-content-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30">
              <PiUploadBold className="h-5 w-5" />
            </div>
            <div>
              <Title as="h6" className="text-sm font-semibold">{t('permissions.config.importTitle')}</Title>
              <Text className="text-xs text-gray-500">{t('permissions.config.importDesc')}</Text>
            </div>
          </div>
          {showImport ? (
            <div className="space-y-2">
              <textarea
                className="h-28 w-full rounded-md border border-muted bg-gray-50 p-2 font-mono text-xs dark:bg-gray-100"
                placeholder={t('permissions.config.importPlaceholder')}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleImport} isLoading={importing} className="flex-1">
                  {t('permissions.config.importTitle')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowImport(false)} className="flex-1">
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
              className="w-full"
            >
              {t('permissions.config.importTitle')}
            </Button>
          )}
        </div>

        {/* Cache Invalidate */}
        <div className="rounded-lg border border-muted p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-content-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/30">
              <PiLightningBold className="h-5 w-5" />
            </div>
            <div>
              <Title as="h6" className="text-sm font-semibold">{t('permissions.config.invalidateCache')}</Title>
              <Text className="text-xs text-gray-500">{t('permissions.config.invalidateCacheDesc')}</Text>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleInvalidateCache}
            isLoading={invalidating}
            className="w-full"
          >
            {t('permissions.config.invalidateCache')}
          </Button>
        </div>

        {/* Reset to Defaults */}
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50/30 p-5 dark:border-red-800 dark:bg-red-950/10">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-content-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/30">
              <PiArrowCounterClockwiseBold className="h-5 w-5" />
            </div>
            <div>
              <Title as="h6" className="text-sm font-semibold text-red-700 dark:text-red-400">{t('permissions.config.resetDefaults')}</Title>
              <Text className="text-xs text-red-600 dark:text-red-400">{t('permissions.config.resetDesc')}</Text>
            </div>
          </div>
          <Button
            variant="outline"
            color="danger"
            size="sm"
            onClick={handleReset}
            isLoading={resetting}
            className="w-full"
          >
            {t('permissions.config.resetDefaults')}
          </Button>
        </div>
      </div>

      {/* Exported data preview */}
      {exportData && (
        <div className="space-y-2">
          <Title as="h6" className="text-sm font-semibold">{t('permissions.config.previewTitle')}</Title>
          <pre className="max-h-64 overflow-auto rounded-lg border border-muted bg-gray-50 p-4 font-mono text-xs dark:bg-gray-100">
            {exportData}
          </pre>
        </div>
      )}
    </div>
  );
}
