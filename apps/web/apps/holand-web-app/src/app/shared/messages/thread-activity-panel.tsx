'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import { getRelativeTime } from '@core/utils/get-relative-time';
import type { MessageDetail, MessageItem } from '@/types/messages.types';

type ThreadActivityPanelProps = {
  message: MessageDetail | null;
  replies: MessageItem[];
};

export default function ThreadActivityPanel({ message, replies }: ThreadActivityPanelProps) {
  const { t } = useTranslation();

  const events = useMemo(() => {
    if (!message) return [];
    const all = [message, ...replies];
    return all
      .map((m) => ({
        id: m.id,
        label: m.edited_at
          ? t('messages.activity.edited', 'Message edited')
          : t('messages.activity.sent', 'Message sent'),
        at: m.edited_at ?? m.created_at,
        preview: m.preview || m.subject,
      }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [message, replies, t]);

  if (!message) {
    return (
      <div className="p-4">
        <Text className="text-sm text-gray-500">{t('messages.rail.selectThread')}</Text>
      </div>
    );
  }

  return (
    <ul className="custom-scrollbar max-h-full space-y-2 overflow-y-auto p-3">
      {events.map((ev) => (
        <li
          key={ev.id}
          className="rounded-lg border border-muted px-3 py-2 text-sm"
        >
          <Text className="font-medium text-gray-800 dark:text-gray-200">{ev.label}</Text>
          <Text className="line-clamp-2 text-xs text-gray-500">{ev.preview}</Text>
          <Text className="mt-1 text-[10px] text-gray-400">
            {getRelativeTime(new Date(ev.at))}
          </Text>
        </li>
      ))}
    </ul>
  );
}
