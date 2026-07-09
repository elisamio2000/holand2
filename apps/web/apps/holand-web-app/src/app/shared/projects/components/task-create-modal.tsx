'use client';

import { useState } from 'react';
import { Button, Input, Select, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { useModal } from '@/app/shared/modal-views/use-modal';
import type { CreateTaskRequest, TaskPriority } from '@/types/projects.types';

interface Props {
  projectId?: string | null;
  personal?: boolean;
  onCreate: (request: CreateTaskRequest) => Promise<void | unknown>;
}

const priorityOptions = [
  { label: 'Urgent', value: 'urgent' },
  { label: 'High', value: 'high' },
  { label: 'Normal', value: 'normal' },
  { label: 'Low', value: 'low' },
];

export default function TaskCreateModal({ projectId, personal, onCreate }: Props) {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        project_id: personal ? null : projectId ?? null,
        is_personal: personal,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <Title as="h4" className="mb-4 text-lg font-semibold">
        {t('projects.tasks.create')}
      </Title>
      <div className="space-y-4">
        <Input
          label={t('common.name')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Select
          label={t('common.priority')}
          options={priorityOptions}
          value={priority}
          onChange={(v: { value: TaskPriority }) => setPriority(v.value)}
        />
        <Input
          type="date"
          label={t('common.date')}
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={closeModal}>
            {t('common.cancel')}
          </Button>
          <Button variant="solid" onClick={() => void handleSubmit()} disabled={saving || !title.trim()}>
            {t('common.create')}
          </Button>
        </div>
      </div>
    </div>
  );
}
