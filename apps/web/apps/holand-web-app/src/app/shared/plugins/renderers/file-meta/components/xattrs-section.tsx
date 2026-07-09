// ============================================
// XattrsSection — نمایش ویژگی‌های افزوده سیستم عامل
// ============================================

'use client';

import { useState } from 'react';
import { Button, Text, Title } from 'rizzui';
import { PiTagBold, PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

interface XattrsSectionProps {
  xattrs: Record<string, unknown>;
  className?: string;
}

/**
 * بخش نمایش ویژگی‌های افزوده فایل (Extended Attributes).
 * این ویژگی‌ها توسط سیستم عامل یا برنامه‌ها به فایل اضافه می‌شوند.
 */
export default function XattrsSection({ xattrs, className }: XattrsSectionProps) {
  const [showRaw, setShowRaw] = useState(false);
  const keys = Object.keys(xattrs);

  if (keys.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <PiTagBold className="h-6 w-6 text-purple-500" />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          ویژگی‌های افزوده (xattr)
        </Title>
        <Text className="mr-auto text-sm text-gray-500">
          {keys.length} ویژگی
        </Text>
      </div>

      {/* Keys List */}
      <div className="mb-3 flex flex-wrap gap-2">
        {keys.map((key) => (
          <span
            key={key}
            className="rounded-md bg-purple-50 px-2 py-1 text-xs font-mono text-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
          >
            {key}
          </span>
        ))}
      </div>

      {/* Toggle Raw Data */}
      <Button
        variant="text"
        size="sm"
        onClick={() => setShowRaw(!showRaw)}
        className="text-gray-700 dark:text-gray-300"
      >
        {showRaw ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
        داده خام
      </Button>

      {/* Raw JSON */}
      {showRaw && (
        <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
          <pre className="text-xs text-gray-700 dark:text-gray-300">
            {JSON.stringify(xattrs, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
