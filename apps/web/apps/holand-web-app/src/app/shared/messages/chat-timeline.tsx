'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { getRelativeTime } from '@core/utils/get-relative-time';
import { groupMessages, shouldShowDateSeparator, formatDateSeparator } from '@/utils/message-grouping';
import MessageAttachmentRenderer from './message-attachment-renderer';
import MessageReactions, { MessageReaction } from './components/message-reactions';
import MessageStatusIndicator from './components/message-status-indicator';
import DateSeparator from './components/date-separator';
import BugReportMessageCard from './components/bug-report-message-card';
import EntityLinkMessageCard from './components/entity-link-message-card';
import { BoardLinkMessageCard } from './components/board-link-message-card';
import MessageContextMenu from './components/message-context-menu';
import MessageHoverToolbar from './components/message-hover-toolbar';
import type { MessageDetail, MessageItem, MessagesViewMode } from '@/types/messages.types';
import { getMessagesTheme } from './themes';
import { MOCK_CURRENT_USER_ID } from './mock/mock-messages-data';
import { isBugReportMessage } from './utils/bug-report-message';
import { isEntityLinkMessage } from './utils/entity-message';
import { getBoardLinkFromMessage, isBoardLinkMessage } from './utils/board-link-message';

function renderSpecialMessageCard(msg: MessageItem | MessageDetail) {
  if (isBugReportMessage(msg)) {
    return <BugReportMessageCard key={msg.id} message={msg} />;
  }
  if (isBoardLinkMessage(msg)) {
    const link = getBoardLinkFromMessage(msg);
    if (link) {
      return (
        <BoardLinkMessageCard
          key={msg.id}
          boardId={link.boardId}
          title={link.title}
        />
      );
    }
  }
  if (isEntityLinkMessage(msg)) {
    return <EntityLinkMessageCard key={msg.id} message={msg} />;
  }
  return null;
}

type ChatTimelineProps = {
  rootMessage: MessageDetail;
  replies: MessageItem[];
  currentUserId: string;
  viewMode?: MessagesViewMode;
  getReactions?: (messageId: string) => MessageReaction[];
  onReact?: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  isPinned?: (messageId: string) => boolean;
  highlightedMessageId?: string | null;
  selectionMode?: boolean;
  selectedMessageIds?: Set<string>;
  onToggleMessageSelect?: (id: string) => void;
  onEditSave?: (messageId: string, newBody: string) => void;
  onResend?: (messageId: string) => void;
  onDelete?: (messageId: string, forEveryone?: boolean) => void;
};

interface ContextMenuState {
  x: number;
  y: number;
  messageId: string;
}

