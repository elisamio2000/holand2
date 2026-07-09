'use client';

import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiPencilSimpleBold, PiTrashBold } from 'react-icons/pi';
import {
  getWorkspaceBranding,
  isValidWorkspaceAvatarFile,
  setWorkspaceBranding,
  WORKSPACE_AVATAR_ACCEPT,
  type WorkspaceBranding,
} from '@/lib/workspace-branding';
import { WORKSPACE_ICON_CATALOG } from '@/lib/workspace-icon-catalog';
import WorkspaceAvatar from '@/app/shared/workspace/components/workspace-avatar';
import { workspaceService } from '@/services/workspace.service';

interface WorkspaceVisualIdentityPanelProps {
  workspaceId: string;
}

export default function WorkspaceVisualIdentityPanel({
  workspaceId,
}: WorkspaceVisualIdentityPanelProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<WorkspaceBranding>(() =>
    getWorkspaceBranding(workspaceId)
  );
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(() => {
    setBranding(getWorkspaceBranding(workspaceId));
  }, [workspaceId]);

  const saveIcon = (iconKey: string) => {
    const next = setWorkspaceBranding(workspaceId, {
      iconKey,
      avatarKind: 'icon',
      imageUrl: null,
    });
    setBranding(next);
    void workspaceService.saveWorkspaceBranding(workspaceId, next);
    toast.success(t('workspace.branding.saved'));
  };

  const handleUpload = async (file: File) => {
    if (!isValidWorkspaceAvatarFile(file)) {
      toast.error(t('workspace.branding.uploadInvalid'));
      return;
    }
    setUploading(true);
    try {
      await workspaceService.uploadWorkspaceAvatar(workspaceId, file);
      refresh();
      toast.success(t('workspace.branding.uploadSuccess'));
    } catch {
      toast.error(t('workspace.branding.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    setUploading(true);
    try {
      await workspaceService.deleteWorkspaceAvatar(workspaceId);
      refresh();
      toast.success(t('workspace.branding.imageRemoved'));
    } catch {
      toast.error(t('workspace.branding.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const showImage = branding.avatarKind === 'image' && branding.imageUrl;

  return (
    <div className="rounded-lg border border-muted bg-gray-50/50 p-5 dark:bg-gray-100/30">
      <Title as="h5" className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-700">
        {t('workspace.branding.title')}
      </Title>
      <Text className="mb-4 text-xs text-gray-500">{t('workspace.branding.hint')}</Text>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="relative">
          {showImage ? (
            <span className="relative block h-20 w-20 overflow-hidden rounded-full border-2 border-primary/30">
              <Image
                src={branding.imageUrl!}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </span>
          ) : (
            <WorkspaceAvatar workspaceId={workspaceId} size="lg" className="!h-20 !w-20" />
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -end-1 flex h-8 w-8 items-center justify-center rounded-full border border-muted bg-white shadow-sm hover:bg-gray-50 dark:bg-gray-50"
            aria-label={t('workspace.branding.uploadPhoto')}
          >
            <PiPencilSimpleBold className="h-4 w-4 text-primary" />
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Text className="text-xs text-gray-500">{t('workspace.branding.avatarHint')}</Text>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              isLoading={uploading}
            >
              {t('workspace.branding.uploadPhoto')}
            </Button>
            {showImage && (
              <Button
                size="sm"
                variant="outline"
                color="danger"
                onClick={handleRemoveImage}
                disabled={uploading}
              >
                <PiTrashBold className="me-1 h-3.5 w-3.5" />
                {t('workspace.branding.removePhoto')}
              </Button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={WORKSPACE_AVATAR_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = '';
          }}
        />
      </div>

      <Text className="mb-2 text-xs font-medium text-gray-600">
        {t('workspace.branding.iconPresets')}
      </Text>
      <div className="flex flex-wrap gap-2">
        {WORKSPACE_ICON_CATALOG.map(({ key, Icon, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => saveIcon(key)}
            title={t(labelKey)}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:bg-gray-50',
              branding.iconKey === key && branding.avatarKind === 'icon'
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                : 'border-muted'
            )}
          >
            <Icon className="h-5 w-5 text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
