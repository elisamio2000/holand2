'use client';

import { IconTooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Badge, Button, Input, Loader, Text, Title, Empty, Password } from 'rizzui';
import {
  PiXBold,
  PiCopyBold,
  PiUserBold,
  PiEnvelopeBold,
  PiShieldCheckBold,
  PiCalendarBold,
  PiSignInBold,
  PiDesktopBold,
  PiTrashBold,
  PiArrowsClockwiseBold,
  PiWarningCircleBold,
  PiGlobeBold,
  PiKeyBold,
  PiSignOutBold,
  PiEyeBold,
  PiEyeSlashBold,
} from 'react-icons/pi';
import { useDrawer } from '@/app/shared/drawer-views/use-drawer';
import { adminService } from '@/services/admin.service';
import type { UserInfo, UserSession, EffectivePermissions } from '@/types/auth.types';

/**
 * User Detail Drawer — Displays full user info, sessions, roles, permissions
 *
 * ✅ GET /users/:id — User details
 * ✅ GET /sessions/user/:id — User sessions
 * ✅ DELETE /sessions/:id — Revoke session
 * ✅ GET /roles/user/:id — User roles
 * ✅ GET /rbac/user/:id/effective — Effective permissions
 * ✅ GET /group-rbac/users/:id/groups — User groups
 */

interface UserDetailDrawerProps {
  userId: string;
  onUpdated?: () => void;
}

