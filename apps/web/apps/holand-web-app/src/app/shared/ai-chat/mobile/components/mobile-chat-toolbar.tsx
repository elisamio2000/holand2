'use client';

import { useTranslation } from 'react-i18next';
import {
  PiDownloadSimple,
  PiFolder,
  PiBrain,
  PiShareNetwork,
  PiDotsThreeOutline,
} from 'react-icons/pi';
import { Popover } from 'rizzui';
import cn from '@core/utils/class-names';

interface MobileChatToolbarProps {
  onExport?: () => void;
  onShare?: () => void;
  onFiles?: () => void;
  onMemory?: () => void;
  onWidth?: () => void;
  className?: string;
}

export default function MobileChatToolbar({
  onExport,
  onShare,
  onFiles,
  onMemory,
  onWidth,
  className,
}: MobileChatToolbarProps) {
  const { t } = useTranslation();

  const items = [
    { key: 'export', icon: PiDownloadSimple, label: t('chatPage.export'), onClick: onExport },
    { key: 'share', icon: PiShareNetwork, label: t('chatPage.shareConversation'), onClick: onShare },
    { key: 'files', icon: PiFolder, label: t('chatPage.sessionFiles'), onClick: onFiles },
    { key: 'memory', icon: PiBrain, label: t('chatPage.memoryPanel'), onClick: onMemory },
    { key: 'width', icon: PiDotsThreeOutline, label: t('chatPage.contentWidth.title'), onClick: onWidth },
  ].filter((item) => item.onClick);

  if (items.length === 0) return null;

  return (
    <div className={cn('flex items-center lg:hidden', className)}>
      <Popover>
        <Popover.Trigger>
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200/20"
            aria-label={t('chatPage.mobileMore')}
          >
            <PiDotsThreeOutline className="h-5 w-5" />
          </button>
        </Popover.Trigger>
        <Popover.Content className="z-50 min-w-[160px] p-1">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-200/10"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </Popover.Content>
      </Popover>
    </div>
  );
}
