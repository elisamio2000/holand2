// ============================================
// SecurityDashboardView — Security monitoring with real API
// Uses GET /admin/security/blocked-ips, POST /admin/security/unblock-ip
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import { Title, Text, Badge, Loader, Button, ActionIcon, Input, Empty } from 'rizzui';
import {
  PiShieldCheckBold,
  PiShieldWarningBold,
  PiProhibitBold,
  PiArrowClockwiseBold,
  PiLockKeyBold,
  PiCheckCircleBold,
  PiMagnifyingGlassBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import MetricCard from '@core/components/cards/metric-card';
import { useTranslation } from 'react-i18next';
import { gatewayClient } from '@/lib/api-client';

// ==========================================
// Types
// ==========================================

/** Blocked IP entry from GET /admin/security/blocked-ips */
interface BlockedIp {
  ip_address?: string;
  ip?: string;
  reason?: string;
  blocked_at?: string;
  blocked_until?: string;
  attempts?: number;
  [key: string]: unknown;
}

/**
 * SecurityDashboardView — Blocked IP management and security metrics.
 *
 * Fetches data from:
 * - GET /admin/security/blocked-ips — list of blocked IPs
 * - POST /admin/security/unblock-ip/{ip_address} — unblock specific IP
 *
 * Shows:
 * - Blocked IP count metrics
 * - Searchable blocked IPs table with unblock actions
 *
 * @requires gatewayClient
 * @version 0.21.0
 */
export default function SecurityDashboardView() {
  const { t } = useTranslation();

  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [unblocking, setUnblocking] = useState<string | null>(null);

  // ==========================================
  // Data Fetching
  // ==========================================

  /**
   * Fetch blocked IPs list.
   * @endpoint GET /admin/security/blocked-ips
   */
  const fetchBlockedIps = useCallback(async () => {
    console.info('[SecurityDashboardView] Fetching blocked IPs...');
    setLoading(true);
    setError(null);
    try {
      const res = await gatewayClient.get('/admin/security/blocked-ips');
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.blocked_ips || data?.items || [];
      console.info('[SecurityDashboardView] Blocked IPs loaded:', { count: list.length });
      setBlockedIps(list);
    } catch (err: unknown) {
      console.error('[SecurityDashboardView] Failed to fetch blocked IPs:', err);
      setError(t('errors.loadBlockedIps'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBlockedIps();
  }, [fetchBlockedIps]);

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Unblock a specific IP.
   * @endpoint POST /admin/security/unblock-ip/{ip_address}
   */
  const handleUnblock = useCallback(
    async (ip: string) => {
      if (!confirm(t('security.actions.unblockConfirm', { ip }))) return;
      console.info('[SecurityDashboardView] Unblocking IP:', { ip });
      setUnblocking(ip);
      try {
        await gatewayClient.post(`/admin/security/unblock-ip/${encodeURIComponent(ip)}`);
        console.info('[SecurityDashboardView] IP unblocked:', { ip });
        toast.success(`${ip} ${t('security.actions.unblocked')}`);
        fetchBlockedIps();
      } catch (err: unknown) {
        console.error('[SecurityDashboardView] Unblock failed:', { ip, err });
        toast.error(t('errors.unblockIp'));
      } finally {
        setUnblocking(null);
      }
    },
    [fetchBlockedIps, t]
  );

  // ==========================================
  // Computed
  // ==========================================

  const filteredIps = blockedIps.filter((entry) => {
    if (!search) return true;
    const ip = entry.ip_address || entry.ip || '';
    const reason = entry.reason || '';
    return ip.includes(search) || reason.toLowerCase().includes(search.toLowerCase());
  });

  /** Format date for display. */
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  // ==========================================
  // Render
  // ==========================================

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-12 text-center dark:border-red-800 dark:bg-red-950/30">
        <PiWarningCircleBold className="mx-auto h-12 w-12 text-red-500" />
        <Title as="h5" className="mt-3 text-red-600 dark:text-red-400">
          {error}
        </Title>
        <Button variant="outline" size="sm" onClick={fetchBlockedIps} className="mt-4">
          {t('common.refresh')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title={t('security.metrics.totalBlocked')}
          metric={blockedIps.length}
          icon={<PiProhibitBold className="h-6 w-6 text-red-500" />}
          iconClassName="bg-red-100 dark:bg-red-900/30"
        />
        <MetricCard
          title={t('security.metrics.securityStatus')}
          metric={blockedIps.length === 0 ? t('security.status.healthy') : t('security.status.attention')}
          icon={
            blockedIps.length === 0 ? (
              <PiShieldCheckBold className="h-6 w-6 text-green-500" />
            ) : (
              <PiShieldWarningBold className="h-6 w-6 text-amber-500" />
            )
          }
          iconClassName={cn(
            blockedIps.length === 0
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-amber-100 dark:bg-amber-900/30'
          )}
        />
        <MetricCard
          title={t('security.metrics.protection')}
          metric={t('security.status.active')}
          icon={<PiLockKeyBold className="h-6 w-6 text-primary" />}
          iconClassName="bg-primary/10"
        />
      </div>

      {/* Blocked IPs Table */}
      <div className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
        <div className="flex flex-col gap-3 border-b border-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Title as="h5" className="flex items-center gap-2 font-semibold">
            <PiProhibitBold className="h-5 w-5 text-red-500" />
            {t('security.blockedIps.title')} ({filteredIps.length})
          </Title>
          <div className="flex items-center gap-2">
            <Input
              size="sm"
              placeholder={t('security.blockedIps.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<PiMagnifyingGlassBold className="h-4 w-4 text-gray-400" />}
              className="w-64"
            />
            <Tooltip content={t('common.refresh')}>
              <ActionIcon variant="outline" size="sm" onClick={fetchBlockedIps}>
                <PiArrowClockwiseBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {filteredIps.length === 0 ? (
          <div className="p-12 text-center">
            {blockedIps.length === 0 ? (
              <>
                <PiShieldCheckBold className="mx-auto h-12 w-12 text-green-400" />
                <Title as="h6" className="mt-3 text-green-600 dark:text-green-400">
                  {t('security.blockedIps.noBlocked')}
                </Title>
                <Text className="mt-1 text-gray-500">
                  {t('security.blockedIps.allClear')}
                </Text>
              </>
            ) : (
              <>
                <PiMagnifyingGlassBold className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-500" />
                <Text className="mt-3 text-gray-500">
                  {t('common.noResults')}
                </Text>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-100">
                  <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                    {t('security.blockedIps.ipAddress')}
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 sm:table-cell">
                    {t('security.blockedIps.reason')}
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 md:table-cell">
                    {t('security.blockedIps.blockedAt')}
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 lg:table-cell">
                    {t('security.blockedIps.attempts')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {filteredIps.map((entry, idx) => {
                  const ip = entry.ip_address || entry.ip || `unknown-${idx}`;
                  return (
                    <tr
                      key={ip}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                    >
                      <td className="px-4 py-3">
                        <Text className="font-mono font-medium">{ip}</Text>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge
                          variant="flat"
                          color={
                            (entry.reason || '').includes('brute')
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {entry.reason || '—'}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Text className="text-xs text-gray-500">
                          {formatDate(entry.blocked_at)}
                        </Text>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <Badge variant="flat" size="sm">
                          {entry.attempts ?? '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Tooltip content={t('security.actions.unblock')}>
                            <ActionIcon
                              variant="outline"
                              color="primary"
                              size="sm"
                              onClick={() => handleUnblock(ip)}
                              disabled={unblocking === ip}
                            >
                              {unblocking === ip ? (
                                <Loader size="sm" />
                              ) : (
                                <PiCheckCircleBold className="h-4 w-4" />
                              )}
                            </ActionIcon>
                          </Tooltip>
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
    </div>
  );
}
