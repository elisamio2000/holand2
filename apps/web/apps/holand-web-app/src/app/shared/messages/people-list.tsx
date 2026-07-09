'use client';

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Avatar, Text } from 'rizzui';
import { PiChatCircleTextBold, PiPencilSimpleLineBold, PiPushPinFill } from 'react-icons/pi';
import { routes } from '@/config/routes';
import cn from '@core/utils/class-names';
import { getRelativeTime } from '@core/utils/get-relative-time';
import type { PeopleConversation } from '@/types/messages.types';
import { messagesService } from '@/services/messages.service';
import {
  resolveDisplayName,
  useMessengerUserDirectory,
} from '@/hooks/use-messenger-user-directory';
import PresenceBadge, { mockPresenceFromUserId } from './components/presence-badge';
import UnreadBadge from './components/unread-badge';
import SwipeableChatItem from './components/swipeable-chat-item';
import { peopleTheme } from './themes/people-theme';

type PeopleListProps = {
  conversations: PeopleConversation[];
  loading: boolean;
  selectedPartnerId: string | null;
  typingPartnerId?: string | null;
  onSelect: (messageId: string, partnerId: string) => void;
};

export default function PeopleList({
  conversations,
  loading,
  selectedPartnerId,
  typingPartnerId,
  onSelect,
}: PeopleListProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = peopleTheme;

  const handleTogglePin = useCallback(async (conv: PeopleConversation) => {
    const nextPinned = !conv.pinned;
    if (conv.conversationId) {
      await messagesService
        .updateConversation({ conversation_id: conv.conversationId, pinned: nextPinned })
        .catch(() => undefined);
    }
  }, []);

  const partnerIds = useMemo(
    () => conversations.map((c) => c.partner.id),
    [conversations]
  );
  const directory = useMessengerUserDirectory(partnerIds);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex animate-pulse gap-3 rounded-2xl p-3">
            <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-8 w-full rounded-2xl bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <PiChatCircleTextBold className="mb-3 h-10 w-10 text-teal-300 dark:text-teal-700" />
        <Text className="text-sm text-gray-500">{t('messages.empty.people')}</Text>
      </div>
    );
  }

  return (
    <>
      {conversations.map((conv) => {
        const active = selectedPartnerId === conv.partner.id;
        const msg = conv.lastMessage;
        const partnerName = resolveDisplayName(conv.partner, directory);
        const presence = mockPresenceFromUserId(conv.partner.id);
        const isTyping = typingPartnerId === conv.partner.id;
        const pinned = conv.pinned;

        return (
          <SwipeableChatItem
            key={conv.partner.id}
            onPin={() => void handleTogglePin(conv)}
            isPinned={pinned}
          >
            <div
              className={cn(
                'flex w-full items-start gap-3 px-3 py-3 transition-colors sm:px-4',
                active ? theme.activeRowClass : theme.activeRowHover,
                'border-b border-teal-500/10 last:border-0'
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(conv.threadRootId, conv.partner.id)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                <div className="relative shrink-0">
                  <Avatar name={partnerName} src={conv.partner.avatar} size="md" />
                  <PresenceBadge
                    status={presence}
                    size="md"
                    className="bottom-0 end-0"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {partnerName}
                      </span>
                      {pinned && (
                        <PiPushPinFill className="h-3 w-3 shrink-0 text-amber-500" />
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {getRelativeTime(new Date(msg.created_at))}
                    </span>
                  </div>

                  {isTyping ? (
                    <p className="mt-1 text-xs italic text-teal-600 dark:text-teal-400">
                      {t('messages.lens.people.typing')}
                    </p>
                  ) : (
                    <div
                      className={cn(
                        'mt-1.5 max-w-[95%] rounded-2xl rounded-tl-sm border px-3 py-2 text-xs leading-relaxed',
                        'border-teal-500/15 bg-white text-gray-600 shadow-sm dark:bg-gray-100 dark:text-gray-500'
                      )}
                    >
                      <span className="line-clamp-2">
                        {msg.preview || msg.subject || '—'}
                      </span>
                    </div>
                  )}
                </div>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <UnreadBadge count={conv.unreadCount} />
                <button
                  type="button"
                  title={t('messages.composeLabel')}
                  onClick={() => router.push(routes.messagesComposeTo(conv.partner.id))}
                  className="rounded-full p-1.5 text-gray-400 hover:bg-teal-500/10 hover:text-teal-600"
                >
                  <PiPencilSimpleLineBold className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </SwipeableChatItem>
        );
      })}
    </>
  );
}
