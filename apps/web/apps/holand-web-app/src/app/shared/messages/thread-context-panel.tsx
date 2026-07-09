'use client';

import { useTranslation } from 'react-i18next';
import { PiUserBold, PiClockBold, PiCircleFill } from 'react-icons/pi';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import type { MessageDetail } from '@/types/messages.types';

type ThreadContextPanelProps = {
  message: MessageDetail | null;
  partnerId?: string | null;
};

const MOCK_PRESENCE: Record<string, 'online' | 'away' | 'offline'> = {
  'user-sara': 'online',
  'user-reza': 'away',
  'user-support': 'online',
  'user-admin': 'offline',
};

const MOCK_BIO: Record<string, string> = {
  'user-sara': 'Product lead — Q2 planning & reports',
  'user-reza': 'Platform engineer — migrations & pipelines',
  'user-support': 'Customer support — UI bugs & integrations',
  'user-admin': 'System administration',
};

export default function ThreadContextPanel({
  message,
  partnerId,
}: ThreadContextPanelProps) {
  const { t } = useTranslation();

  if (!message || !partnerId) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
        <PiUserBold className="mb-2 h-8 w-8 text-gray-300" />
        <p className="text-xs text-gray-400">{t('messages.rail.selectThread')}</p>
      </div>
    );
  }

  const contact =
    message.from.id === partnerId ? message.from : message.to;
  const presence = MOCK_PRESENCE[partnerId] ?? 'offline';
  const bio = MOCK_BIO[partnerId];

  const presenceColor = {
    online: 'text-green-500',
    away: 'text-amber-500',
    offline: 'text-gray-400',
  }[presence];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-600">
          {contact.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <Text className="truncate text-sm font-semibold">{contact.name}</Text>
          {contact.email && (
            <Text className="truncate text-xs text-gray-500">{contact.email}</Text>
          )}
          <div className="mt-1 flex items-center gap-1.5">
            <PiCircleFill className={cn('h-2 w-2', presenceColor)} />
            <span className="text-[10px] text-gray-500">
              {t(`messages.lens.people.presence.${presence}`)}
            </span>
          </div>
        </div>
      </div>

      {bio && (
        <div>
          <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {t('messages.rail.bio')}
          </Text>
          <Text className="text-xs text-gray-600 dark:text-gray-400">{bio}</Text>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <PiClockBold className="h-3.5 w-3.5 shrink-0" />
        <span>{t('messages.rail.lastActive')}</span>
      </div>
    </div>
  );
}
