'use client';

import { useTranslation } from 'react-i18next';
import {
  PiArrowsHorizontal,
  PiArrowsInLineHorizontal,
  PiArrowsOutLineHorizontal,
  PiCornersOut,
} from 'react-icons/pi';
import { Popover } from 'rizzui';
import cn from '@core/utils/class-names';
import type { ChatContentWidthPreset } from '@/app/shared/ai-chat/hooks/use-chat-content-width';

interface ChatContentWidthControlProps {
  preset: ChatContentWidthPreset;
  onChange: (preset: ChatContentWidthPreset) => void;
}

const PRESETS: {
  key: ChatContentWidthPreset;
  icon: typeof PiArrowsHorizontal;
}[] = [
  { key: 'narrow', icon: PiArrowsInLineHorizontal },
  { key: 'default', icon: PiArrowsHorizontal },
  { key: 'wide', icon: PiArrowsOutLineHorizontal },
  { key: 'full', icon: PiCornersOut },
];

export default function ChatContentWidthControl({
  preset,
  onChange,
}: ChatContentWidthControlProps) {
  const { t } = useTranslation();

  return (
    <Popover placement="bottom-start">
      <Popover.Trigger>
        <button
          type="button"
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-200/20 dark:hover:text-gray-300"
          aria-label={t('chatPage.contentWidth.label')}
          title={t('chatPage.contentWidth.label')}
        >
          <PiArrowsOutLineHorizontal className="h-5 w-5" />
        </button>
      </Popover.Trigger>
      <Popover.Content className="z-50 w-44 p-2">
        <p className="mb-2 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          {t('chatPage.contentWidth.label')}
        </p>
        <div className="flex flex-col gap-0.5">
          {PRESETS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors',
                preset === key
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20'
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              {t(`chatPage.contentWidth.${key}`)}
            </button>
          ))}
        </div>
      </Popover.Content>
    </Popover>
  );
}
