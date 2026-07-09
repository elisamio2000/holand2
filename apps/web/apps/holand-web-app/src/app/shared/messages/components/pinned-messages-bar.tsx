'use client';

import { useTranslation } from 'react-i18next';
import { PiPushPinFill, PiXBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { MessageItem } from '@/types/messages.types';

interface PinnedMessagesBarProps {
  pinnedMessages: MessageItem[];
  onUnpin: (messageId: string) => void;
  onScrollTo: (messageId: string) => void;
}

export default function PinnedMessagesBar({
  pinnedMessages,
  onUnpin,
  onScrollTo,
}: PinnedMessagesBarProps) {
  const { t } = useTranslation();

  if (pinnedMessages.length === 0) return null;

  return (
    <div className="border-b border-muted bg-gray-50/80 px-4 py-2 dark:bg-gray-100/50">
      <div className="flex items-center gap-2 overflow-x-auto">
        <PiPushPinFill className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="shrink-0 text-xs font-medium text-gray-500">
          {t('messages.pinned.title', 'Pinned')}
        </span>
        {pinnedMessages.map((msg) => {
          const preview = 'body' in msg && msg.body ? msg.body : msg.preview;
          const div = typeof document !== 'undefined' ? document.createElement('div') : null;
          if (div) div.innerHTML = preview;
          const text = div?.textContent?.slice(0, 60) || msg.preview?.slice(0, 60) || '…';

          return (
            <button
              key={msg.id}
              type="button"
              onClick={() => onScrollTo(msg.id)}
              className={cn(
                'group flex max-w-[200px] shrink-0 items-center gap-1.5 rounded-lg border border-muted bg-white px-2.5 py-1.5 text-xs transition-colors hover:border-primary/30 dark:bg-gray-50'
              )}
            >
              <span className="truncate text-gray-700 dark:text-gray-300">{text}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnpin(msg.id);
                }}
                className="shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              >
                <PiXBold className="h-2.5 w-2.5" />
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
}
