'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Text, Title } from 'rizzui';
import { PiArrowLeftBold, PiPaperPlaneTiltBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { messagesService } from '@/services/messages.service';
import PresenceBadge, { mockPresenceFromUserId } from './presence-badge';
import type { UserSummary } from '@/types/messages.types';

type PeopleDraftThreadProps = {
  partner: UserSummary;
  onBack?: () => void;
  onStarted: (threadRootId: string, partnerId: string) => void;
  className?: string;
};

export default function PeopleDraftThread({
  partner,
  onBack,
  onStarted,
  className,
}: PeopleDraftThreadProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const presence = mockPresenceFromUserId(partner.id);

  const handleSend = async () => {
    const text = body.trim();
    if (!text) {
      toast.error(t('messages.thread.emptyReply'));
      return;
    }
    setSending(true);
    try {
      const res = await messagesService.send(
        {
          to: partner.id,
          body: `<p>${text}</p>`,
          content_type: 'text',
          client_message_id: crypto.randomUUID(),
        },
        'chat'
      );
      const threadId = res.data?.id;
      if (!threadId) throw new Error(t('messages.thread.sendFailed'));
      toast.success(t('messages.thread.sent'));
      onStarted(threadId, partner.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('messages.thread.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col overflow-hidden', className)}>
      {onBack && (
        <div className="border-b border-muted px-4 py-2 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-teal-600 dark:text-gray-400"
          >
            <PiArrowLeftBold className="h-3.5 w-3.5" />
            {t('messages.thread.backToList')}
          </button>
        </div>
      )}

      <div className="border-b border-muted bg-gray-0 px-4 py-3 dark:bg-gray-50 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Avatar name={partner.name} src={partner.avatar} size="md" />
            <PresenceBadge status={presence} size="md" className="bottom-0 end-0" />
          </div>
          <div className="min-w-0">
            <Title as="h3" className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
              {partner.name}
            </Title>
            <Text className="text-xs text-gray-500">
              {partner.email || t('messages.lens.people.newConversation')}
            </Text>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <Text className="text-sm text-gray-500">{t('messages.lens.people.draftHint')}</Text>
      </div>

      <div className="shrink-0 border-t border-teal-500/20 bg-teal-500/[0.03] px-4 py-3 dark:bg-teal-500/10">
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('messages.thread.replyPlaceholder')}
            rows={2}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-muted bg-gray-0 px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500/40 dark:bg-gray-50 dark:text-gray-100"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            size="sm"
            variant="solid"
            isLoading={sending}
            onClick={handleSend}
            className="shrink-0 bg-teal-500 hover:bg-teal-600 border-teal-500"
          >
            <PiPaperPlaneTiltBold className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-gray-400">{t('messages.thread.sendHint')}</p>
      </div>
    </div>
  );
}
