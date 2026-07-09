// ============================================
// ActivityLogView — Admin activity/audit log viewer
// Fetches real events from GET /admin/events/user & /admin/events/admin
// ============================================
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Title, Text, Badge, Loader, Button, Input } from 'rizzui';
import { PiTimerDuotone, PiArrowClockwiseBold, PiFunnelBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/admin.service';

/** Shape of event entries from the backend */
interface EventEntry {
  time?: string | number;
  type?: string;
  operationType?: string;
  resourceType?: string;
  ipAddress?: string;
  userId?: string;
  authUser?: string;
  details?: Record<string, any>;
  [key: string]: any;
}

/**
 * ActivityLogView — Shows user and admin events from backend.
 *
 * Fetches data from:
 * - GET /admin/events/user (login, logout, token events)
 * - GET /admin/events/admin (admin audit events)
 *
 * @requires adminService.getUserEvents, adminService.getAdminEvents
 * @version 0.20.0
 */
export default function ActivityLogView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState(50);

  const fetchEvents = useCallback(async () => {
    console.info('[ActivityLogView] Fetching events:', { tab: activeTab, max: maxResults });
    setLoading(true);
    setError(null);

    try {
      let data: any[];
      if (activeTab === 'user') {
        data = await adminService.getUserEvents({ max: maxResults });
      } else {
        data = await adminService.getAdminEvents({ max: maxResults });
      }

      console.info('[ActivityLogView] Events fetched:', { count: data.length });
      setEvents(Array.isArray(data) ? (data as EventEntry[]) : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch events';
      console.error('[ActivityLogView] Failed to fetch events:', err);
      setError(msg);
      toast.error(t('activityDashboard.errorFetch'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, maxResults, t]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /**
   * Format timestamp — handles both ISO strings and unix milliseconds.
   */
  const formatTime = (time: string | number | undefined): string => {
    if (!time) return '—';
    try {
      const date = typeof time === 'number' ? new Date(time) : new Date(time);
      return date.toLocaleString('fa-IR');
    } catch {
      return String(time);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <PiTimerDuotone className="h-8 w-8 text-primary" />
          </div>
          <div>
            <Title as="h4" className="text-lg font-semibold">
              {t('admin.activityLog.title')}
            </Title>
            <Text className="text-sm text-gray-500">
              {t('activityDashboard.monitoring')}
            </Text>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchEvents}
          className="gap-1.5"
        >
          <PiArrowClockwiseBold className="h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'user' ? 'solid' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('user')}
        >
          {t('activityDashboard.userEventsTab')}
        </Button>
        <Button
          variant={activeTab === 'admin' ? 'solid' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('admin')}
        >
          {t('activityDashboard.adminEventsTab')}
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950/30">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
          <Button variant="outline" size="sm" onClick={fetchEvents} className="mt-4">
            {t('activityDashboard.retry')}
          </Button>
        </div>
      ) : events.length === 0 ? (
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
                {activeTab === 'admin' && (
                  <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                    {t('activityDashboard.operationColumn')}
                  </th>
                )}
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {t('activityDashboard.ipColumn')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                  {t('activityDashboard.userColumn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    'border-t border-muted transition-colors hover:bg-gray-50 dark:hover:bg-gray-100/50',
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-100/20' : ''
                  )}
                >
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatTime(event.time)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="flat" size="sm">
                      {event.type || event.operationType || '—'}
                    </Badge>
                  </td>
                  {activeTab === 'admin' && (
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {event.resourceType || '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {event.ipAddress || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                    {event.userId || event.authUser || '—'}
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