function ChatBubble({
  message,
  isOwn,
  isFirst,
  isLast,
  viewMode = 'mailbox',
  reactions,
  onReact,
  onContextMenu,
  onReply,
  onForward,
  onPin,
  isPinned,
  highlighted,
  editingId,
  onEditStart,
  onEditSave,
  onEditCancel,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  message: MessageItem | MessageDetail;
  isOwn: boolean;
  isFirst: boolean;
  isLast: boolean;
  viewMode?: MessagesViewMode;
  reactions?: MessageReaction[];
  onReact?: (messageId: string, emoji: string) => void;
  onContextMenu?: (e: React.MouseEvent, messageId: string) => void;
  onReply?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  isPinned?: boolean;
  highlighted?: boolean;
  editingId?: string | null;
  onEditStart?: (messageId: string) => void;
  onEditSave?: (messageId: string, newBody: string) => void;
  onEditCancel?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const theme = getMessagesTheme(viewMode);
  const sender = message.from;
  const body = 'body' in message && message.body ? message.body : message.preview;
  const isPeople = viewMode === 'people';
  const isEditing = editingId === message.id;
  const [editText, setEditText] = useState('');

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isPeople && onContextMenu) {
      e.preventDefault();
      onContextMenu(e, message.id);
    }
  };

  const startEdit = () => {
    const div = document.createElement('div');
    div.innerHTML = body;
    setEditText(div.textContent || '');
  };

  const bubbleRadii = isPeople
    ? isOwn
      ? isFirst && isLast
        ? 'rounded-2xl'
        : isFirst
          ? 'rounded-2xl rounded-br-md'
          : isLast
            ? 'rounded-2xl rounded-tr-md'
            : 'rounded-r-md rounded-l-2xl'
      : isFirst && isLast
        ? 'rounded-2xl'
        : isFirst
          ? 'rounded-2xl rounded-bl-md'
          : isLast
            ? 'rounded-2xl rounded-tl-md'
            : 'rounded-l-md rounded-r-2xl'
    : 'rounded-2xl';

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        'group relative flex gap-2',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        highlighted && 'rounded-lg ring-2 ring-primary/40 ring-offset-2'
      )}
      onContextMenu={handleContextMenu}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="mt-2 h-3.5 w-3.5 shrink-0 rounded border-muted text-primary"
        />
      )}
      {isLast ? (
        <Avatar name={sender.name} src={sender.avatar} size="sm" className="mt-1 shrink-0" />
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div className={cn('flex items-end gap-1.5', isOwn ? 'flex-row-reverse' : 'flex-row')}>
        {isPeople && isLast && onReact && (
          <MessageReactions
            messageId={message.id}
            reactions={reactions}
            onReact={onReact}
            isOwn={isOwn}
          />
        )}
      <div className={cn('relative max-w-[85%]', isOwn ? 'items-end' : 'items-start')}>
        {isPeople && isLast && (
          <MessageHoverToolbar
            isOwn={isOwn}
            onReply={() => onReply?.(message.id)}
            onReact={(emoji) => onReact?.(message.id, emoji)}
            onForward={() => onForward?.(message.id)}
            onMore={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (onContextMenu) {
                const fakeEvent = {
                  preventDefault: () => {},
                  clientX: rect.left,
                  clientY: rect.bottom,
                } as React.MouseEvent;
                onContextMenu(fakeEvent, message.id);
              }
            }}
          />
        )}

        {!isPeople && isFirst && (
          <div className="mb-0.5 flex items-center gap-2">
            <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {sender.name}
            </Text>
            <Text className="text-[10px] text-gray-400">
              {getRelativeTime(new Date(message.created_at))}
            </Text>
          </div>
        )}

        {isEditing ? (
          <div className="rounded-lg border border-primary/30 bg-white p-2 dark:bg-gray-50">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full resize-none rounded border border-muted p-2 text-sm outline-none focus:border-primary"
              rows={3}
              autoFocus
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onEditCancel}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onEditSave?.(message.id, editText)}
                className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'px-3.5 py-2.5 text-sm leading-relaxed',
              bubbleRadii,
              isOwn ? theme.bubbleOwnClass : theme.bubbleOtherClass,
              isOwn && '[&_a]:text-white/90',
              isPinned && 'ring-1 ring-primary/30'
            )}
            onDoubleClick={() => {
              if (isOwn && isPeople) {
                startEdit();
                onEditStart?.(message.id);
              }
            }}
          >
            <div
              className="prose prose-sm max-w-none dark:prose-invert [&_p]:m-0"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </div>
        )}

        {isPeople && isLast && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-400">
            <span>{getRelativeTime(new Date(message.created_at))}</span>
            {message.edited_at && (
              <span className="italic opacity-70">(edited)</span>
            )}
            {isOwn && (
              <MessageStatusIndicator
                status={message.delivery_status}
                read={message.read}
              />
            )}
          </div>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((att) => (
              <MessageAttachmentRenderer key={att.id} attachment={att} compact />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default function ChatTimeline({
  rootMessage,
  replies,
  currentUserId,
  viewMode = 'mailbox',
  getReactions,
  onReact,
  onReply,
  onForward,
  onPin,
  isPinned,
  highlightedMessageId,
  selectionMode = false,
  selectedMessageIds,
  onToggleMessageSelect,
  onEditSave,
  onResend,
  onDelete,
}: ChatTimelineProps) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const allMessages = [rootMessage, ...replies];
  const isPeople = viewMode === 'people';
  const groups = isPeople ? groupMessages(allMessages, currentUserId) : [];

  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      messageId,
    });
  };

  const handleCopy = (messageId: string) => {
    const msg = allMessages.find((m) => m.id === messageId);
    if (msg) {
      const text = 'body' in msg && msg.body ? msg.body : msg.preview;
      const div = document.createElement('div');
      div.innerHTML = text;
      navigator.clipboard.writeText(div.textContent || '');
    }
  };

  const contextMessage = contextMenu
    ? allMessages.find((m) => m.id === contextMenu.messageId)
    : null;
  const contextIsOwn = contextMessage
    ? contextMessage.from.id === currentUserId ||
      (contextMessage.from.id === MOCK_CURRENT_USER_ID && Boolean(currentUserId))
    : false;

  if (!isPeople) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
        {allMessages.map((msg) => {
          const special = renderSpecialMessageCard(msg);
          if (special) return special;
          return (
            <ChatBubble
              key={msg.id}
              message={msg}
              isOwn={
                msg.from.id === currentUserId ||
                (msg.from.id === MOCK_CURRENT_USER_ID && Boolean(currentUserId))
              }
              isFirst={true}
              isLast={true}
              viewMode={viewMode}
              reactions={getReactions?.(msg.id)}
              onReact={onReact}
              highlighted={highlightedMessageId === msg.id}
              selectionMode={selectionMode}
              isSelected={selectedMessageIds?.has(msg.id)}
              onToggleSelect={() => onToggleMessageSelect?.(msg.id)}
              onEditSave={onEditSave}
            />
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 px-5 py-4">
        {groups.map((group, groupIdx) => {
          const isOwn =
            group.senderId === currentUserId ||
            (group.senderId === MOCK_CURRENT_USER_ID && Boolean(currentUserId));
          const prevGroup = groups[groupIdx - 1];
          const showDate = shouldShowDateSeparator(group.date, prevGroup?.date);

          return (
            <div key={`group-${groupIdx}`}>
              {showDate && (
                <DateSeparator date={group.date} label={formatDateSeparator(group.date, t)} />
              )}
              <div className="space-y-0.5">
                {group.messages.map((msg, msgIdx) => {
                  const special = renderSpecialMessageCard(msg);
                  if (special) return special;
                  return (
                    <ChatBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      isFirst={msgIdx === 0}
                      isLast={msgIdx === group.messages.length - 1}
                      viewMode={viewMode}
                      reactions={getReactions?.(msg.id)}
                      onReact={onReact}
                      onContextMenu={handleContextMenu}
                      onReply={onReply}
                      onForward={onForward}
                      onPin={onPin}
                      isPinned={isPinned?.(msg.id)}
                      highlighted={highlightedMessageId === msg.id}
                      editingId={editingId}
                      onEditStart={(id) => setEditingId(id)}
                      onEditSave={(id, newBody) => {
                        setEditingId(null);
                        onEditSave?.(id, newBody);
                      }}
                      onEditCancel={() => setEditingId(null)}
                      selectionMode={selectionMode}
                      isSelected={selectedMessageIds?.has(msg.id)}
                      onToggleSelect={() => onToggleMessageSelect?.(msg.id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOwn={contextIsOwn}
          isPinned={isPinned?.(contextMenu.messageId)}
          onReply={() => onReply?.(contextMenu.messageId)}
          onForward={() => onForward?.(contextMenu.messageId)}
          onEdit={
            contextIsOwn
              ? () => setEditingId(contextMenu.messageId)
              : undefined
          }
          onPin={() => onPin?.(contextMenu.messageId)}
          onCopy={() => handleCopy(contextMenu.messageId)}
          onReact={() => onReact?.(contextMenu.messageId, '👍')}
          onResend={
            contextIsOwn && onResend
              ? () => onResend(contextMenu.messageId)
              : undefined
          }
          onDelete={
            onDelete
              ? () => {
                  if (!window.confirm(t('messages.thread.confirmDelete'))) return;
                  onDelete(contextMenu.messageId, false);
                }
              : undefined
          }
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
