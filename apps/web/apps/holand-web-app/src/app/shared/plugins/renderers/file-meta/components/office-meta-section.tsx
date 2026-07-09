// ============================================
// OfficeMetaSection — نمایش متادیتای Office
// ============================================

'use client';

import { useState } from 'react';
import { Button, Text, Title } from 'rizzui';
import { PiFileTextBold, PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { OfficeMetadata } from '../file-meta-types';

interface OfficeMetaSectionProps {
  office: OfficeMetadata;
  className?: string;
}

/**
 * بخش نمایش متادیتای اسناد Microsoft Office.
 */
export default function OfficeMetaSection({ office, className }: OfficeMetaSectionProps) {
  const [showProperties, setShowProperties] = useState(false);

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'نامشخص';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <PiFileTextBold className="h-6 w-6 text-blue-600" />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          متادیتای Office
        </Title>
        {office.doc_type && (
          <span className="mr-auto text-sm text-gray-500">
            {office.doc_type}
          </span>
        )}
      </div>

      {/* Grid اطلاعات */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Title */}
        {office.title && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">عنوان</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {office.title}
            </Text>
          </div>
        )}

        {/* Author */}
        {office.author && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">نویسنده</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {office.author}
            </Text>
          </div>
        )}

        {/* Subject */}
        {office.subject && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">موضوع</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {office.subject}
            </Text>
          </div>
        )}

        {/* Keywords */}
        {office.keywords && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">کلمات کلیدی</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {office.keywords}
            </Text>
          </div>
        )}

        {/* Created */}
        {office.created && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">تاریخ ایجاد</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {formatDate(office.created)}
            </Text>
          </div>
        )}

        {/* Modified */}
        {office.modified && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">تاریخ تغییر</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {formatDate(office.modified)}
            </Text>
          </div>
        )}

        {/* Page Count */}
        {office.page_count !== undefined && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">تعداد صفحات</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {office.page_count}
            </Text>
          </div>
        )}
      </div>

      {/* Raw Properties */}
      {office.properties && Object.keys(office.properties).length > 0 && (
        <>
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowProperties(!showProperties)}
            className="mt-3 text-gray-700 dark:text-gray-300"
          >
            {showProperties ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            خصوصیات کامل
          </Button>

          {showProperties && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(office.properties, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
