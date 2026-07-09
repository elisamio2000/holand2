'use client';

import { Button, Modal, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}

/**
 * ConfirmDeleteModal — Shared styled delete confirmation (replaces native confirm()).
 */
export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading = false,
}: ConfirmDeleteModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => undefined : onClose} size="sm">
      <div className="p-6">
        <Title as="h4" className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-700">
          {title}
        </Title>
        <Text className="text-sm text-gray-600 dark:text-gray-400">{message}</Text>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button color="danger" onClick={onConfirm} isLoading={loading}>
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
