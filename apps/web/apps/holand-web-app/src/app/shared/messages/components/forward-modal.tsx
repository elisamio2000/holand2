'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Text, Title } from 'rizzui';
import { PiShareFatBold, PiXBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import type { MessageItem, UserSummary } from '@/types/messages.types';
import RecipientSearchInput from './recipient-search-input';

interface ForwardModalProps {
  isOpen: boolean;
  message: MessageItem | null;
  onClose: () => void;
  onForward?: (recipientId: string, message: MessageItem) => Promise<void>;
}

export default function ForwardModal({ isOpen, message, onClose, onForward }: ForwardModalProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [recipients, setRecipients] = useState<UserSummary[]>([]);
  const [sending, setSending] = useState(false);

  const handleForward = async () => {
    if (!message || recipients.length === 0) {
      toast.error(t('messages.forward.noRecipient', 'Select a recipient'));
      return;
    }

    setSending(true);
    try {
      if (onForward) {
        await onForward(recipients[0].id, message);
      }
      toast.success(t('messages.forward.sent', 'Message forwarded'));
      setRecipients([]);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.forward.failed', 'Forward failed'));
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setRecipients([]);
    onClose();
  };

  if (!message) return null;

  const preview = 'body' in message && message.body ? message.body : message.preview;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiShareFatBold className="h-5 w-5 text-primary" />
            <Title as="h4" className="text-base font-semibold">
              {t('messages.forward.title', 'Forward message')}
            </Title>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            <PiXBold className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-muted bg-gray-50 p-3 dark:bg-gray-100">
          <Text className="text-xs font-medium text-gray-500">{message.from.name}</Text>
          <div
            className="mt-1 line-clamp-3 text-sm text-gray-700 dark:text-gray-300"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>

        <RecipientSearchInput
          id="forward-to"
          label={t('messages.forward.to', 'Forward to')}
          value={recipients}
          onChange={setRecipients}
          single
          currentUserId={session?.user?.id}
          className="mb-4"
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="solid" onClick={handleForward} isLoading={sending}>
            {t('messages.forward.send', 'Forward')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
