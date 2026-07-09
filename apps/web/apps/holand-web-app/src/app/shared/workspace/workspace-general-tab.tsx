'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Input, Switch, Text, Textarea, Title } from 'rizzui';
import { PiArrowRightBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import { workspaceService } from '@/services/workspace.service';
import type { GroupResponse } from '@/types/auth.types';
import WorkspaceVisualIdentityPanel from '@/app/shared/workspace/components/workspace-visual-identity-panel';
import WorkspaceSettingsStickyFooter from '@/app/shared/workspace/components/workspace-settings-sticky-footer';

interface WorkspaceGeneralTabProps {
  workspaceId: string;
  initial?: GroupResponse | null;
  onSaved?: (group: GroupResponse) => void;
}

export default function WorkspaceGeneralTab({
  workspaceId,
  initial,
  onSaved,
}: WorkspaceGeneralTabProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const markDirty = () => setDirty(true);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('workspace.createNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const updated = await workspaceService.updateWorkspace(workspaceId, {
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive,
      });
      toast.success(t('workspace.general.saved'));
      onSaved?.(updated);
      setDirty(false);
    } catch {
      toast.error(t('workspace.general.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setIsActive(initial?.is_active ?? true);
    setDirty(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 @3xl:grid-cols-2 @3xl:items-start">
        <div className="rounded-lg border border-muted bg-gray-50/50 p-5 dark:bg-gray-100/30">
          <Title as="h5" className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-700">
            {t('workspace.general.detailsTitle')}
          </Title>
          <Text className="mb-4 text-xs text-gray-500">{t('workspace.general.detailsHint')}</Text>
          <div className="space-y-4">
            <Input
              label={t('workspace.general.name')}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
            />
            <Textarea
              label={t('workspace.general.description')}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
              rows={4}
            />
            <div className="flex items-center justify-between rounded-lg border border-muted bg-gray-0 p-3 dark:bg-gray-50">
              <div>
                <Text className="text-sm font-medium">{t('workspace.general.active')}</Text>
                <Text className="text-xs text-gray-500">{t('workspace.general.activeHint')}</Text>
              </div>
              <Switch
                checked={isActive}
                onChange={(e) => {
                  setIsActive(e.target.checked);
                  markDirty();
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <WorkspaceVisualIdentityPanel workspaceId={workspaceId} />
          <Link
            href={routes.workspace.settings(workspaceId, 'appearance')}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t('workspace.general.seeAppearanceHint')}
            <PiArrowRightBold className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>
      </div>

      <WorkspaceSettingsStickyFooter
        hint={dirty ? t('workspace.general.unsavedChanges') : t('workspace.general.allSaved')}
        dirty={dirty}
        saving={saving}
        cancelLabel={t('common.cancel')}
        saveLabel={t('workspace.general.save')}
        onCancel={handleReset}
        onSave={() => void handleSave()}
      />
    </div>
  );
}
