'use client';

import Link from 'next/link';
import { cloneElement, isValidElement, useMemo, useState, type ReactElement, type RefObject } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Title, Text, Popover, Avatar, Badge } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { useMedia } from '@core/hooks/use-media';
import SimpleBar from '@core/ui/simplebar';
import { PiCheck } from 'react-icons/pi';
import { useMessagesListSlice } from '@/hooks/use-messages-store';
import { groupByPeople } from '@/utils/messages-normalize';
import { usePinnedChats } from '@/hooks/use-pinned-chats';
import {
  resolveDisplayName,
  useMessengerUserDirectory,
} from '@/hooks/use-messenger-user-directory';
import type { MessageItem, PeopleConversation } from '@/types/messages.types';
import { HeaderPopoverWithTooltip } from '@/layouts/header-action-tooltip';

dayjs.extend(relativeTime);

type DropdownTab = 'chat' | 'inbox';

function ChatTabList({
  setIsOpen,
  conversations,
  loading,
}: {
  setIsOpen: (open: boolean) => void;
  conversations: PeopleConversation[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const partnerIds = useMemo(
    () => conversations.map((c) => c.partner.id),
    [conversations]
  );
  const directory = useMessengerUserDirectory(partnerIds);

  return (
    <div className="grid grid-cols-1 ps-4">
      {loading && conversations.length === 0 ? (
        <Text className="px-2 py-4 text-sm text-gray-500">{t('common.loading', 'Loading…')}</Text>
      ) : null}
      {!loading && conversations.length === 0 ? (
        <Text className="px-2 py-4 text-sm text-gray-500">{t('headerMessages.empty')}</Text>
      ) : null}
      {conversations.map((item) => {
        const partnerName = resolveDisplayName(item.partner, directory);
        const preview = item.lastMessage.preview || item.lastMessage.subject;
        const href = routes.messagesPeopleChat(item.partner.id);
        return (
          <Link
            key={item.partner.id}
            href={href}
            onClick={() => setIsOpen(false)}
            className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-2.5 rounded-md px-2 py-2.5 pe-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-50"
          >
            <Avatar src={item.partner.avatar} name={partnerName} className="!h-9 !w-9" />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
              <div className="w-full">
                <Text className="mb-0.5 w-11/12 truncate text-sm font-semibold text-gray-900 dark:text-gray-700">
                  {partnerName}
                </Text>
                <div className="flex">
                  <Text className="w-10/12 truncate pe-7 text-xs text-gray-500">{preview}</Text>
                  <Text className="ms-auto whitespace-nowrap pe-8 text-xs text-gray-500">
                    {dayjs(item.lastMessage.created_at).fromNow(true)}
                  </Text>
                </div>
              </div>
              <div className="ms-auto flex-shrink-0">
                {item.unreadCount > 0 ? (
                  <Badge renderAsDot size="lg" color="primary" className="scale-90" />
                ) : (
                  <span className="inline-block rounded-full bg-gray-100 p-0.5 dark:bg-gray-50">
                    <PiCheck className="h-auto w-[9px]" />
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function InboxTabList({
  setIsOpen,
  items,
  loading,
}: {
  setIsOpen: (open: boolean) => void;
  items: MessageItem[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const unread = items.filter((m) => !m.read).slice(0, 5);
  const senderIds = useMemo(() => unread.map((m) => m.from.id), [unread]);
  const directory = useMessengerUserDirectory(senderIds);

  return (
    <div className="grid grid-cols-1 ps-4">
      {loading && unread.length === 0 ? (
        <Text className="px-2 py-4 text-sm text-gray-500">{t('common.loading', 'Loading…')}</Text>
      ) : null}
      {!loading && unread.length === 0 ? (
        <Text className="px-2 py-4 text-sm text-gray-500">{t('headerMessages.inboxEmpty')}</Text>
      ) : null}
      {unread.map((item) => {
        const fromName = resolveDisplayName(item.from, directory);
        const href = routes.messagesThread(item.id);
        return (
          <Link
            key={item.id}
            href={href}
            onClick={() => setIsOpen(false)}
            className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-2.5 rounded-md px-2 py-2.5 pe-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-50"
          >
            <Avatar src={item.from.avatar} name={fromName} className="!h-9 !w-9" />
            <div className="w-full min-w-0">
              <Text className="mb-0.5 truncate text-sm font-semibold text-gray-900 dark:text-gray-700">
                {item.subject || fromName}
              </Text>
              <Text className="truncate text-xs text-gray-500">
                {item.preview || item.subject}
              </Text>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function MessagesDropdownPanel({
  setIsOpen,
  activeTab,
  onTabChange,
  conversations,
  inboxItems,
  loading,
}: {
  setIsOpen: (open: boolean) => void;
  activeTab: DropdownTab;
  onTabChange: (tab: DropdownTab) => void;
  conversations: PeopleConversation[];
  inboxItems: MessageItem[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const viewAllHref = activeTab === 'chat' ? `${routes.messages}?view=people` : routes.messages;

  return (
    <div className="w-[320px] text-left sm:w-[360px] 2xl:w-[420px] rtl:text-right">
      <div className="mb-2 flex items-center justify-between ps-6">
        <Title as="h5" fontWeight="semibold">
          {t('headerMessages.title')}
        </Title>
        <Link
          href={viewAllHref}
          onClick={() => setIsOpen(false)}
          className="text-sm hover:underline"
        >
          {t('headerMessages.viewAll')}
        </Link>
      </div>

      <div className="mb-3 flex gap-1 px-6">
        {(['chat', 'inbox'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-200/30 dark:text-gray-400'
            )}
          >
            {t(tab === 'chat' ? 'headerMessages.tabChat' : 'headerMessages.tabInbox')}
          </button>
        ))}
      </div>

      <SimpleBar className="max-h-[406px]">
        {activeTab === 'chat' ? (
          <ChatTabList setIsOpen={setIsOpen} conversations={conversations} loading={loading} />
        ) : (
          <InboxTabList setIsOpen={setIsOpen} items={inboxItems} loading={loading} />
        )}
      </SimpleBar>
    </div>
  );
}

export default function MessagesDropdown({
  children,
  tooltipLabel,
}: {
  children: JSX.Element & { ref?: RefObject<any> };
  tooltipLabel: string;
}) {
  const isMobile = useMedia('(max-width: 480px)', false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DropdownTab>('chat');
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? '';
  const { items, unreadCount, loading } = useMessagesListSlice('inbox');
  const { pinnedIds } = usePinnedChats();
  const peopleConversations = useMemo(
    () => groupByPeople(items, currentUserId, 'inbox', pinnedIds),
    [items, currentUserId, pinnedIds]
  );

  const recentConversations = useMemo(
    () => peopleConversations.slice(0, 5),
    [peopleConversations]
  );

  const trigger = useMemo(() => {
    if (!isValidElement(children)) return children;
    if (unreadCount <= 0) return children;
    return cloneElement(children as ReactElement, {
      children: (
        <>
          {(children as ReactElement).props.children}
          <Badge
            renderAsDot
            color="success"
            enableOutlineRing
            className="absolute end-2 top-2 -translate-y-1/3 translate-x-1/2"
          />
        </>
      ),
    });
  }, [children, unreadCount]);

  return (
    <HeaderPopoverWithTooltip label={tooltipLabel}>
      <Popover
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        shadow="sm"
        placement={isMobile ? 'bottom' : 'bottom-end'}
      >
        <Popover.Trigger>{trigger as ReactElement}</Popover.Trigger>
        <Popover.Content className="z-[9999] pb-6 pe-6 ps-0 pt-5 dark:bg-gray-100 [&>svg]:hidden [&>svg]:dark:fill-gray-100 sm:[&>svg]:inline-flex">
          <MessagesDropdownPanel
            setIsOpen={setIsOpen}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            conversations={recentConversations}
            inboxItems={items}
            loading={loading}
          />
        </Popover.Content>
      </Popover>
    </HeaderPopoverWithTooltip>
  );
}
