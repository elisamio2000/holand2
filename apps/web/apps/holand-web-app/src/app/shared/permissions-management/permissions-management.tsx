'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Badge, Button, Empty, Loader, Text, Title } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiDownloadBold,
  PiGearBold,
  PiLockKeyBold,
  PiShieldCheckBold,
  PiWarningBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { adminService } from '@/services/admin.service';
import PermissionsView from '@/app/shared/roles-permissions/permissions-view';

/**
 * PermissionsManagement — Admin-level permissions management
 *
 * Sections:
 * 1. RBAC Configuration Overview (GET /rbac/config)
 * 2. Permissions Matrix, Overrides & File Overrides (via PermissionsView)
 * 3. Route Permissions (GET /rbac/routes/permissions)
 *
 * ✅ All endpoints verified against backend
 */

type ActiveSection = 'matrix' | 'config' | 'routes';

interface RbacConfig {
  roles?: string[];
  permissions?: string[];
  sections?: string[];
  [key: string]: any;
}

interface RoutePermission {
  route: string;
  methods: string[];
  permissions: string[];
  [key: string]: any;
}

export default function PermissionsManagement() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<ActiveSection>('matrix');

  return (
    <div className="space-y-6">
      {/* Section selector */}
      <div className="flex gap-2 overflow-x-auto rounded-xl border border-muted bg-gray-0 p-1.5 dark:bg-gray-50">
        {[
          {
            key: 'matrix' as ActiveSection,
            label: t('permissionsPage.tabMatrix'),
            icon: <PiShieldCheckBold className="h-[18px] w-[18px]" />,
            description: t('permissionsPage.tabMatrixDesc'),
          },
          {
            key: 'config' as ActiveSection,
            label: t('permissionsPage.tabRbac'),
            icon: <PiGearBold className="h-[18px] w-[18px]" />,
            description: t('permissionsPage.tabRbacDesc'),
          },
          {
            key: 'routes' as ActiveSection,
            label: t('permissionsPage.tabRoutes'),
            icon: <PiLockKeyBold className="h-[18px] w-[18px]" />,
            description: t('permissionsPage.tabRoutesDesc'),
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={cn(
              'group flex min-w-[140px] flex-1 items-center gap-3 rounded-lg px-4 py-3 text-left transition-all',
              activeSection === tab.key
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-200/50'
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                activeSection === tab.key
                  ? 'bg-white/20'
                  : 'bg-gray-100 dark:bg-gray-200/70'
              )}
            >
              {tab.icon}
            </span>
            <div className="min-w-0">
              <Text
                className={cn(
                  'text-sm font-semibold',
                  activeSection === tab.key ? 'text-white' : ''
                )}
              >
                {tab.label}
              </Text>
              <Text
                className={cn(
                  'hidden text-xs lg:block',
                  activeSection === tab.key ? 'text-white/70' : 'text-gray-400'
                )}
              >
                {tab.description}
              </Text>
            </div>
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="rounded-xl border border-muted bg-gray-0 p-5 dark:bg-gray-50 lg:p-6">
        {activeSection === 'matrix' && <PermissionsView />}
        {activeSection === 'config' && <RbacConfigSection />}
        {activeSection === 'routes' && <RoutePermissionsSection />}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   RBAC Configuration Section
   ════════════════════════════════════════════════ */
function RbacConfigSection() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<RbacConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalidating, setInvalidating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getRbacConfig();
      setConfig(data);
    } catch {
      toast.error(t('permissionsPage.errorLoadRbac'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleInvalidateCache = async () => {
    setInvalidating(true);
    try {
      await adminService.invalidateRbacCache();
      toast.success(t('permissionsPage.cacheInvalidated'));
    } catch {
      toast.error(t('permissionsPage.errorInvalidateCache'));
    } finally {
      setInvalidating(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await adminService.exportRbacConfig();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rbac-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('permissionsPage.exportSuccess'));
    } catch {
      toast.error(t('permissionsPage.errorExport'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  if (!config) {
    return (
      <Empty
        text={t('permissionsPage.errorLoadRbac')}
        textClassName="text-sm text-gray-500 mt-2"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiGearBold className="h-5 w-5 text-primary" />
          {t('permissionsPage.rbacTitle')}
        </Title>
        <div className="flex gap-2">
          <Tooltip content={t('permissionsPage.exportTooltip')}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="gap-1.5"
            >
              <PiDownloadBold className="h-4 w-4" />
              {exporting ? t('permissionsPage.exporting') : t('permissionsPage.export')}
            </Button>
          </Tooltip>
          <Tooltip content={t('permissionsPage.invalidateCacheTooltip')}>
            <Button
              variant="outline"
              size="sm"
              color="danger"
              onClick={handleInvalidateCache}
              disabled={invalidating}
              className="gap-1.5"
            >
              <PiArrowsClockwiseBold className="h-4 w-4" />
              {invalidating ? t('permissionsPage.invalidating') : t('permissionsPage.invalidateCache')}
            </Button>
          </Tooltip>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfig}
            className="gap-1.5"
          >
            <PiArrowsClockwiseBold className="h-4 w-4" />
          {t('permissionsPage.refresh')}
          </Button>
        </div>
      </div>

      {/* Config Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Roles */}
        {config.roles && (
          <div className="rounded-lg border border-muted p-4">
            <div className="mb-3 flex items-center justify-between">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('permissionsPage.definedRoles')}
              </Text>
              <Badge variant="outline" size="sm">
                {config.roles.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {config.roles.map((role: string) => (
                <Badge
                  key={role}
                  variant="flat"
                  color="primary"
                  size="sm"
                  className="font-mono text-xs"
                >
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Sections */}
        {config.sections && (
          <div className="rounded-lg border border-muted p-4">
            <div className="mb-3 flex items-center justify-between">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('permissionsPage.definedSections')}
              </Text>
              <Badge variant="outline" size="sm">
                {config.sections.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {config.sections.map((section: string) => (
                <Badge
                  key={section}
                  variant="flat"
                  color="secondary"
                  size="sm"
                  className="font-mono text-xs"
                >
                  {section}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Permissions count */}
        {config.permissions && (
          <div className="rounded-lg border border-muted p-4">
            <div className="mb-3 flex items-center justify-between">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('permissionsPage.totalPermissions')}
              </Text>
              <Badge variant="outline" size="sm">
                {config.permissions.length}
              </Badge>
            </div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {t('permissionsPage.totalPermissionsDesc')}
            </Text>
          </div>
        )}
      </div>

      {/* Raw JSON viewer */}
      <details className="rounded-lg border border-muted">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
          {t('permissionsPage.rawConfig')}
        </summary>
        <pre className="max-h-96 overflow-auto border-t border-muted bg-gray-50 p-4 font-mono text-xs text-gray-700 dark:bg-gray-100 dark:text-gray-300">
          {JSON.stringify(config, null, 2)}
        </pre>
      </details>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Route Permissions Section
   ════════════════════════════════════════════════ */
function RoutePermissionsSection() {
  const { t } = useTranslation();
  const [routes, setRoutes] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getRoutePermissions();
      setRoutes(data);
    } catch {
      toast.error(t('permissionsPage.errorLoadRoutes'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  if (!routes) {
    return (
      <Empty
        text={t('permissionsPage.errorLoadRoutes')}
        textClassName="text-sm text-gray-500 mt-2"
      />
    );
  }

  const routeEntries = Object.entries(routes);

  if (routeEntries.length === 0) {
    return (
      <Empty
        text={t('permissionsPage.emptyRoutes')}
        textClassName="text-sm text-gray-500 mt-2"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title as="h5" className="flex items-center gap-2 font-semibold">
          <PiLockKeyBold className="h-5 w-5 text-primary" />
          {t('permissionsPage.routesTitle')}
        </Title>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRoutes}
          className="gap-1.5"
        >
          <PiArrowsClockwiseBold className="h-4 w-4" />
          {t('permissionsPage.refresh')}
        </Button>
      </div>

      <Text className="text-sm text-gray-500 dark:text-gray-400">
        {t('permissionsPage.routesDesc')}
      </Text>

      {/* Route Table */}
      <div className="overflow-auto rounded-lg border border-muted">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-muted bg-gray-50 dark:bg-gray-100">
              <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                {t('permissionsPage.colRoute')}
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                {t('permissionsPage.colMethods')}
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                {t('permissionsPage.colPermissions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {routeEntries.map(([route, config]) => {
              const methods = Array.isArray(config?.methods)
                ? config.methods
                : typeof config === 'object' && config !== null
                  ? Object.keys(config)
                  : [];
              const permissions = Array.isArray(config?.permissions)
                ? config.permissions
                : [];

              return (
                <tr
                  key={route}
                  className="border-b border-muted last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {route}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {methods.map((method: string) => (
                        <Badge
                          key={method}
                          variant="flat"
                          size="sm"
                          color={
                            method === 'GET'
                              ? 'success'
                              : method === 'POST'
                                ? 'info'
                                : method === 'PUT' || method === 'PATCH'
                                  ? 'warning'
                                  : method === 'DELETE'
                                    ? 'danger'
                                    : 'secondary'
                          }
                          className="font-mono text-xs"
                        >
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {permissions.length > 0 ? (
                        permissions.map((perm: string) => (
                          <Badge
                            key={perm}
                            variant="outline"
                            size="sm"
                            className="font-mono text-xs"
                          >
                            {perm}
                          </Badge>
                        ))
                      ) : (
                        <Text className="text-xs text-gray-400">
                          {t('permissionsPage.noPermissionRequired')}
                        </Text>
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
