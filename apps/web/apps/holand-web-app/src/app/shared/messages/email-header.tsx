'use client';

import { Tooltip } from '@/components/tooltip';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, Button, Text, Title } from 'rizzui';
import {
  PiArchiveBold,
  PiArrowBendUpLeftBold,
  PiArrowBendDoubleUpLeftBold,
  PiCaretDownBold,
  PiClockBold,
  PiEnvelopeOpenBold,
  PiTrashBold,
  PiShareFatBold,
  PiStarBold,
  PiBugBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useMedia } from '@core/hooks/use-media';
import { getRelativeTime } from '@core/utils/get-relative-time';
import MessageAttachmentRenderer from './message-attachment-renderer';
import type { MessageDetail } from '@/types/messages.types';
import {
  resolveDisplayName,
  useMessengerUserDirectory,
} from '@/hooks/use-messenger-user-directory';
import { isBugReportMessage, parseSeverityFromSubject } from './utils/bug-report-message';

type EmailHeaderProps = {
  message: MessageDetail;
  onArchive: () => void;
  onDelete: () => void;
  onToggleRead: () => void;
  onReply: () => void;
  onReplyAll?: () => void;
  onSnooze?: (snoozeUntil: string) => void;
  onForward?: () => void;
  busy?: boolean;
};

