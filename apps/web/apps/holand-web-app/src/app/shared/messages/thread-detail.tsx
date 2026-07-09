'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button, Loader, Text, Title } from 'rizzui';
import { PiArrowLeftBold, PiEnvelopeBold, PiChatCircleTextBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { messagesService } from '@/services/messages.service';
import { messagesDataStore } from '@/stores/messages-data-store';
import { useMessageReactions } from '@/hooks/use-message-reactions';
import { usePinnedMessages } from '@/hooks/use-pinned-messages';
import type { MessageDetail, MessageItem, MessagesViewMode } from '@/types/messages.types';
import EmailHeader from './email-header';
import PeopleThreadHeader from './people-thread-header';
import ChatTimeline from './chat-timeline';
import InlineComposer from './inline-composer';
import ThreadSearch from './components/thread-search';
import PinnedMessagesBar from './components/pinned-messages-bar';
import ForwardModal from './components/forward-modal';
import TypingIndicator from './components/typing-indicator';
import MessageSelectionBar from './components/message-selection-bar';
import LiveCallPanel from './live-call-panel';
import { useLiveCall } from './use-live-call';
import { routes } from '@/config/routes';
type ThreadDetailProps = {
  messageId: string | null;
  message: MessageDetail | null;
  replies: MessageItem[];
  detailLoading?: boolean;
  detailError?: string | null;
  onRefreshDetail?: () => void;
  viewMode?: MessagesViewMode;
  partnerId?: string | null;
  typingPartnerId?: string | null;
  currentUserId?: string;
  onBack?: () => void;
  onRefreshList: () => void;
  onDeleted: () => void;
  className?: string;
};

export default function ThreadDetail({
  messageId,
  message,
  replies,
  detailLoading = false,
  detailError = null,
  onRefreshDetail,
  viewMode = 'mailbox',
  partnerId,
  typingPartnerId,
  currentUserId: providedUserId = '',
  onBack,
  onRefreshList,
  onDeleted,
  className,
}: ThreadDetailProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const composerRef = useRef<HTMLDivElement>(null);
  const loading = detailLoading;
  const error = detailError;
  const currentUserId = providedUserId;
  const refresh = onRefreshDetail ?? (() => undefined);

  const { getReactions, toggleReaction } = useMessageReactions(currentUserId || undefined);
  const { pinnedIds, isPinned, togglePin } = usePinnedMessages(messageId);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [forwardMessage, setForwardMessage] = useState<MessageItem | null>(null);
  const [timelineSelectionMode, setTimelineSelectionMode] = useState(false);
  const [selectedTimelineIds, setSelectedTimelineIds] = useState<Set<string>>(new Set());
  const liveCall = useLiveCall();
  const isPeople = viewMode === 'people';
  const channel = isPeople ? 'chat' : 'mail';

  const allMessages = useMemo(
    () => (message ? [message, ...replies] : []),
    [message, replies]
  );

  const pinnedMessages = useMemo(
    () => allMessages.filter((m) => pinnedIds.includes(m.id)),
    [allMessages, pinnedIds]
  );

  useEffect(() => {
    if (highlightedMessageId) {
      document.getElementById(`msg-${highlightedMessageId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightedMessageId]);

  const handleArchive = async () => {
    if (!messageId) return;
    try {
      await messagesService.update(messageId, { folder: 'archived' });
      messagesDataStore.removeMessage(messageId);
      toast.success(t('messages.thread.archived'));
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.thread.actionFailed'));
    }
  };

  const handleDelete = async () => {
    if (!messageId || !window.confirm(t('messages.thread.confirmDelete'))) return;
    try {
      await messagesService.delete(messageId, channel);
      messagesDataStore.removeMessage(messageId);
      toast.success(t('messages.thread.deleted'));
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.thread.actionFailed'));
    }
  };

  const handleToggleRead = async () => {
    if (!messageId || !message) return;
    const nextRead = !message.read;
    try {
      await messagesService.update(messageId, { read: nextRead });
      messagesDataStore.patchMessage(messageId, { read: nextRead });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.thread.actionFailed'));
    }
  };

  const scrollToComposer = () => {
    editorFocusComposer();
  };

  const editorFocusComposer = () => {
    const input = composerRef.current?.querySelector<HTMLElement>('.ProseMirror');
    input?.focus({ preventScroll: true });
  };

  const handleReply = (msgId: string) => {
    setReplyToMessageId(msgId);
    scrollToComposer();
  };

  const handleForward = (msgId: string) => {
    const msg = allMessages.find((m) => m.id === msgId);
    if (msg) setForwardMessage(msg);
  };

  const handleEditSave = async (msgId: string, newBody: string) => {
    try {
      await messagesService.update(
        msgId,
        { body: `<p>${newBody}</p>` },
        channel
      );
      messagesDataStore.patchMessage(msgId, {
        body: `<p>${newBody}</p>`,
        preview: newBody.slice(0, 120),
        edited_at: new Date().toISOString(),
      });
      toast.success(t('messages.timeline.edited'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.thread.actionFailed'));
    }
  };

  const handleDeleteMessage = async (msgId: string, forEveryone = false) => {
    try {
      await messagesService.delete(msgId, channel, forEveryone);
      messagesDataStore.removeMessage(msgId);
      toast.success(t('messages.thread.deleted'));
      onRefreshList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.thread.actionFailed'));
    }
  };

  const handleResend = async (msgId: string) => {
    try {
      await messagesService.resend(msgId);
      messagesDataStore.patchMessage(msgId, { delivery_status: 'sent' });
      toast.success(t('messages.timeline.resent'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.thread.actionFailed'));
    }
  };

  const handleTimelineBulkDelete = async () => {
    for (const id of selectedTimelineIds) {
      await messagesService.delete(id, channel).catch(() => undefined);
      messagesDataStore.removeMessage(id);
    }
    setSelectedTimelineIds(new Set());
    setTimelineSelectionMode(false);
  };

  const handleSnooze = async (snoozeUntil: string) => {
    if (!messageId || isPeople) return;
    try {
      await messagesService.snooze(messageId, snoozeUntil);
      toast.success(t('messages.snooze.done'));
      onRefreshList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.thread.actionFailed'));
    }
  };

  const handleReplyAll = () => {
    if (!messageId || isPeople) return;
    router.push(`${routes.messagesCompose}?reply_to=${messageId}&reply_all=1`);
  };

  const handleForwardSend = async (recipientId: string, msg: MessageItem) => {
    const body = 'body' in msg && msg.body ? msg.body : msg.preview;
    if (isPeople) {
      await messagesService.send(
        {
          to: recipientId,
          body: `<p><em>${t('messages.forward.forwarded', 'Forwarded message')}</em></p>${body}`,
          client_message_id: crypto.randomUUID(),
        },
        'chat'
      );
      return;
    }
    await messagesService.forward({
      message_id: msg.id,
      to: recipientId,
      body: t('messages.forward.forwarded', 'Forwarded message'),
    });
  };

  if (!messageId) {
    const EmptyIcon = isPeople ? PiChatCircleTextBold : PiEnvelopeBold;
    return (
      <div
        className={cn(
          'flex h-full min-h-0 flex-1 flex-col items-center justify-center p-8',
          className
        )}
      >
        <EmptyIcon className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
        <Title as="h5" className="text-base font-semibold text-gray-400">
          {isPeople ? t('messages.lens.people.selectConversation') : t('messages.thread.selectMessage')}
        </Title>
        <Text className="mt-1 text-sm text-gray-400">
          {isPeople ? t('messages.lens.people.selectHint') : t('messages.description')}
        </Text>
      </div>
    );
  }

  if (loading && !message) {
    return (
      <div className={cn('flex min-h-0 flex-1 items-center justify-center', className)}>
        <Loader variant="spinner" />
      </div>
    );
  }

  if (error && !message) {
    return (
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8',
          className
        )}
      >
        <Text className="text-sm text-red-500">{error}</Text>
        <Button size="sm" variant="outline" onClick={refresh}>
          {t('common.retry', 'Retry')}
        </Button>
      </div>
    );
  }

  if (!message) return null;

  const partnerName = partnerId
    ? message.from.id === partnerId
      ? message.from.name
      : message.to.name
    : undefined;

  const replyToMessage = replyToMessageId
    ? allMessages.find((m) => m.id === replyToMessageId)
    : undefined;

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col overflow-hidden overscroll-y-contain', className)}>
      {onBack && (
        <div className="border-b border-muted px-4 py-2 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-primary dark:text-gray-400"
          >
            <PiArrowLeftBold className="h-3.5 w-3.5" />
            {t('messages.thread.backToList')}
          </button>
        </div>
      )}

      <MessageSelectionBar
        count={selectedTimelineIds.size}
        onDelete={handleTimelineBulkDelete}
        onForward={() => {
          const first = [...selectedTimelineIds][0];
          if (first) handleForward(first);
        }}
        onArchive={handleArchive}
        onClear={() => {
          setSelectedTimelineIds(new Set());
          setTimelineSelectionMode(false);
        }}
      />

      {isPeople ? (
        <PeopleThreadHeader
          message={message}
          partnerId={partnerId ?? undefined}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onVoiceCall={() => liveCall.startCall('voice', partnerName)}
          onVideoCall={() => liveCall.startCall('video', partnerName)}
          onToggleSelectionMode={() => setTimelineSelectionMode((v) => !v)}
          selectionMode={timelineSelectionMode}
          searchSlot={
            <ThreadSearch
              messages={allMessages}
              onHighlight={setHighlightedMessageId}
            />
          }
        />
      ) : (
        <EmailHeader
          message={message}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onToggleRead={handleToggleRead}
          onReply={scrollToComposer}
          onReplyAll={handleReplyAll}
          onSnooze={handleSnooze}
          onForward={() => handleForward(message.id)}
        />
      )}

      {isPeople && (
        <PinnedMessagesBar
          pinnedMessages={pinnedMessages}
          onUnpin={togglePin}
          onScrollTo={setHighlightedMessageId}
        />
      )}

      <div className="custom-scrollbar scrollbar-no-auto-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        <ChatTimeline
          rootMessage={message}
          replies={replies}
          currentUserId={currentUserId}
          viewMode={viewMode}
          getReactions={getReactions}
          onReact={toggleReaction}
          onReply={handleReply}
          onForward={handleForward}
          onPin={togglePin}
          isPinned={isPinned}
          highlightedMessageId={highlightedMessageId}
          selectionMode={timelineSelectionMode}
          selectedMessageIds={selectedTimelineIds}
          onToggleMessageSelect={(id) => {
            setSelectedTimelineIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onEditSave={handleEditSave}
          onResend={handleResend}
          onDelete={handleDeleteMessage}
        />
      </div>

      {isPeople && typingPartnerId && typingPartnerId === partnerId && (
        <TypingIndicator partnerName={partnerName} className="shrink-0 border-t border-muted" />
      )}

      <div ref={composerRef} className="shrink-0">
        <InlineComposer
          messageId={messageId}
          viewMode={viewMode}
          replyToMessage={replyToMessage}
          currentThreadMessage={message}
          onClearReply={() => setReplyToMessageId(null)}
          onSent={() => {
            setReplyToMessageId(null);
          }}
        />
      </div>

      <ForwardModal
        isOpen={Boolean(forwardMessage)}
        message={forwardMessage}
        onClose={() => setForwardMessage(null)}
        onForward={handleForwardSend}
      />

      <LiveCallPanel
        isOpen={liveCall.isActive}
        callType={liveCall.callType}
        partnerName={liveCall.partnerName}
        status={liveCall.status}
        durationSec={liveCall.durationSec}
        isMuted={liveCall.isMuted}
        isCameraOff={liveCall.isCameraOff}
        onToggleMute={liveCall.toggleMute}
        onToggleCamera={liveCall.toggleCamera}
        onEnd={liveCall.endCall}
      />
    </div>
  );
}
