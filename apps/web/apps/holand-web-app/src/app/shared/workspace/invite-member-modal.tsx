'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Select, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { PiCopyBold } from 'react-icons/pi';
import { workspaceService } from '@/services/workspace.service';
import {
  WORKSPACE_ROLE_OPTIONS,
  type WorkspaceAssignableRole,
} from '@/app/shared/workspace/config/workspace-roles';

interface InviteMemberModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}

export default function InviteMemberModal({
  workspaceId,
  isOpen,
  onClose,
  onSent,
}: InviteMemberModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceAssignableRole>('user');
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const roleOptions = useMemo(
    () => WORKSPACE_ROLE_OPTIONS.map((r) => ({ value: r.value, label: t(r.labelKey) })),
    [t]
  );
  const roleDescriptionKey = WORKSPACE_ROLE_OPTIONS.find((r) => r.value === role)?.descriptionKey;

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      toast.error(t('workspace.invite.invalidEmail'));
      return;
    }
    setSubmitting(true);
    try {
      const invite = await workspaceService.inviteMember(workspaceId, {
        email: trimmed,
        role_name: role,
      });
      const link = invite.invite_url ?? workspaceService.getInviteLink(workspaceId, invite.id);
      if (link) setInviteLink(link);
      toast.success(t('workspace.invite.sent'));
      setEmail('');
      onSent?.();
      if (!link) onClose();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response
          ?.data?.detail ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(detail || t('workspace.invite.sendError'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t('workspace.invite.linkCopied'));
    } catch {
      toast.error(t('workspace.invite.copyError'));
    }
  };

  const handleClose = () => {
    setInviteLink(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="p-6">
        <Title as="h3" className="mb-1 text-lg font-semibold">
          {t('workspace.invite.title')}
        </Title>
        <Text className="mb-4 text-sm text-gray-500">{t('workspace.invite.subtitle')}</Text>

        <div className="space-y-4">
          <Input
            type="email"
            label={t('workspace.invite.email')}
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div>
            <Select
              label={t('groupDetail.roleHeader')}
              options={roleOptions}
              value={roleOptions.find((r) => r.value === role)}
              onChange={(opt: { value?: WorkspaceAssignableRole } | null) =>
                setRole(opt?.value || 'user')
              }
            />
            {roleDescriptionKey && (
              <Text className="mt-1 text-xs text-gray-500">{t(roleDescriptionKey)}</Text>
            )}
          </div>
        </div>

        {inviteLink && (
          <div className="mt-4 rounded-lg border border-muted bg-gray-50 p-3 dark:bg-gray-100/40">
            <Text className="mb-2 text-xs text-gray-500">{t('workspace.invite.copyLinkHint')}</Text>
            <div className="flex items-center gap-2">
              <Input value={inviteLink} readOnly className="flex-1 font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={copyLink}>
                <PiCopyBold className="me-1 h-4 w-4" />
                {t('workspace.invite.copyLink')}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {inviteLink ? t('common.close') : t('common.cancel')}
          </Button>
          {!inviteLink && (
          <Button onClick={handleSend} isLoading={submitting}>
            {t('workspace.invite.send')}
          </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
