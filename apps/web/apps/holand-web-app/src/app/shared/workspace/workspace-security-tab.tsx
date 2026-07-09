'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Switch, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { workspaceService } from '@/services/workspace.service';

interface WorkspaceSecurityTabProps {
  workspaceId: string;
}

export default function WorkspaceSecurityTab({ workspaceId }: WorkspaceSecurityTabProps) {
  const { t } = useTranslation();
  const [allowMemberInvite, setAllowMemberInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await workspaceService.getSecuritySettings(workspaceId);
        if (!cancelled) setAllowMemberInvite(settings.allow_member_invite ?? false);
      } catch {
        /* keep default */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await workspaceService.updateSecuritySettings(workspaceId, {
        allow_member_invite: allowMemberInvite,
      });
      toast.success(t('workspace.security.saved'));
    } catch {
      toast.error(t('workspace.security.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      {loading ? null : (
        <>
      <div className="flex items-center justify-between rounded-lg border border-muted p-3">
        <div>
          <Text className="text-sm font-medium">{t('workspace.security.memberInvite')}</Text>
          <Text className="text-xs text-gray-500">{t('workspace.security.memberInviteHint')}</Text>
        </div>
        <Switch
          checked={allowMemberInvite}
          onChange={(e) => setAllowMemberInvite(e.target.checked)}
        />
      </div>
      <Button onClick={handleSave} isLoading={saving}>
        {t('workspace.general.save')}
      </Button>
        </>
      )}
    </div>
  );
}
