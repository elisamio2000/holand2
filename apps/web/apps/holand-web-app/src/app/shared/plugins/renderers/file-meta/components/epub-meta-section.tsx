// ============================================
// EpubMetaSection — نمایش متادیتای EPUB
// ============================================

'use client';

import { useState } from 'react';
import { Button, Text, Title } from 'rizzui';
import { PiBookOpenBold, PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { EpubMetadata } from '../file-meta-types';

interface EpubMetaSectionProps {
  epub: EpubMetadata;
  className?: string;
}

/**
 * بخش نمایش متادیتای کتاب الکترونیک EPUB.
 */
export default function EpubMetaSection({ epub, className }: EpubMetaSectionProps) {
  const [showTOC, setShowTOC] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <PiBookOpenBold className="h-6 w-6 text-indigo-500" />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          متادیتای EPUB
        </Title>
      </div>

      {/* Grid اطلاعات */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Title */}
        {epub.title && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">عنوان</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {epub.title}
            </Text>
          </div>
        )}

        {/* Authors */}
        {epub.authors && epub.authors.length > 0 && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">نویسنده(ها)</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {epub.authors.join(', ')}
            </Text>
          </div>
        )}

        {/* Publisher */}
        {epub.publisher && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">ناشر</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {epub.publisher}
            </Text>
          </div>
        )}

        {/* Language */}
        {epub.language && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">زبان</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {epub.language}
            </Text>
          </div>
        )}

        {/* ISBN */}
        {epub.isbn && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">ISBN</Text>
            <Text className="font-mono font-medium text-gray-900 dark:text-gray-700">
              {epub.isbn}
            </Text>
          </div>
        )}

        {/* Published */}
        {epub.published && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">تاریخ انتشار</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {epub.published}
            </Text>
          </div>
        )}
      </div>

      {/* Description */}
      {epub.description && (
        <div className="mt-3">
          <Text className="text-xs text-gray-500 dark:text-gray-400">توضیحات</Text>
          <Text className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {epub.description}
          </Text>
        </div>
      )}

      {/* Table of Contents */}
      {epub.toc && epub.toc.length > 0 && (
        <>
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowTOC(!showTOC)}
            className="mt-3 text-gray-700 dark:text-gray-300"
          >
            {showTOC ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            فهرست مطالب ({epub.toc.length})
          </Button>

          {showTOC && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {epub.toc.map((chapter, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                    <span>{chapter}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
