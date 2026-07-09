'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiX } from 'react-icons/pi';
import { Button, Input, Textarea, Title } from 'rizzui';
import type { ChatProject } from '@/types/chat.types';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  project: ChatProject | null;
  onClose: () => void;
  onSave: (patch: Partial<ChatProject> & { name: string }) => Promise<void>;
  isCreate?: boolean;
}

export default function ProjectSettingsModal({
  isOpen,
  project,
  onClose,
  onSave,
  isCreate = false,
}: ProjectSettingsModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [systemRules, setSystemRules] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(project?.name ?? '');
      setSystemRules(project?.system_rules ?? '');
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSave({ name: name.trim(), system_rules: systemRules.trim() || undefined });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-muted bg-gray-0 p-5 shadow-xl dark:bg-gray-50"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <Title as="h3" className="text-base">
            {isCreate ? t('chatSidebar.newProject') : t('chatSidebar.projectSettings')}
          </Title>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400">
            <PiX className="h-5 w-5" />
          </button>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('chatSidebar.projectNamePlaceholder')}
          className="mb-3"
          autoFocus
        />
        <Textarea
          value={systemRules}
          onChange={(e) => setSystemRules(e.target.value)}
          placeholder={t('chatSidebar.projectRulesPlaceholder')}
          rows={4}
          className="mb-4"
        />
        <p className="mb-4 text-xs text-gray-500">{t('chatSidebar.projectKnowledgeHint')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} isLoading={isSaving} disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
