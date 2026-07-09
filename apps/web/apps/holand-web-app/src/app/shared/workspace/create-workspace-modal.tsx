'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Text, Textarea, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import { useWorkspace } from '@/contexts/workspace-context';
import { workspaceService } from '@/services/workspace.service';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { update } = useSession();
  const { setActiveWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t('workspace.createNameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const group = await workspaceService.createWorkspace({
        name: trimmed,
        description: description.trim() || null,
      });
      toast.success(t('workspace.createdSuccess'));
      setActiveWorkspace(group.id);
      await update();
      onClose();
      setName('');
      setDescription('');
      router.push(routes.workspace.hub(group.id));
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response
          ?.data?.detail ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(detail || t('workspace.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6">
        <Title as="h3" className="mb-1 text-lg font-semibold">
          {t('workspace.create')}
        </Title>
        <Text className="mb-4 text-sm text-gray-500">{t('workspace.createSubtitle')}</Text>

        <div className="space-y-4">
          <Input
            label={t('workspace.general.name')}
            placeholder={t('workspace.general.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            label={t('workspace.general.description')}
            placeholder={t('workspace.general.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            {t('workspace.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
