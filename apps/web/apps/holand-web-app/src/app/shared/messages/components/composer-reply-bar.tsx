'use client';

import { Text } from 'rizzui';
import { PiXBold, PiArrowBendUpLeftBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

interface ComposerReplyBarProps {
  senderName: string;
  preview: string;
  onCancel: () => void;
  className?: string;
}

export default function ComposerReplyBar({
  senderName,
  preview,
  onCancel,
  className,
}: ComposerReplyBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-l-4 border-teal-500 bg-teal-50/80 px-4 py-2.5 dark:bg-teal-950/30',
        className
      )}
    >
      <PiArrowBendUpLeftBold className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
      <div className="min-w-0 flex-1">
        <Text className="text-xs font-semibold text-teal-700 dark:text-teal-300">
          Reply to {senderName}
        </Text>
        <Text className="line-clamp-1 text-xs text-gray-600 dark:text-gray-400">
          {preview}
        </Text>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
      >
        <PiXBold className="h-4 w-4" />
      </button>
    </div>
  );
}
