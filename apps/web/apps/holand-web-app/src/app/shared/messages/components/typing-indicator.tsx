'use client';

import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';

type TypingIndicatorProps = {
  partnerName?: string;
  className?: string;
};

export default function TypingIndicator({ partnerName, className }: TypingIndicatorProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-xs text-teal-600 dark:text-teal-400',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span>
        {partnerName
          ? t('messages.lens.people.typingWithName', { name: partnerName })
          : t('messages.lens.people.typing')}
      </span>
    </div>
  );
}
