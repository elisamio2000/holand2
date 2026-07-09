// ============================================
// FileInfoCard — نمایش اطلاعات پایه فایل
// ============================================

'use client';

import { Badge, Text, Title } from 'rizzui';
import { PiFileBold, PiCalendarBold, PiHardDrivesBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { FileMetaResult } from '../file-meta-types';

interface FileInfoCardProps {
  data: FileMetaResult;
  className?: string;
}

/**
 * کارت اطلاعات اولیه فایل.
 * نمایش نام، اندازه، نوع، تاریخ‌ها و SHA256.
 */
export default function FileInfoCard({ data, className }: FileInfoCardProps) {
  // فرمت اندازه فایل
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // فرمت تاریخ
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'نامشخص';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  // رنگ Badge بر اساس نوع فایل
  const getKindColor = (kind: string): 'success' | 'info' | 'warning' | 'danger' => {
    switch (kind) {
      case 'image':
        return 'success';
      case 'audio':
        return 'info';
      case 'video':
        return 'warning';
      default:
        return 'danger';
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
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-lighter/20 dark:bg-primary-dark/20">
            <PiFileBold className="h-6 w-6 text-primary" />
          </div>
          <div>
            <Title as="h4" className="text-base font-semibold text-gray-900 dark:text-gray-700">
              {data.filename}
            </Title>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              {data.mime_type || 'نامشخص'}
            </Text>
          </div>
        </div>
        <Badge variant="flat" color={getKindColor(data.kind)} className="capitalize">
          {data.kind}
        </Badge>
      </div>

      {/* Grid اطلاعات */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Size */}
        <div className="flex items-center gap-2">
          <PiHardDrivesBold className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">اندازه</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {formatSize(data.size_bytes)}
            </Text>
          </div>
        </div>

        {/* Modified Date */}
        {data.modified_at && (
          <div className="flex items-center gap-2">
            <PiCalendarBold className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <Text className="text-xs text-gray-500 dark:text-gray-400">تاریخ تغییر</Text>
              <Text className="font-medium text-gray-900 dark:text-gray-700">
                {formatDate(data.modified_at)}
              </Text>
            </div>
          </div>
        )}

        {/* Created Date */}
        {data.created_at && (
          <div className="flex items-center gap-2">
            <PiCalendarBold className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <Text className="text-xs text-gray-500 dark:text-gray-400">تاریخ ایجاد</Text>
              <Text className="font-medium text-gray-900 dark:text-gray-700">
                {formatDate(data.created_at)}
              </Text>
            </div>
          </div>
        )}

        {/* Accessed Date */}
        {data.accessed_at && (
          <div className="flex items-center gap-2">
            <PiCalendarBold className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <Text className="text-xs text-gray-500 dark:text-gray-400">آخرین دسترسی</Text>
              <Text className="font-medium text-gray-900 dark:text-gray-700">
                {formatDate(data.accessed_at)}
              </Text>
            </div>
          </div>
        )}

        {/* Parent Directory */}
        {data.parent_dir && (
          <div className="flex items-center gap-2">
            <PiFileBold className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <Text className="text-xs text-gray-500 dark:text-gray-400">پوشه</Text>
              <Text className="font-medium text-gray-900 dark:text-gray-700" title={data.parent_dir}>
                {data.parent_dir}
              </Text>
            </div>
          </div>
        )}

        {/* Symlink */}
        {data.is_symlink !== undefined && (
          <div className="flex items-center gap-2">
            <PiFileBold className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <Text className="text-xs text-gray-500 dark:text-gray-400">Symlink</Text>
              <Text className="font-medium text-gray-900 dark:text-gray-700">
                {data.is_symlink ? 'بله' : 'خیر'}
              </Text>
            </div>
          </div>
        )}

        {/* Encoding (برای فایل‌های متنی) */}
        {data.encoding && (
          <div className="flex items-center gap-2">
            <PiFileBold className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <Text className="text-xs text-gray-500 dark:text-gray-400">Encoding</Text>
              <Text className="font-medium text-gray-900 dark:text-gray-700">
                {data.encoding}
              </Text>
            </div>
          </div>
        )}
      </div>

      {/* SHA256 */}
      {data.sha256 && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
          <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">SHA256</Text>
          <code className="block break-all font-mono text-xs text-gray-700 dark:text-gray-300">
            {data.sha256}
          </code>
        </div>
      )}
    </div>
  );
}
