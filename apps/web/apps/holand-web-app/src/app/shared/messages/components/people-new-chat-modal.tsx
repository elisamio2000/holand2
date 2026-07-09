'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Title } from 'rizzui';
import { PiChatCircleTextBold, PiUsersThreeBold, PiXBold } from 'react-icons/pi';
import type { UserSummary } from '@/types/messages.types';
import RecipientSearchInput from './recipient-search-input';

type PeopleNewChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: UserSummary) => void;
  onCreateGroup?: (users: UserSummary[], conversationId: string) => void;
};

export default function PeopleNewChatModal({
  isOpen,
  onClose,
  onSelectUser,
  onCreateGroup,
}: PeopleNewChatModalProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [selected, setSelected] = useState<UserSummary[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const isGroup = selected.length >= 2;

  const handleStart = async () => {
    if (selected.length === 0) return;

    if (isGroup && onCreateGroup) {
      setIsCreating(true);
      try {
        const { userChatService } = await import('@/services/user-chat.service');
        const memberIds = selected.map((u) => u.id);
        const result = await userChatService.createGroupConversation(
          memberIds,
          t('messages.lens.people.groupDefaultSubject', 'Group chat')
        );
        if (result.conversationId) {
          onCreateGroup(selected, result.conversationId);
        }
        setSelected([]);
        onClose();
      } catch (error) {
        console.error('[PeopleNewChatModal] Group create failed:', error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    onSelectUser(selected[0]);
    setSelected([]);
    onClose();
  };

  const handleClose = () => {
    setSelected([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isGroup ? (
              <PiUsersThreeBold className="h-5 w-5 text-teal-500" />
            ) : (
              <PiChatCircleTextBold className="h-5 w-5 text-teal-500" />
            )}
            <Title as="h4" className="text-base font-semibold">
              {isGroup
                ? t('messages.lens.people.newGroupChat', 'New group chat')
                : t('messages.lens.people.newChat')}
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

        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {isGroup
            ? t(
                'messages.lens.people.newGroupChatHint',
                'Select 2 or more users to create a group conversation'
              )
            : t('messages.lens.people.newChatHint')}
        </p>

        <RecipientSearchInput
          id="people-new-chat"
          label={t('messages.compose.to')}
          value={selected}
          onChange={setSelected}
          currentUserId={session?.user?.id}
          placeholder={t('messages.lens.people.searchUsersPlaceholder')}
          className="mb-4"
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="solid"
            onClick={handleStart}
            disabled={selected.length === 0 || isCreating}
            isLoading={isCreating}
            className="bg-teal-500 hover:bg-teal-600 border-teal-500"
          >
            {isGroup
              ? t('messages.lens.people.startGroupChat', 'Create group')
              : t('messages.lens.people.startChat')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
