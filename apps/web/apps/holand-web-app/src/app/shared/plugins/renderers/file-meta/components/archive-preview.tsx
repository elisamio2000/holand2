// ============================================
// ArchivePreview — نمایش محتویات آرشیو
// ============================================

'use client';

import { Badge, Table, Text, Title } from 'rizzui';
import { PiArchiveBold, PiFolderBold, PiFileBold, PiLockKeyBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { ArchiveMetadata } from '../file-meta-types';

interface ArchivePreviewProps {
  archive: ArchiveMetadata;
  className?: string;
}

/**
 * بخش پیش‌نمایش محتویات آرشیو.
 */
export default function ArchivePreview({ archive, className }: ArchivePreviewProps) {
  // فرمت اندازه
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
        <PiArchiveBold className="h-6 w-6 text-orange-500" />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          محتویات آرشیو
        </Title>
        <Badge variant="flat" color="secondary" className="mr-auto uppercase">
          {archive.archive_type}
        </Badge>
        {archive.is_encrypted && (
          <Badge variant="flat" color="danger">
            <PiLockKeyBold className="ml-1" />
            رمزگذاری شده
          </Badge>
        )}
      </div>

      {/* خلاصه */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div>
          <Text className="text-xs text-gray-500 dark:text-gray-400">تعداد فایل</Text>
          <Text className="font-medium text-gray-900 dark:text-gray-700">
            {archive.entry_count.toLocaleString('fa-IR')}
          </Text>
        </div>

        {archive.compression_method && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">روش فشرده‌سازی</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {archive.compression_method}
            </Text>
          </div>
        )}
      </div>

      {/* جدول فایل‌ها */}
      {archive.entries_preview && archive.entries_preview.length > 0 && (
        <div className="rounded-lg border border-muted">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head className="text-right">نام</Table.Head>
                <Table.Head className="text-right">اندازه</Table.Head>
                <Table.Head className="text-right">نوع</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {archive.entries_preview.map((entry, idx) => (
                <Table.Row key={idx}>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      {entry.is_dir ? (
                        <PiFolderBold className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <PiFileBold className="h-4 w-4 text-gray-400" />
                      )}
                      <Text className="truncate font-mono text-xs text-gray-900 dark:text-gray-700">
                        {entry.name}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-xs text-gray-600 dark:text-gray-400">
                      {entry.is_dir ? '—' : formatSize(entry.size)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="flat" size="sm" color={entry.is_dir ? 'warning' : 'secondary'}>
                      {entry.is_dir ? 'پوشه' : 'فایل'}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {archive.entry_count > archive.entries_preview.length && (
            <div className="border-t border-muted p-3 text-center">
              <Text className="text-xs text-gray-600 dark:text-gray-400">
                {archive.entry_count - archive.entries_preview.length} فایل دیگر...
              </Text>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
