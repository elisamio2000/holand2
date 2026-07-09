'use client';

import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import type { BugReportDeliveryChannel } from '../config/bug-report-config';

interface DeliveryChannelSelectorProps {
  value: BugReportDeliveryChannel;
  onChange: (channel: BugReportDeliveryChannel) => void;
  className?: string;
}

export default function DeliveryChannelSelector({
  value,
  onChange,
  className,
}: DeliveryChannelSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('space-y-2', className)}>
      <Text className="text-xs font-semibold text-gray-500">
        {t('messages.bugReport.deliveryChannel', 'Delivery Method')}
      </Text>
      <div className="flex flex-wrap gap-2">
        {(['email', 'chat'] as const).map((channel) => (
          <button
            key={channel}
            type="button"
            onClick={() => onChange(channel)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              value === channel
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-muted bg-gray-0 text-gray-600 hover:bg-gray-50 dark:bg-gray-50 dark:text-gray-400'
            )}
          >
            {channel === 'email'
              ? t('messages.bugReport.channelEmail', 'Email (Recommended)')
              : t('messages.bugReport.channelChat', 'Chat Message')}
          </button>
        ))}
      </div>
    </div>
  );
}
