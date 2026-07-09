'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { PiX } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { Button, Input, Title } from 'rizzui';
import {
  AppColorPickerCompact,
  CHAT_FOLDER_COLOR_PRESETS,
} from '@/app/shared/color-picker';

interface FolderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; color?: string }) => Promise<void>;
  initialName?: string;
  initialColor?: string;
  titleKey?: string;
}

export default function FolderCreateModal({
  isOpen,
  onClose,
  onSubmit,
  initialName = '',
  initialColor = CHAT_FOLDER_COLOR_PRESETS[0],
  titleKey = 'chatSidebar.newFolder',
}: FolderCreateModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setColor(initialColor);
    }
  }, [isOpen, initialName, initialColor]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSubmit({ name: name.trim(), color });
      setName('');
      onClose();
    } catch (error) {
      console.error('[FolderCreateModal]', error);
      toast.error(t('chatSidebar.folderCreateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-muted bg-gray-0 p-5 shadow-2xl dark:bg-gray-50"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <Title as="h3" className="text-base">
            {t(titleKey)}
          </Title>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-600"
            aria-label={t('common.close')}
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('chatSidebar.folderNamePlaceholder')}
          className="mb-3"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
          }}
        />
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('chatSidebar.folderColor')}
          </p>
          <AppColorPickerCompact
            value={color}
            onChange={setColor}
            presets={CHAT_FOLDER_COLOR_PRESETS}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isSaving} disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
