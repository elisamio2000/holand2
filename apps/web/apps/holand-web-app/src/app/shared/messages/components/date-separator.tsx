'use client';

import { Text } from 'rizzui';
import cn from '@core/utils/class-names';

interface DateSeparatorProps {
  date: Date;
  label: string;
  className?: string;
}

export default function DateSeparator({ date, label, className }: DateSeparatorProps) {
  return (
    <div className={cn('flex items-center justify-center py-4', className)}>
      <div className="rounded-full bg-gray-100 px-4 py-1.5 shadow-sm dark:bg-gray-800">
        <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {label}
        </Text>
      </div>
    </div>
  );
}
