'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Button, Loader, Modal, Text, Title } from 'rizzui';
import { PiWarningBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '@/contexts/workspace-context';
import { workspaceService } from '@/services/workspace.service';
import { isWorkspaceAdminRole } from '@/lib/workspace-group-id';
import type { MembershipResponse } from '@/types/auth.types';

interface LeaveWorkspaceDialogProps {
  workspaceId: string;
  workspaceName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function LeaveWorkspaceDialog({
  workspaceId,
  workspaceName,
  isOpen,
  onClose,
}: LeaveWorkspaceDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session, update } = useSession();
  const { activeWorkspace, clearWorkspace } = useWorkspace();
  const [leaving, setLeaving] = useState(false);
  const [members, setMembers] = useState<MembershipResponse[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const sessionUserId = (session?.user as { id?: string })?.id;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingMembers(true);
    workspaceService
      .listMembers(workspaceId)
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch(() => {
        if (!cancelled) setMembers(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, workspaceId]);

  // Guard against orphaning a workspace: if the person leaving is the only
  // admin/owner, block it instead of relying on role === 'owner' (which the
  // backend may never actually assign — see workspace-requirements.md).
  const isSoleAdmin = useMemo(() => {
    if (!members) return false;
    const self = members.find(
      (m) => m.user_id === sessionUserId || workspaceService.isMockCurrentUser(m.user_id)
    );
    if (!self || !isWorkspaceAdminRole(self.role_name)) return false;
    const adminCount = members.filter((m) => isWorkspaceAdminRole(m.role_name)).length;
    return adminCount <= 1;
  }, [members, sessionUserId]);

  const handleLeave = async () => {
    if (isSoleAdmin) return;
    setLeaving(true);
    try {
      await workspaceService.leaveWorkspace(workspaceId);
      if (activeWorkspace?.id === workspaceId) {
        clearWorkspace();
      }
      await update();
      toast.success(t('workspace.leave.success'));
      onClose();
      router.push('/');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response
          ?.data?.detail ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(detail || t('workspace.leave.error'));
    } finally {
      setLeaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="p-6">
        <Title as="h3" className="mb-2 text-lg font-semibold">
          {t('workspace.leave.title')}
        </Title>

        {loadingMembers ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader variant="spinner" size="sm" />
            {t('workspace.leave.checking')}
          </div>
        ) : isSoleAdmin ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
            <PiWarningBold className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <Text className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t('workspace.leave.soleAdminTitle')}
              </Text>
              <Text className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {t('workspace.leave.soleAdminHint')}
              </Text>
            </div>
          </div>
        ) : (
          <Text className="text-sm text-gray-600">
            {t('workspace.leave.confirm', { name: workspaceName })}
          </Text>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {isSoleAdmin ? t('common.close') : t('common.cancel')}
          </Button>
          {!isSoleAdmin && (
            <Button
              color="danger"
              onClick={handleLeave}
              isLoading={leaving}
              disabled={loadingMembers}
            >
              {t('workspace.leave.action')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
