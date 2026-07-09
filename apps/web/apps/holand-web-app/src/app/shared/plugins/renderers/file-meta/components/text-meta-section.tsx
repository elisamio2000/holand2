// ============================================
// TextMetaSection — نمایش متادیتای متنی
// ============================================

'use client';

import { useState } from 'react';
import { Badge, Button, Text, Title } from 'rizzui';
import { PiFileTextBold, PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { TextMetadata } from '../file-meta-types';

interface TextMetaSectionProps {
  text: TextMetadata;
  className?: string;
}

/**
 * بخش نمایش متادیتای فایل متنی.
 */
export default function TextMetaSection({ text, className }: TextMetaSectionProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <PiFileTextBold className="h-6 w-6 text-blue-500" />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          متادیتای متن
        </Title>
        {text.truncated && (
          <Badge variant="flat" color="warning" className="mr-auto">
            برش داده شده
          </Badge>
        )}
      </div>

      {/* Grid اطلاعات */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Line Count */}
        {text.line_count !== undefined && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">تعداد خطوط</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {text.line_count.toLocaleString('fa-IR')}
            </Text>
          </div>
        )}

        {/* Word Count */}
        {text.word_count !== undefined && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">تعداد کلمات</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {text.word_count.toLocaleString('fa-IR')}
            </Text>
          </div>
        )}

        {/* Char Count */}
        {text.char_count !== undefined && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">تعداد کاراکتر</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {text.char_count.toLocaleString('fa-IR')}
            </Text>
          </div>
        )}

        {/* Encoding */}
        {text.encoding && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">Encoding</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {text.encoding}
            </Text>
          </div>
        )}
      </div>

      {/* Preview */}
      {text.preview && (
        <>
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="text-gray-700 dark:text-gray-300"
          >
            {showPreview ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            پیش‌نمایش محتوا
          </Button>

          {showPreview && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300">
                {text.preview}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
