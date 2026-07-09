'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { adminService } from '@/services/admin.service';
import {
  getEnvConfig,
  mergeConfig,
  parseAdminBugReportSettings,
  type BugReportConfig,
} from './bug-report-config';

/** Matches gateway GET /admin/settings — require_any_permission admin:settings:read | admin:system:read */
function canReadAdminBugReportSettings(session: Session | null): boolean {
  const user = session?.user as
    | { permissions?: string[]; isSuperAdmin?: boolean }
    | undefined;
  if (user?.isSuperAdmin) return true;
  const perms = user?.permissions ?? [];
  return (
    perms.includes('admin:settings:read') || perms.includes('admin:system:read')
  );
}

export function useBugReportConfig() {
  const { data: session, status } = useSession();
  const envConfig = useMemo(() => getEnvConfig(), []);
  const [adminOverride, setAdminOverride] = useState<ReturnType<typeof parseAdminBugReportSettings>>({});
  const [adminLoaded, setAdminLoaded] = useState(false);
  const canLoadAdminSettings =
    status === 'authenticated' && canReadAdminBugReportSettings(session);

  const fetchAdminConfig = useCallback(async () => {
    if (!canLoadAdminSettings) {
      setAdminOverride({});
      setAdminLoaded(true);
      return;
    }

    try {
      const settings = await adminService.getSystemSettings();
      setAdminOverride(parseAdminBugReportSettings(settings as Record<string, unknown>));
    } catch {
      /* admin settings optional — fall back to env */
    } finally {
      setAdminLoaded(true);
    }
  }, [canLoadAdminSettings]);

  useEffect(() => {
    void fetchAdminConfig();
  }, [fetchAdminConfig]);

  const config = useMemo(
    () => mergeConfig(envConfig, adminOverride),
    [envConfig, adminOverride]
  );

  const isEnabled = config.enabled && status === 'authenticated';

  return {
    config,
    isEnabled,
    isAuthenticated: status === 'authenticated',
    adminLoaded,
    refreshConfig: fetchAdminConfig,
  };
}
