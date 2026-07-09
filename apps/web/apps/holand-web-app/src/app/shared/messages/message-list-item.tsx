'use client';

import { useState } from 'react';
import { Avatar, Badge, Checkbox } from 'rizzui';
import {
  PiCaretDownBold,
  PiCaretRightBold,
  PiPaperclipBold,
  PiStarBold,
  PiStarFill,
  PiImageBold,
  PiMusicNoteBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { getRelativeTime } from '@core/utils/get-relative-time';
import type { MessageFolder, MessageItem, UserSummary } from '@/types/messages.types';
import { resolveDisplayName } from '@/hooks/use-messenger-user-directory';
import { mailboxListPartner } from '@/utils/messages-normalize';
import { mailboxTheme } from './themes/mailbox-theme';

type MessageListItemProps = {
  message: MessageItem;
  active?: boolean;
  selected?: boolean;
  folder: MessageFolder;
  directory: Map<string, UserSummary>;
  starred?: boolean;
  onSelect: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  showCheckbox?: boolean;
  density?: 'comfortable' | 'compact';
};

function attachmentTypeIcon(message: MessageItem) {
  const ct = message.content_type;
  if (ct === 'image') return <PiImageBold className="h-3 w-3 shrink-0 text-gray-400" />;
  if (ct === 'audio' || ct === 'voice') return <PiMusicNoteBold className="h-3 w-3 shrink-0 text-gray-400" />;
  const first = message.attachments?.[0];
  if (first?.mime_type?.startsWith('image/')) return <PiImageBold className="h-3 w-3 shrink-0 text-gray-400" />;
  if (first?.mime_type?.startsWith('audio/')) return <PiMusicNoteBold className="h-3 w-3 shrink-0 text-gray-400" />;
  return <PiPaperclipBold className="h-3 w-3 shrink-0 text-gray-400" />;
}

function formatMailboxDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MessageListItem({
  message,
  active,
  selected,
  folder,
  directory,
  starred,
  onSelect,
  onToggleSelect,
  onToggleStar,
  showCheckbox,
  density = 'comfortable',
}: MessageListItemProps) {
  const [expanded, setExpanded] = useState(false);
  const sender = mailboxListPartner(message, folder);
  const senderName = resolveDisplayName(sender, directory);
  const hasAttachments = (message.attachments?.length ?? 0) > 0;
  const theme = mailboxTheme;

  return (
    <div
      className={cn(
        'border-b border-muted transition-colors last:border-0',
        density === 'compact' ? 'px-2 py-1.5 sm:px-3' : 'px-3 py-2.5 sm:px-4 sm:py-3',
        active ? theme.activeRowClass : theme.activeRowHover,
        !message.read && !active && 'bg-primary/[0.02]'
      )}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {showCheckbox && onToggleSelect && (
          <Checkbox
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(message.id);
            }}
            className="mt-1"
          />
        )}

        {onToggleStar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(message.id);
            }}
            className="mt-1 shrink-0 text-gray-300 hover:text-amber-400"
            aria-label="Star message"
          >
            {starred ? (
              <PiStarFill className="h-4 w-4 text-amber-400" />
            ) : (
              <PiStarBold className="h-4 w-4" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => onSelect(message.id)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <Avatar name={senderName} src={sender.avatar} size="sm" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'truncate text-sm',
                  !message.read
                    ? 'font-bold text-gray-900 dark:text-gray-100'
                    : 'font-medium text-gray-700 dark:text-gray-300'
                )}
              >
                {senderName}
              </span>
              <span className="shrink-0 text-[10px] font-medium text-gray-400">
                {formatMailboxDate(message.created_at)}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-1.5">
              <p
                className={cn(
                  'truncate text-sm',
                  !message.read
                    ? 'font-semibold text-gray-900 dark:text-gray-100'
                    : 'text-gray-700 dark:text-gray-300'
                )}
              >
                {message.subject || '(No subject)'}
              </p>
              {message.priority === 'high' && (
                <Badge
                  size="sm"
                  className="flex aspect-square h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full p-0 text-[10px] leading-none bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                >
                  !
                </Badge>
              )}
              {hasAttachments && attachmentTypeIcon(message)}
              {(message.reply_count ?? 0) > 0 && (
                <span className="shrink-0 text-[10px] text-gray-400">({message.reply_count})</span>
              )}
              {!message.read && (
                <Badge renderAsDot className={cn('h-2 w-2 shrink-0 aspect-square', theme.unreadDotClass)} />
              )}
            </div>

            {density !== 'compact' && (
              <p
                className={cn(
                  'mt-0.5 text-xs text-gray-500',
                  expanded ? 'line-clamp-none' : 'line-clamp-1'
                )}
              >
                {message.preview}
              </p>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-200"
          aria-label={expanded ? 'Collapse preview' : 'Expand preview'}
        >
          {expanded ? (
            <PiCaretDownBold className="h-3.5 w-3.5" />
          ) : (
            <PiCaretRightBold className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
