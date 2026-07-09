'use client';

import { useState } from 'react';
import { Button, Input, Textarea, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useModal } from '@/app/shared/modal-views/use-modal';
import type { CreateProjectRequest } from '@/types/projects.types';

interface Props {
  onCreate: (request: CreateProjectRequest) => Promise<void | unknown>;
}

export default function ProjectCreateModal({ onCreate }: Props) {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() || undefined });
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <Title as="h4" className="mb-4 text-lg font-semibold">
        {t('projects.feed.createNew')}
      </Title>
      <div className="space-y-4">
        <Input
          label={t('common.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('projects.create.namePlaceholder')}
        />
        <Textarea
          label={t('projects.create.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={closeModal}>
            {t('common.cancel')}
          </Button>
          <Button variant="solid" onClick={() => void handleSubmit()} disabled={saving || !name.trim()}>
            {t('common.create')}
          </Button>
        </div>
      </div>
    </div>
  );
}