export default function UserDetailDrawer({ userId, onUpdated }: UserDetailDrawerProps) {
  const { t } = useTranslation();
  const { closeDrawer } = useDrawer();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<EffectivePermissions | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'sessions' | 'permissions' | 'actions'>('info');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, s, r, g] = await Promise.allSettled([
        adminService.getAdminUserById(userId),
        adminService.getUserSessions(userId),
        adminService.getUserRoles(userId),
        adminService.getUserGroups(userId),
      ]);

      if (u.status === 'fulfilled') {
        const userData = u.value;
        // Log created_at / last_login so we can see what backend returns
        console.info('[UserDetailDrawer] User data loaded:', {
          userId,
          username: userData.username,
          created_at: userData.created_at,
          last_login: userData.last_login,
        });
        setUser(userData);
      } else {
        console.error('[UserDetailDrawer] Failed to load user:', { userId, reason: u.reason });
      }
      if (s.status === 'fulfilled') {
        setSessions(s.value);
      } else {
        console.error('[UserDetailDrawer] Failed to load sessions:', { userId, reason: s.reason });
        setSessions([]);
      }
      if (r.status === 'fulfilled') setRoles(r.value);
      else console.error('[UserDetailDrawer] Failed to load roles:', { userId, reason: r.reason });
      if (g.status === 'fulfilled') setGroups(g.value);
      else console.warn('[UserDetailDrawer] Failed to load groups:', { userId, reason: g.reason });
    } catch (err: unknown) {
      console.error('[UserDetailDrawer] Unexpected error loading user details:', { userId, err });
      toast.error(t('userDetail.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, userId]);

  const fetchPermissions = useCallback(async () => {
    console.info('[UserDetailDrawer] Fetching effective permissions:', { userId });
    setPermissionsError(null);
    try {
      const p = await adminService.getUserEffectivePermissions(userId);
      console.info('[UserDetailDrawer] Permissions loaded:', { userId, keys: p ? Object.keys(p) : [] });
      setPermissions(p);
    } catch (err: unknown) {
      console.error('[UserDetailDrawer] Failed to fetch permissions:', { userId, err });
      const axiosErr = err as { response?: { status?: number } };
      setPermissionsError(
        axiosErr?.response?.status === 403
          ? t('userDetail.permissionsAccessDenied')
          : t('userDetail.permissionsLoadError')
      );
      setPermissions({} as EffectivePermissions);
    }
  }, [t, userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (activeTab === 'permissions' && !permissions) {
      fetchPermissions();
    }
  }, [activeTab, permissions, fetchPermissions]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm(t('userDetail.revokeConfirm'))) return;
    try {
      await adminService.revokeSession(sessionId, userId);
      toast.success(t('userDetail.revokeSuccess'));
      // Re-fetch from Keycloak — do not optimistically hide an active session
      const refreshed = await adminService.getUserSessions(userId);
      setSessions(refreshed);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('userDetail.revokeError'));
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('userDetail.copyCopied', { label }));
  };

  /**
   * Reset user password — calls POST /admin/users/reset-password.
   * @param newPassword - The new password to set
   */
  const handleResetPassword = async (newPassword: string) => {
    console.info('[UserDetailDrawer] Resetting password for user:', { userId });
    try {
      await adminService.resetAdminPassword(userId, newPassword);
      toast.success(t('userDetail.resetPassword.success'));
      console.info('[UserDetailDrawer] Password reset successful:', { userId });
    } catch (err: unknown) {
      console.error('[UserDetailDrawer] Password reset failed:', { userId, err });
      const axiosErr = err as { response?: { status?: number; data?: { detail?: unknown; message?: string } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;
      const errorMessage =
        (typeof detail === 'string' ? detail : null) ??
        axiosErr?.response?.data?.message ??
        (axiosErr?.response?.status === 403 ? t('userDetail.errors.insufficientPermissionsSuperAdmin') : null) ??
        (axiosErr?.response?.status === 422 ? t('userDetail.errors.validationPasswordError') : null) ??
        t('userDetail.resetPassword.error');
      toast.error(errorMessage);
    }
  };

  /**
   * Force logout user from all sessions — calls POST /admin/sessions/user/{id}/logout.
   */
  const handleForceLogout = async () => {
    if (!confirm(t('userDetail.forceLogout.confirm'))) return;
    console.info('[UserDetailDrawer] Force logout user:', { userId });
    try {
      await adminService.logoutUser(userId);
      toast.success(t('userDetail.forceLogout.success'));
      console.info('[UserDetailDrawer] Force logout successful:', { userId });
      // Refresh sessions list
      fetchAll();
    } catch (err: unknown) {
      console.error('[UserDetailDrawer] Force logout failed:', { userId, err });
      const axiosErr = err as { response?: { status?: number; data?: { detail?: unknown; message?: string } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;
      const errorMessage =
        (typeof detail === 'string' ? detail : null) ??
        axiosErr?.response?.data?.message ??
        (axiosErr?.response?.status === 403 ? t('userDetail.errors.insufficientPermissions') : null) ??
        t('userDetail.forceLogout.error');
      toast.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center p-6">
        <Loader variant="spinner" size="xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Title as="h5">{t('userDetail.title')}</Title>
          <IconTooltip content={t('common.close')} preset="toolbar">
            <ActionIcon variant="outline" onClick={closeDrawer} className="border-0">
              <PiXBold className="h-5 w-5" />
            </ActionIcon>
          </IconTooltip>
        </div>
        <Text className="text-red-500">{t('userDetail.notFound')}</Text>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-muted px-5 py-4">
        <Title as="h5" className="font-semibold">
          {t('userDetail.title')}
        </Title>
        <IconTooltip content={t('common.close')} preset="toolbar">
          <ActionIcon variant="outline" onClick={closeDrawer} className="border-0 p-0">
            <PiXBold className="h-5 w-5" />
          </ActionIcon>
        </IconTooltip>
      </div>

      {/* User avatar + name */}
      <div className="border-b border-muted px-5 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PiUserBold className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <Title as="h5" className="font-semibold">
              {user.username}
            </Title>
            <Text className="text-sm text-gray-500">{user.email || t('userDetail.noEmail')}</Text>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant="flat"
                color={user.is_active ? 'success' : 'danger'}
                size="sm"
              >
                {user.is_active ? t('common.active') : t('common.inactive')}
              </Badge>
              <Badge variant="flat" color="primary" size="sm" className="capitalize">
                {user.role}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 border-b border-muted bg-gray-50 px-3 py-2 dark:bg-gray-100/50">
        {(['info', 'sessions', 'permissions', 'actions'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'info'
              ? t('userDetail.detailsTab')
              : tab === 'sessions'
                ? t('userDetail.sessionsTab')
                : tab === 'permissions'
                  ? t('userDetail.permissionsTab')
                  : t('userDetail.actionsTab')}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'info' && (
          <InfoTab
            user={user}
            roles={roles}
            groups={groups}
            onCopy={handleCopy}
          />
        )}
        {activeTab === 'sessions' && (
          <SessionsTab
            sessions={sessions}
            onRevoke={handleRevokeSession}
            onRefresh={fetchAll}
          />
        )}
        {activeTab === 'permissions' && (
          <PermissionsTab permissions={permissions} errorMessage={permissionsError} />
        )}
        {activeTab === 'actions' && (
          <ActionsTab
            userId={userId}
            username={user.username}
            onResetPassword={handleResetPassword}
            onForceLogout={handleForceLogout}
          />
        )}
      </div>
    </div>
  );
}

/* ──────────── Info Tab ──────────── */
function InfoTab({
  user,
  roles,
  groups,
  onCopy,
}: {
  user: UserInfo;
  roles: string[];
  groups: any[];
  onCopy: (text: string, label: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* User ID */}
      <InfoRow
        icon={<PiUserBold className="h-4 w-4" />}
        label={t('userDetail.userId')}
        value={
          <div className="flex items-center gap-1.5">
            <Text className="font-mono text-xs">{user.id}</Text>
            <IconTooltip content={t('userDetail.copyId')} preset="toolbar">
              <button
                type="button"
                onClick={() => onCopy(user.id, t('userDetail.userId'))}
                className="text-gray-400 hover:text-gray-600"
              >
                <PiCopyBold className="h-3.5 w-3.5" />
              </button>
            </IconTooltip>
          </div>
        }
      />

      {/* Email */}
      <InfoRow
        icon={<PiEnvelopeBold className="h-4 w-4" />}
        label={t('userDetail.emailLabel')}
        value={user.email || t('userDetail.notSet')}
      />

      {/* Roles */}
      <InfoRow
        icon={<PiShieldCheckBold className="h-4 w-4" />}
        label={t('userDetail.rolesLabel')}
        value={
          roles.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {roles.map((r) => (
                <Badge key={r} variant="flat" color="primary" size="sm" className="capitalize">
                  {r}
                </Badge>
              ))}
            </div>
          ) : (
            <Badge variant="flat" color="primary" size="sm" className="capitalize">
              {user.role}
            </Badge>
          )
        }
      />

      {/* Created */}
      <InfoRow
        icon={<PiCalendarBold className="h-4 w-4" />}
        label={t('userDetail.createdLabel')}
        value={
          user.created_at
            ? new Date(user.created_at).toLocaleString()
            : <span className="text-gray-400">{t('userDetail.notProvided')}</span>
        }
      />

      {/* Last login */}
      <InfoRow
        icon={<PiSignInBold className="h-4 w-4" />}
        label={t('userDetail.lastLoginLabel')}
        value={
          user.last_login
            ? new Date(user.last_login).toLocaleString()
            : <span className="text-gray-400">{t('userDetail.notProvided')}</span>
        }
      />

      {/* Groups */}
      {groups.length > 0 && (
        <div className="mt-4">
          <Text className="mb-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {t('userDetail.groupsLabel')}
          </Text>
          <div className="space-y-1.5">
            {groups.map((g: any) => (
              <div
                key={g.group_id || g.id}
                className="flex items-center justify-between rounded-md border border-muted px-3 py-2"
              >
                <Text className="text-sm font-medium">{g.group_name || g.name || g.group_id}</Text>
                <Badge variant="flat" size="sm" className="capitalize">
                  {g.role_name || g.role || t('userDetail.memberRole')}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-muted px-4 py-3">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <Text className="text-xs font-medium text-gray-500">{label}</Text>
        <div className="mt-0.5 text-sm">{value}</div>
      </div>
    </div>
  );
}

/* ──────────── Sessions Tab ──────────── */
function SessionsTab({
  sessions,
  onRevoke,
  onRefresh,
}: {
  sessions: UserSession[];
  onRevoke: (id: string) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  // Defensive: ensure sessions is always an array even if prop is malformed
  const safeSessions = Array.isArray(sessions) ? sessions : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Text className="text-sm font-semibold">
          {t('userDetail.activeSessions')} ({safeSessions.length})
        </Text>
        <IconTooltip content={t('userDetail.refreshTooltip')} preset="toolbar">
          <ActionIcon variant="outline" size="sm" onClick={onRefresh}>
            <PiArrowsClockwiseBold className="h-4 w-4" />
          </ActionIcon>
        </IconTooltip>
      </div>

      {safeSessions.length === 0 ? (
        <Empty
          text={t('userDetail.noActiveSessions')}
          textClassName="text-sm text-gray-500 mt-2"
        />
      ) : (
        <div className="space-y-3">
          {safeSessions.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-muted p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiDesktopBold className="h-4 w-4 text-gray-400" />
                  <Text className="text-sm font-medium">
                    {parseUserAgent(s.user_agent, t)}
                  </Text>
                </div>
                <IconTooltip content={t('userDetail.revokeSession')} preset="toolbar">
                  <ActionIcon
                    variant="outline"
                    color="danger"
                    size="sm"
                    onClick={() => onRevoke(s.id)}
                  >
                    <PiTrashBold className="h-3.5 w-3.5" />
                  </ActionIcon>
                </IconTooltip>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <PiGlobeBold className="h-3.5 w-3.5" />
                  <span>{s.ip_address || t('userDetail.unknownIp')}</span>
                </div>
                <div>
                  {t('userDetail.startedLabel', {
                    date: s.started_at ? new Date(s.started_at).toLocaleString() : '—',
                  })}
                </div>
                <div>
                  {t('userDetail.lastActiveLabel', {
                    date: s.last_active ? new Date(s.last_active).toLocaleString() : '—',
                  })}
                </div>
                <div>
                  {s.expires_at
                    ? t('userDetail.expiresLabel', {
                        date: new Date(s.expires_at).toLocaleString(),
                      })
                    : t('userDetail.neverExpires')}
                </div>
              </div>

              {s.is_active === false && (
                <Badge variant="flat" color="danger" size="sm">
                  {t('userDetail.expiredBadge')}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function parseUserAgent(
  ua: string | null | undefined,
  t: (key: string) => string
): string {
  if (!ua) return t('userDetail.deviceUnknown');
  if (ua.includes('Chrome')) return t('userDetail.deviceChrome');
  if (ua.includes('Firefox')) return t('userDetail.deviceFirefox');
  if (ua.includes('Safari')) return t('userDetail.deviceSafari');
  if (ua.includes('Edge')) return t('userDetail.deviceEdge');
  if (ua.length > 40) return ua.slice(0, 40) + '...';
  return ua;
}

/* ──────────── Permissions Tab ──────────── */
function PermissionsTab({
  permissions,
  errorMessage,
}: {
  permissions: EffectivePermissions | null;
  errorMessage?: string | null;
}) {
  const { t } = useTranslation();

  if (!permissions) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  // If permissions object is empty (API failed or returned no data)
  const hasAnyData =
    permissions.base_roles?.length > 0 ||
    permissions.global_permissions?.length > 0 ||
    permissions.allowed_sections?.length > 0 ||
    permissions.is_admin ||
    permissions.is_super_admin ||
    (permissions.groups && Object.keys(permissions.groups).length > 0);

  if (!hasAnyData) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-center">
          <PiWarningCircleBold className="mx-auto h-10 w-10 text-gray-300" />
          <Text className="mt-2 text-sm text-gray-500">
            {errorMessage || t('userDetail.permissionsEmpty')}
          </Text>
          {!errorMessage && (
            <Text className="mt-1 text-xs text-gray-400">
              {t('userDetail.permissionsEmptyHint')}
            </Text>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin flags */}
      <div className="flex flex-wrap gap-2">
        {permissions.is_super_admin && (
          <Badge variant="flat" color="danger" size="sm">{t('userDetail.superAdmin')}</Badge>
        )}
        {permissions.is_admin && (
          <Badge variant="flat" color="primary" size="sm">{t('userDetail.admin')}</Badge>
        )}
      </div>

      {/* Base roles */}
      {permissions.base_roles?.length > 0 && (
        <div>
          <Text className="mb-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {t('userDetail.baseRoles')}
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {permissions.base_roles.map((r) => (
              <Badge key={r} variant="flat" color="primary" size="sm" className="capitalize">
                {r}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Global permissions */}
      {permissions.global_permissions?.length > 0 && (
        <div>
          <Text className="mb-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {t('userDetail.permissionsSectionTitle')}
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {permissions.global_permissions.map((p) => (
              <Badge key={p} variant="outline" size="sm" className="text-xs">
                {p}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Allowed sections */}
      {permissions.allowed_sections?.length > 0 && (
        <div>
          <Text className="mb-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {t('userDetail.allowedSectionsTitle')}
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {permissions.allowed_sections.map((s) => (
              <Badge key={s} variant="flat" color="info" size="sm" className="capitalize">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Group permissions */}
      {permissions.groups && Object.keys(permissions.groups).length > 0 && (
        <div>
          <Text className="mb-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {t('userDetail.groupPermissionsTitle')}
          </Text>
          <div className="space-y-2">
            {Object.entries(permissions.groups).map(([gId, g]) => (
              <div
                key={gId}
                className="rounded-md border border-muted p-3"
              >
                <Text className="text-sm font-medium">{g.group_name}</Text>
                <Text className="text-xs text-gray-500 capitalize">
                  {t('userDetail.roleInGroup', { role: g.role })}
                </Text>
                {g.permissions?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {g.permissions.map((p) => (
                      <Badge key={p} variant="outline" size="sm" className="text-xs">
                        {p}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────── Actions Tab ──────────── */

/**
 * ActionsTab — Admin actions for a user: reset password, force logout.
 *
 * - Reset Password: calls POST /admin/users/reset-password
 * - Force Logout: calls POST /admin/sessions/user/{id}/logout
 *
 * @requires adminService.resetAdminPassword
 * @requires adminService.logoutUser
 */
function ActionsTab({
  userId,
  username,
  onResetPassword,
  onForceLogout,
}: {
  userId: string;
  username: string;
  onResetPassword: (newPassword: string) => Promise<void>;
  onForceLogout: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      toast.error(t('userDetail.resetPassword.emptyError'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('userDetail.resetPassword.minLengthError'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('userDetail.resetPassword.mismatchError'));
      return;
    }
    setResetting(true);
    try {
      await onResetPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setResetting(false);
    }
  };

  const handleForceLogout = async () => {
    setLoggingOut(true);
    try {
      await onForceLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <form
      className="space-y-6"
      autoComplete="off"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Reset Password Section */}
      <div className="rounded-lg border border-muted p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-content-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30">
            <PiKeyBold className="h-5 w-5" />
          </div>
          <div>
            <Title as="h6" className="text-sm font-semibold">
              {t('userDetail.resetPassword.title')}
            </Title>
            <Text className="text-xs text-gray-500">
              {t('userDetail.resetPassword.description')} <strong>{username}</strong>
            </Text>
          </div>
        </div>

        <div className="space-y-3">
          <Password
            name="user-reset-new-password"
            autoComplete="new-password"
            placeholder={t('userDetail.resetPassword.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            size="sm"
          />
          <Password
            name="user-reset-confirm-password"
            autoComplete="new-password"
            placeholder={t('userDetail.resetPassword.confirmPlaceholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            size="sm"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleResetPassword}
            isLoading={resetting}
            disabled={!newPassword.trim() || !confirmPassword.trim()}
            className="w-full"
          >
            {t('userDetail.resetPassword.button')}
          </Button>
        </div>
      </div>

      {/* Force Logout Section */}
      <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50/30 p-4 dark:border-orange-800 dark:bg-orange-950/10">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-content-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/30">
            <PiSignOutBold className="h-5 w-5" />
          </div>
          <div>
            <Title as="h6" className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              {t('userDetail.forceLogout.title')}
            </Title>
            <Text className="text-xs text-orange-600 dark:text-orange-400">
              {t('userDetail.forceLogout.description')} <strong>{username}</strong>
            </Text>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          color="danger"
          onClick={handleForceLogout}
          isLoading={loggingOut}
          className="w-full"
        >
          <PiSignOutBold className="me-2 h-4 w-4" />
          {t('userDetail.forceLogout.button')}
        </Button>
      </div>
    </form>
  );
}
