// ============================================
// Admin Stats Dashboard — System-wide statistics overview
// Displays total users, sessions, messages, active users,
// and session statistics from real backend APIs.
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ActionIcon, Badge, Button, Empty, Loader, Text, Title } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiUsersBold,
  PiDesktopBold,
  PiChatCircleTextBold,
  PiLightningBold,
  PiChartBarBold,
  PiSignOutBold,
  PiWarningBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/admin.service';
import type { SystemStats } from '@/types/auth.types';

/**
 * AdminStats — Admin-level system statistics dashboard.
 *
 * Displays:
 * 1. System overview cards (users, sessions, messages, active users)
 * 2. Session statistics by client
 * 3. Logout all users action
 *
 * @requires adminService.getStats — GET /admin/stats
 * @requires adminService.getSessionStats — GET /admin/sessions/stats
 * @requires adminService.logoutAllUsers — POST /admin/sessions/logout-all
 *
 * @example
 * ```tsx
 * <AdminStats />
 * ```
 */
export default function AdminStats() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [sessionStats, setSessionStats] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  /**
   * fetchAll — Fetch system stats and session stats in parallel.
   */
  const fetchAll = useCallback(async () => {
    console.info('[AdminStats] Fetching system stats and session stats...');
    setLoading(true);
    setStatsError(null);
    try {
      const [sysStats, sessStats] = await Promise.allSettled([
        adminService.getStats(),
        adminService.getSessionStats(),
      ]);

      if (sysStats.status === 'fulfilled') {
        console.info('[AdminStats] System stats loaded:', sysStats.value);
        setStats(sysStats.value);
      } else {
        console.error('[AdminStats] Failed to load system stats:', sysStats.reason);
        setStats(null);
        const err = sysStats.reason as { response?: { data?: { detail?: string } }; message?: string };
        setStatsError(
          err?.response?.data?.detail ||
            err?.message ||
            t('adminStats.loadError', { defaultValue: 'Failed to load system statistics' })
        );
      }

      if (sessStats.status === 'fulfilled') {
        console.info('[AdminStats] Session stats loaded:', {
          keys: Object.keys(sessStats.value || {}),
        });
        setSessionStats(sessStats.value);
      } else {
        console.warn('[AdminStats] Session stats not available:', sessStats.reason);
        setSessionStats(null);
      }
    } catch (err: unknown) {
      console.error('[AdminStats] Unexpected error:', err);
      toast.error(t('adminDashboard.logoutAllError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * handleLogoutAll — Force logout all users system-wide.
   * @endpoint POST /admin/sessions/logout-all
   */
  const handleLogoutAll = async () => {
    if (
      !confirm(t('adminDashboard.logoutAllConfirm'))
    )
      return;

    console.info('[AdminStats] Logging out all users...');
    setLoggingOutAll(true);
    try {
      await adminService.logoutAllUsers();
      console.info('[AdminStats] All users logged out successfully');
      toast.success(t('adminDashboard.logoutAllSuccess'));
      // Refresh stats after logout
      fetchAll();
    } catch (err: unknown) {
      console.error('[AdminStats] Failed to logout all users:', err);
      toast.error(t('adminDashboard.logoutAllError'));
    } finally {
      setLoggingOutAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <Title as="h4" className="flex items-center gap-2 font-semibold">
          <PiChartBarBold className="h-6 w-6 text-primary" />
          {t('adminDashboard.systemStatistics')}
        </Title>
        <div className="flex items-center gap-2">
          <Tooltip content={t('adminDashboard.refreshStats')}>
            <ActionIcon variant="outline" onClick={fetchAll} size="sm">
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {statsError ? (
        <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
          <div className="flex items-start gap-3">
            <PiWarningBold className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
            <div>
              <Text className="text-sm font-medium text-orange-700 dark:text-orange-400">
                {t('adminStats.loadErrorTitle', { defaultValue: 'Statistics unavailable' })}
              </Text>
              <Text className="mt-1 text-xs text-orange-600 dark:text-orange-300">{statsError}</Text>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchAll}>
                <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
                {t('adminStats.retry', { defaultValue: 'Retry' })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<PiUsersBold className="h-6 w-6" />}
          label={t('adminDashboard.totalUsers')}
          value={stats?.total_users ?? 0}
          color="primary"
        />
        <StatCard
          icon={<PiDesktopBold className="h-6 w-6" />}
          label={t('adminDashboard.activeSessions')}
          value={stats?.total_sessions ?? 0}
          color="info"
        />
        <StatCard
          icon={<PiChatCircleTextBold className="h-6 w-6" />}
          label={t('adminDashboard.totalMessages')}
          value={stats?.total_messages ?? 0}
          color="success"
        />
        <StatCard
          icon={<PiLightningBold className="h-6 w-6" />}
          label={t('adminDashboard.activeUsers24h')}
          value={stats?.active_users_24h ?? 0}
          color="warning"
        />
      </div>

      {/* Session Stats */}
      <div className="rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50">
        <Title as="h5" className="mb-3 flex items-center gap-2 font-semibold">
          <PiDesktopBold className="h-5 w-5 text-blue-500" />
          {t('adminDashboard.sessionStatsByClient')}
        </Title>
        {sessionStats ? (
          <SessionStatsTable data={sessionStats} />
        ) : (
          <Empty
            text={t('adminDashboard.sessionStatsNotAvailable')}
            textClassName="text-sm text-gray-500 mt-2"
          />
        )}
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
        <Title as="h5" className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
          <PiSignOutBold className="h-5 w-5" />
          {t('adminDashboard.dangerZone')}
        </Title>
        <Text className="mb-3 text-xs text-red-600/80 dark:text-red-400/80">
          {t('adminDashboard.dangerZoneDesc')}
        </Text>
        <Button
          variant="outline"
          color="danger"
          size="sm"
          onClick={handleLogoutAll}
          isLoading={loggingOutAll}
          className="gap-1"
        >
          <PiSignOutBold className="h-4 w-4" />
          {t('adminDashboard.logoutAllUsers')}
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// StatCard — Single statistics card component
// ==========================================

/**
 * StatCard — Displays a single statistic with icon, label, and value.
 *
 * @param icon - React node for the icon
 * @param label - Stat label text
 * @param value - Numeric value to display
 * @param color - Badge color variant
 */
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'secondary';
}) {
  /** Format large numbers with commas */
  const formattedValue = value.toLocaleString();

  return (
    <div className="rounded-lg border border-muted bg-gray-0 p-4 transition-shadow hover:shadow-md dark:bg-gray-50">
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            color === 'primary' && 'bg-primary/10 text-primary',
            color === 'info' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
            color === 'success' && 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
            color === 'warning' && 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
            color === 'danger' && 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
            color === 'secondary' && 'bg-gray-100 text-gray-600 dark:bg-gray-200 dark:text-gray-400'
          )}
        >
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-700">
          {formattedValue}
        </Text>
        <Text className="text-xs text-gray-500">{label}</Text>
      </div>
    </div>
  );
}

// ==========================================
// SessionStatsTable — Session statistics breakdown
// ==========================================

/**
 * SessionStatsTable — Renders session statistics in a table format.
 *
 * Handles various response shapes: array of objects, object with client keys, etc.
 *
 * @param data - Session stats data from backend
 */
function SessionStatsTable({ data }: { data: Record<string, any> }) {
  const { t } = useTranslation();
  // Normalize data to array of { client, sessions, ... }
  let rows: { client: string; [key: string]: any }[] = [];

  if (Array.isArray(data)) {
    rows = data.map((item: any) => ({
      client: item.clientId || item.client || item.client_id || 'unknown',
      ...item,
    }));
  } else if (typeof data === 'object') {
    // Backend might return { clientId: { active: N, ... } }
    rows = Object.entries(data).map(([key, val]) => ({
      client: key,
      ...(typeof val === 'object' ? val : { sessions: val }),
    }));
  }

  if (rows.length === 0) {
    return <Empty text={t('adminStats.noSessionData')} textClassName="text-sm text-gray-500 mt-2" />;
  }

  // Determine columns from first row (excluding 'client')
  const allKeys = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((k) => {
      if (k !== 'client' && k !== 'clientId' && k !== 'client_id') {
        allKeys.add(k);
      }
    });
  });
  const columns = Array.from(allKeys).sort();

  return (
    <div className="overflow-auto rounded-lg border border-muted">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-200/70">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">{t('adminStats.colClient')}</th>
            {columns.map((col) => (
              <th key={col} className="px-4 py-2.5 text-center font-medium capitalize">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-muted">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-100/30">
              <td className="px-4 py-2.5 font-medium">{row.client}</td>
              {columns.map((col) => (
                <td key={col} className="px-4 py-2.5 text-center">
                  <Badge variant="flat" color="primary" size="sm">
                    {typeof row[col] === 'number' ? row[col].toLocaleString() : String(row[col] ?? '—')}
                  </Badge>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
