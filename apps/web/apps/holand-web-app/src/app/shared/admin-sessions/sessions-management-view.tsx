// ============================================
// SessionsManagementView — Admin session management
// Uses real APIs: GET /admin/sessions/stats, user sessions, revoke
// ============================================
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Title, Text, Badge, Loader, Button, Input } from 'rizzui';
import {
  PiGlobeHemisphereWestDuotone,
  PiArrowClockwiseBold,
  PiSignOutBold,
  PiMagnifyingGlassBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/admin.service';

/**
 * SessionsManagementView — Admin view for managing active user sessions.
 *
 * Uses real backend APIs:
 * - GET /admin/sessions/stats (session statistics)
 * - GET /admin/sessions/user/{userId} (user sessions)
 * - DELETE /admin/sessions/{sessionId} (revoke session)
 * - POST /admin/sessions/user/{userId}/logout (logout user)
 *
 * @requires adminService
 * @version 0.20.0
 */
export default function SessionsManagementView() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchUserId, setSearchUserId] = useState('');
  const [userSessions, setUserSessions] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    console.info('[SessionsManagementView] Fetching session stats...');
    setLoading(true);
    try {
      const data = await adminService.getSessionStats();
      console.info('[SessionsManagementView] Session stats loaded:', data);
      setStats(data);
    } catch (err: unknown) {
      console.error('[SessionsManagementView] Failed to fetch stats:', err);
      toast.error(t('sessionsDashboard.errorFetchStats'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSearchSessions = useCallback(async () => {
    if (!searchUserId.trim()) return;
    console.info('[SessionsManagementView] Searching user sessions:', { userId: searchUserId });
    setSearchLoading(true);
    try {
      const sessions = await adminService.getUserSessions(searchUserId.trim());
      console.info('[SessionsManagementView] User sessions found:', {
        userId: searchUserId,
        count: sessions.length,
      });
      setUserSessions(sessions);
    } catch (err: unknown) {
      console.error('[SessionsManagementView] Failed to search sessions:', err);
      toast.error(t('sessionsDashboard.errorSearchSessions'));
      setUserSessions([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchUserId, t]);

  const handleRevokeSession = useCallback(async (sessionId: string) => {
    console.info('[SessionsManagementView] Revoking session:', { sessionId });
    try {
      await adminService.revokeSession(sessionId, searchUserId || undefined);
      toast.success(t('sessionsDashboard.sessionRevoked'));
      if (searchUserId) {
        const refreshed = await adminService.getUserSessions(searchUserId);
        setUserSessions(refreshed);
      } else {
        setUserSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (err: unknown) {
      console.error('[SessionsManagementView] Failed to revoke session:', err);
      toast.error(t('sessionsDashboard.errorRevokeSession'));
    }
  }, [searchUserId, t]);

  const handleLogoutUser = useCallback(
    async (userId: string) => {
      console.info('[SessionsManagementView] Logging out user:', { userId });
      try {
        await adminService.logoutUser(userId);
        toast.success(t('sessionsDashboard.userLoggedOut'));
        setUserSessions([]);
      } catch (err: unknown) {
        console.error('[SessionsManagementView] Failed to logout user:', err);
        toast.error(t('sessionsDashboard.errorLogoutUser'));
      }
    },
    [t]
  );

  /**
   * Format ISO timestamp to Persian locale.
   */
  const formatTime = (time: string | null | undefined): string => {
    if (!time) return '—';
    try {
      return new Date(time).toLocaleString('fa-IR');
    } catch {
      return time;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <PiGlobeHemisphereWestDuotone className="h-8 w-8 text-primary" />
          </div>
          <div>
            <Title as="h4" className="text-lg font-semibold">
              {t('admin.sessions.title')}
            </Title>
            <Text className="text-sm text-gray-500">
              {t('admin.sessions.description')}
            </Text>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} className="gap-1.5">
          <PiArrowClockwiseBold className="h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Object.entries(stats).map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50"
            >
              <Text className="text-xs text-gray-500">{key}</Text>
              <Title as="h5" className="mt-1 text-2xl font-bold">
                {typeof value === 'number' ? value.toLocaleString('fa-IR') : String(value)}
              </Title>
            </div>
          ))}
        </div>
      ) : null}

      {/* Search User Sessions */}
      <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <Title as="h5" className="mb-4 font-semibold">
          {t('sessionsDashboard.searchTitle')}
        </Title>
        <div className="flex gap-3">
          <Input
            placeholder={t('sessionsDashboard.userIdPlaceholder')}
            value={searchUserId}
            onChange={(e) => setSearchUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSessions()}
            className="flex-1"
          />
          <Button
            onClick={handleSearchSessions}
            disabled={searchLoading || !searchUserId.trim()}
            className="gap-1.5"
          >
            <PiMagnifyingGlassBold className="h-4 w-4" />
            {t('common.search')}
          </Button>
        </div>

        {/* Search Results */}
        {searchLoading ? (
          <div className="mt-6 flex justify-center">
            <Loader size="md" />
          </div>
        ) : userSessions.length > 0 ? (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {userSessions.length} {t('sessionsDashboard.activeSessions')}
              </Text>
              <Button
                variant="outline"
                color="danger"
                size="sm"
                onClick={() => handleLogoutUser(searchUserId.trim())}
                className="gap-1.5"
              >
                <PiSignOutBold className="h-3.5 w-3.5" />
                {t('sessionsDashboard.logoutAllSessions')}
              </Button>
            </div>

            {userSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border border-muted p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="flat"
                      color={session.is_active ? 'success' : 'danger'}
                      size="sm"
                    >
                      {session.is_active ? t('sessionsDashboard.sessionActive') : t('sessionsDashboard.sessionInactive')}
                    </Badge>
                    <Text className="font-mono text-xs text-gray-400">
                      {session.id?.substring(0, 12)}...
                    </Text>
                  </div>
                  <Text className="text-xs text-gray-500">
                    {t('adminSessions.ipPrefix')} {session.ip_address || '—'} | {t('sessionsDashboard.lastActiveLabel')}:{' '}
                    {formatTime(session.last_active)}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {t('sessionsDashboard.startedLabel')}: {formatTime(session.started_at)}
                  </Text>
                </div>
                <Button
                  variant="outline"
                  color="danger"
                  size="sm"
                  onClick={() => handleRevokeSession(session.id)}
                >
                  {t('sessionsDashboard.revokeSession')}
                </Button>
              </div>
            ))}
          </div>
        ) : searchUserId.trim() && !searchLoading ? (
          <div className="mt-6 text-center">
            <Text className="text-sm text-gray-500">{t('sessionsDashboard.noActiveSessions')}</Text>
          </div>
        ) : null}
      </div>
    </div>
  );
}
