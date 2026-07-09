'use client';

import cn from '@core/utils/class-names';
import type { MessageDeliveryStatus } from '@/types/messages.types';

type MessageStatusIndicatorProps = {
  status?: MessageDeliveryStatus;
  read?: boolean;
  className?: string;
};

export default function MessageStatusIndicator({
  status,
  read,
  className,
}: MessageStatusIndicatorProps) {
  const resolved: MessageDeliveryStatus =
    status ?? (read ? 'read' : 'sent');

  const icons: Record<MessageDeliveryStatus, string> = {
    sending: '○',
    sent: '✓',
    delivered: '✓✓',
    read: '✓✓',
    failed: '!',
  };

  return (
    <span
      className={cn(
        'text-[10px] font-medium',
        resolved === 'read' && 'text-primary',
        resolved === 'failed' && 'text-red-500',
        resolved === 'sending' && 'text-gray-400 animate-pulse',
        className
      )}
      title={resolved}
    >
      {icons[resolved]}
    </span>
  );
}
