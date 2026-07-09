'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Loader, Text, Title } from 'rizzui';
import { PiArrowClockwiseBold, PiTimerDuotone } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { authService } from '@/services/auth.service';

interface UserActivityRow {
  id?: string;
  action?: string;
  created_at?: string;
  ip_address?: string;
  details?: Record<string, unknown>;
}

/**
 * UserActivityLogView — Current user's activity log.
 *
 * Fetches self-scoped activity rows from backend and renders
 * loading/error/empty/success states with retry.
 *
 * @requires authService.getMyActivityLog
 */
export default function UserActivityLogView() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<UserActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    console.info('[UserActivityLogView] Fetching self activity log...');
    setLoading(true);
    setError(null);
    try {
      const data = await authService.getMyActivityLog({ limit: 100, offset: 0 });
      const normalized = Array.isArray(data) ? (data as UserActivityRow[]) : [];
      setRows(normalized);
      console.info('[UserActivityLogView] Self activity log fetched:', {
        count: normalized.length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('activityDashboard.errorFetch');
      console.error('[UserActivityLogView] Failed to fetch self activity log:', err);
      setError(message);
      toast.error(t('activityDashboard.errorFetch'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const formatDate = (value?: string): string => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('fa-IR');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <PiTimerDuotone className="h-8 w-8 text-primary" />
          </div>
          <div>
            <Title as="h4" className="text-lg font-semibold">
              {t('header.profile.activityLog')}
            </Title>
            <Text className="text-sm text-gray-500">{t('activityDashboard.monitoring')}</Text>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRows} className="gap-1.5">
          <PiArrowClockwiseBold className="h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950/30">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
          <Button variant="outline" size="sm" onClick={fetchRows} className="mt-4">
            {t('activityDashboard.retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-600">
          <PiTimerDuotone className="mx-auto h-12 w-12 text-gray-400" />
          <Text className="mt-3 text-gray-500">{t('activityDashboard.noEventsFound')}</Text>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-muted">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-100">
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {t('activityDashboard.timeColumn')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {t('activityDashboard.typeColumn')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {t('activityDashboard.ipColumn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.id ?? `${row.action ?? 'activity'}-${idx}`}
                  className={cn(
                    'border-t border-muted transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/50',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-100/20' : ''
                  )}
                >
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="flat" size="sm">
                      {row.action || '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
