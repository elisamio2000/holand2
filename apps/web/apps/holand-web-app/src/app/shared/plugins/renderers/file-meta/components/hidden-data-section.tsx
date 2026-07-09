// ============================================
// HiddenDataSection — نمایش داده‌های پنهان (binwalk)
// ============================================

'use client';

import { useState } from 'react';
import { Badge, Button, Text, Title } from 'rizzui';
import { PiEyeSlashBold, PiCaretDownBold, PiCaretUpBold, PiWarningBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { HiddenData } from '../file-meta-types';

interface HiddenDataSectionProps {
  hiddenData: HiddenData;
  className?: string;
}

/**
 * بخش نمایش داده‌های پنهان تشخیص داده شده توسط binwalk.
 * این داده‌ها می‌توانند نشانه malware یا steganography باشند.
 */
export default function HiddenDataSection({ hiddenData, className }: HiddenDataSectionProps) {
  const [showDetails, setShowDetails] = useState(hiddenData.suspicious);

  if (!hiddenData || hiddenData.hit_count === 0) return null;

  return (
    <div
      className={cn(
        'rounded-lg border p-6',
        hiddenData.suspicious
          ? 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30'
          : 'border-muted bg-gray-0 dark:bg-gray-50',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <PiEyeSlashBold className={cn('h-6 w-6', hiddenData.suspicious ? 'text-orange-500' : 'text-gray-500')} />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          داده‌های پنهان (binwalk)
        </Title>
        <Badge
          variant="flat"
          color={hiddenData.suspicious ? 'warning' : 'info'}
          className="mr-auto"
        >
          {hiddenData.hit_count} مورد
        </Badge>
      </div>

      {/* Warning */}
      {hiddenData.suspicious && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-orange-100 p-3 dark:bg-orange-900/20">
          <PiWarningBold className="mt-0.5 h-5 w-5 text-orange-600 dark:text-orange-400" />
          <Text className="text-sm text-orange-700 dark:text-orange-300">
            <strong>هشدار:</strong> الگوهای مشکوک تشخیص داده شد. این فایل ممکن است حاوی داده‌های پنهان یا مخرب باشد.
          </Text>
        </div>
      )}

      {/* Toggle Details */}
      <Button
        variant="text"
        size="sm"
        onClick={() => setShowDetails(!showDetails)}
        className="text-gray-700 dark:text-gray-300"
      >
        {showDetails ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
        جزئیات ({hiddenData.binwalk_hits?.length || 0})
      </Button>

      {/* Details */}
      {showDetails && hiddenData.binwalk_hits && (
        <div className="mt-3 space-y-2">
          {hiddenData.binwalk_hits.map((hit, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-muted bg-white p-3 dark:bg-gray-100"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">Offset</Text>
                  <Text className="font-mono text-sm font-medium text-gray-900 dark:text-gray-700">
                    0x{hit.offset.toString(16).toUpperCase()}
                  </Text>
                </div>
                <div className="flex-[2]">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">توضیحات</Text>
                  <Text className="text-sm text-gray-900 dark:text-gray-700">
                    {hit.description}
                  </Text>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
