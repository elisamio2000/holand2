'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Text } from 'rizzui';
import { PiFolderOpenBold } from 'react-icons/pi';
import { storageService } from '@/services/storage.service';
import { getFileIconByExtension } from '@/utils/file-icons';
import type { Artifact } from '@/types/storage.types';

type AttachmentPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (artifact: {
    artifactId: string;
    name: string;
    mime_type: string;
    size: number;
  }) => void;
};

export default function AttachmentPicker({
  isOpen,
  onClose,
  onSelect,
}: AttachmentPickerProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await storageService.listFilesForExplorer({
        page: 1,
        page_size: 30,
        sort_by: 'created_at',
        sort_dir: 'desc',
      });
      setItems(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.attachments.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) loadLibrary();
  }, [isOpen, loadLibrary]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" className="z-[9998]">
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <PiFolderOpenBold className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('messages.attachments.fromLibrary')}
          </h3>
        </div>

        {loading && (
          <Text className="py-8 text-center text-sm text-gray-500">
            {t('common.loading', 'Loading…')}
          </Text>
        )}

        {error && (
          <div className="py-6 text-center">
            <Text className="text-sm text-red-500">{error}</Text>
            <Button size="sm" variant="outline" className="mt-3" onClick={loadLibrary}>
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <Text className="py-8 text-center text-sm text-gray-500">
            {t('messages.attachments.emptyLibrary')}
          </Text>
        )}

        <div className="max-h-[360px] space-y-1 overflow-y-auto">
          {items.map((item) => {
            const id = item.id;
            const name = item.filename ?? id;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  onSelect({
                    artifactId: id,
                    name,
                    mime_type: item.mime_type ?? 'application/octet-stream',
                    size: Number(item.file_size ?? 0),
                  })
                }
                className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-muted hover:bg-gray-50 dark:hover:bg-gray-100"
              >
                <span className="[&>svg]:h-8 [&>svg]:w-8">
                  {getFileIconByExtension(name, 'h-8 w-8')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {name}
                  </p>
                  <p className="text-xs text-gray-500">{item.mime_type}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