const priorityStyles = {
  high: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  normal: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  low: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function EmailHeader({
  message,
  onArchive,
  onDelete,
  onToggleRead,
  onReply,
  onReplyAll,
  onSnooze,
  onForward,
  busy,
}: EmailHeaderProps) {
  const { t } = useTranslation();
  const isCompact = useMedia('(max-width: 1024px)', false);
  const [detailsOpen, setDetailsOpen] = useState(!isCompact);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeValue, setSnoozeValue] = useState('');
  const isBugReport = isBugReportMessage(message);
  const severity = parseSeverityFromSubject(message.subject);

  const userIds = useMemo(
    () => [message.from.id, message.to.id].filter(Boolean),
    [message.from.id, message.to.id]
  );
  const directory = useMessengerUserDirectory(userIds);
  const fromName = resolveDisplayName(message.from, directory);
  const toName = resolveDisplayName(message.to, directory);

  useEffect(() => {
    setDetailsOpen(!isCompact);
  }, [isCompact]);

  const showAttachments =
    !isBugReport && message.attachments && message.attachments.length > 0;

  const hasDetails =
    Boolean(message.from) ||
    Boolean(message.to) ||
    showAttachments;

  return (
    <div className="border-b border-muted px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {hasDetails && (
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/20"
              aria-expanded={detailsOpen}
              aria-label={
                detailsOpen
                  ? t('messages.thread.hideDetails', 'Hide details')
                  : t('messages.thread.showDetails', 'Show details')
              }
            >
              <PiCaretDownBold
                className={cn('h-4 w-4 transition-transform', detailsOpen && 'rotate-180')}
              />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {isBugReport ? (
              <div className="flex items-center gap-2">
                <PiBugBold className="h-5 w-5 shrink-0 text-[#667eea]" />
                <Title as="h3" className="text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">
                  {t('messages.bugReport.reportTitle', 'Bug Report')}
                </Title>
              </div>
            ) : (
              <Title as="h3" className="text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">
                {message.subject || t('messages.thread.noSubject')}
              </Title>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {isBugReport && severity ? (
                <Badge className="bg-red-100 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {severity.toUpperCase()}
                </Badge>
              ) : (
                <Badge className={cn('text-xs', priorityStyles[message.priority])}>
                  {t(`messages.priority.${message.priority}`)}
                </Badge>
              )}
              <Text className="text-xs text-gray-500">
                {getRelativeTime(new Date(message.created_at))}
              </Text>
              {!detailsOpen && fromName && (
                <Text className="truncate text-xs text-gray-400">
                  · {fromName}
                </Text>
              )}
              {isBugReport && message.subject && (
                <Text className="truncate text-xs text-gray-400">
                  · {message.subject}
                </Text>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Tooltip content={t('messages.reply')} placement="bottom">
            <Button size="sm" variant="outline" onClick={onReply} disabled={busy} aria-label={t('messages.reply')}>
              <PiArrowBendUpLeftBold className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          {onReplyAll && (
            <Tooltip content={t('messages.replyAll.label')} placement="bottom">
              <Button
                size="sm"
                variant="outline"
                onClick={onReplyAll}
                disabled={busy}
                aria-label={t('messages.replyAll.label')}
              >
                <PiArrowBendDoubleUpLeftBold className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          {onForward && (
            <Tooltip content={t('messages.forward.label')} placement="bottom">
              <Button size="sm" variant="outline" onClick={onForward} disabled={busy} aria-label={t('messages.forward.label')}>
                <PiShareFatBold className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t('messages.thread.star')} placement="bottom">
            <Button size="sm" variant="outline" disabled={busy} aria-label={t('messages.thread.star')}>
              <PiStarBold className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          {onSnooze && (
            <div className="relative">
              <Tooltip content={t('messages.snooze.label')} placement="bottom">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSnoozeOpen((v) => !v)}
                  disabled={busy}
                  aria-label={t('messages.snooze.label')}
                >
                  <PiClockBold className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
              {snoozeOpen && (
                <div className="absolute end-0 top-full z-20 mt-1 w-56 rounded-lg border border-muted bg-gray-0 p-3 shadow-lg dark:bg-gray-50">
                  <Text className="mb-2 text-xs font-semibold text-gray-600">
                    {t('messages.snooze.until')}
                  </Text>
                  <input
                    type="datetime-local"
                    value={snoozeValue}
                    onChange={(e) => setSnoozeValue(e.target.value)}
                    className="mb-2 w-full rounded border border-muted px-2 py-1 text-xs"
                  />
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => setSnoozeOpen(false)}>
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                      size="sm"
                      variant="solid"
                      disabled={!snoozeValue}
                      onClick={() => {
                        onSnooze(new Date(snoozeValue).toISOString());
                        setSnoozeOpen(false);
                        setSnoozeValue('');
                      }}
                    >
                      {t('messages.snooze.confirm')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <Tooltip content={t('messages.thread.toggleRead')} placement="bottom">
            <Button size="sm" variant="outline" onClick={onToggleRead} disabled={busy} aria-label={t('messages.thread.toggleRead')}>
              <PiEnvelopeOpenBold className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('messages.thread.archive')} placement="bottom">
            <Button size="sm" variant="outline" onClick={onArchive} disabled={busy} aria-label={t('messages.thread.archive')}>
              <PiArchiveBold className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('messages.thread.delete')} placement="bottom">
            <Button size="sm" variant="flat" color="danger" onClick={onDelete} disabled={busy} aria-label={t('messages.thread.delete')}>
              <PiTrashBold className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {detailsOpen && (
        <>
          <div className="mt-3 grid gap-2 text-sm sm:mt-4">
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs font-semibold text-gray-500">
                {t('messages.compose.from')}
              </span>
              <Avatar name={fromName} src={message.from.avatar} size="sm" />
              <span className="min-w-0 truncate text-gray-700 dark:text-gray-300">
                {fromName}
                {message.from.email && (
                  <span className="text-gray-400"> &lt;{message.from.email}&gt;</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs font-semibold text-gray-500">
                {t('messages.compose.to')}
              </span>
              <Avatar name={toName} src={message.to.avatar} size="sm" />
              <span className="min-w-0 truncate text-gray-700 dark:text-gray-300">
                {toName}
                {message.to.email && (
                  <span className="text-gray-400"> &lt;{message.to.email}&gt;</span>
                )}
              </span>
            </div>
          </div>

          {showAttachments && (
            <div className="mt-3 sm:mt-4">
              <Text className="mb-2 text-xs font-semibold text-gray-500">
                {t('messages.compose.attachments')} ({message.attachments!.length})
              </Text>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {message.attachments!.map((att) => (
                  <MessageAttachmentRenderer key={att.id} attachment={att} compact />
                ))}
              </div>
            </div>
          )}

          {isBugReport && (
            <Text className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {t(
                'messages.bugReport.viewCardBelow',
                'Session replay, timeline, and screenshots are shown in the report card below.'
              )}
            </Text>
          )}
        </>
      )}
    </div>
  );
}
