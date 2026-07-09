'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Loader, Text } from 'rizzui';
import { PiCopyBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { workspaceService } from '@/services/workspace.service';
import { workspaceRoleLabelKey } from '@/app/shared/workspace/config/workspace-roles';
import UserAvatar from '@/components/user-avatar';
import type { WorkspaceInviteResponse } from '@/types/workspace.types';

interface PendingInvitesTableProps {
  workspaceId: string;
  refreshKey?: number;
}

export default function PendingInvitesTable({
  workspaceId,
  refreshKey = 0,
}: PendingInvitesTableProps) {
  const { t } = useTranslation();
  const [invites, setInvites] = useState<WorkspaceInviteResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workspaceService.listInvites(workspaceId);
      setInvites(data.filter((i) => i.status === 'pending'));
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleCancel = async (inviteId: string) => {
    try {
      await workspaceService.cancelInvite(workspaceId, inviteId);
      toast.success(t('workspace.invite.cancelled'));
      load();
    } catch {
      toast.error(t('workspace.invite.cancelError'));
    }
  };

  const handleCopyLink = async (inviteId: string) => {
    const link = workspaceService.getInviteLink(workspaceId, inviteId);
    if (!link) {
      toast.error(t('workspace.invite.copyError'));
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('workspace.invite.linkCopied'));
    } catch {
      toast.error(t('workspace.invite.copyError'));
    }
  };

  const handleResend = async (inviteId: string) => {
    try {
      await workspaceService.resendInvite(workspaceId, inviteId);
      toast.success(t('workspace.invite.resent'));
    } catch {
      toast.error(t('workspace.invite.resendError'));
    }
  };

  if (loading) return <Loader variant="spinner" className="my-4" />;

  if (invites.length === 0) {
    return (
      <Text className="text-sm text-gray-500">{t('workspace.invite.noPending')}</Text>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-muted">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-200/70">
          <tr>
            <th className="px-3 py-2 text-start">{t('workspace.invite.email')}</th>
            <th className="px-3 py-2 text-start">{t('groupDetail.roleHeader')}</th>
            <th className="px-3 py-2 text-end">{t('groupDetail.actionHeader')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted">
          {invites.map((inv) => (
            <tr key={inv.id}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <UserAvatar
                    avatarUrl={null}
                    fallbackSeed={inv.email}
                    name={inv.email}
                    className="!h-6 !w-6 shrink-0"
                  />
                  <span className="truncate">{inv.email}</span>
                </div>
              </td>
              <td className="px-3 py-2 capitalize">
                {(() => {
                  const key = workspaceRoleLabelKey(inv.role_name);
                  return key ? t(key) : inv.role_name;
                })()}
              </td>
              <td className="px-3 py-2 text-end">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => handleCopyLink(inv.id)}>
                    <PiCopyBold className="me-1 h-3.5 w-3.5" />
                    {t('workspace.invite.copyLink')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleResend(inv.id)}>
                    {t('workspace.invite.resend')}
                  </Button>
                  <Button size="sm" variant="outline" color="danger" onClick={() => handleCancel(inv.id)}>
                    {t('workspace.invite.cancel')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
