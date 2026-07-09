'use client';

import { Text } from 'rizzui';
import { PiArrowBendUpLeftBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

interface ReplyQuoteProps {
  senderName: string;
  preview: string;
  onClick?: () => void;
  className?: string;
}

export default function ReplyQuote({ senderName, preview, onClick, className }: ReplyQuoteProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-start gap-2 rounded-lg border-l-4 border-teal-500 bg-teal-50/50 px-3 py-2 text-left transition-colors hover:bg-teal-50 dark:bg-teal-950/20 dark:hover:bg-teal-950/40',
        className
      )}
    >
      <PiArrowBendUpLeftBold className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
      <div className="min-w-0 flex-1">
        <Text className="text-xs font-semibold text-teal-700 dark:text-teal-300">
          {senderName}
        </Text>
        <Text className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
          {preview}
        </Text>
      </div>
    </button>
  );
}
