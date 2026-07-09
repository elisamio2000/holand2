// ============================================
// FileMetaRenderer — پلاگین استخراج متادیتای فایل
//
// Renderer اصلی که PluginUIProps را پیاده‌سازی می‌کند.
// ============================================

'use client';

import { useMemo } from 'react';
import { Alert, Empty, Loader } from 'rizzui';
import { PiWarningBold, PiFileBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { PluginUIProps } from '../../plugin-ui-types';
import type { FileMetaResult } from './file-meta-types';

// Sub-components
import FileInfoCard from './components/file-info-card';
import ExifSection from './components/exif-section';
import GpsMapSection from './components/gps-map-section';
import AudioMetaSection from './components/audio-meta-section';
import VideoMetaSection from './components/video-meta-section';
import ArchivePreview from './components/archive-preview';
import XattrsSection from './components/xattrs-section';
import HiddenDataSection from './components/hidden-data-section';
import TextMetaSection from './components/text-meta-section';
import OfficeMetaSection from './components/office-meta-section';
import EpubMetaSection from './components/epub-meta-section';

/**
 * FileMetaRenderer — Native Plugin برای file.meta
 *
 * نمایش کامل متادیتای فایل شامل:
 * - اطلاعات پایه (نام، اندازه، SHA256، تاریخ‌ها، parent_dir، accessed_at، symlink)
 * - EXIF (برای تصاویر) + فیلدهای پیشرفته ExifTool (lens_model, serial_number, etc.)
 * - GPS Location (نمایش با MapCore — نقشه مرکزی پروژه)
 * - متادیتای صوتی (mutagen + ffprobe)
 * - متادیتای ویدیویی (ffprobe streams)
 * - محتویات آرشیو (ZIP, TAR, RAR, 7z)
 * - Extended Attributes (xattr) — ویژگی‌های پیشرفته فایل
 * - Hidden Data (Binwalk) — شناسایی داده‌های مخفی/استگانوگرافی
 * - متادیتای متنی (line_count, word_count, encoding, preview)
 * - متادیتای Office (Word, Excel, PowerPoint)
 * - متادیتای EPUB (کتاب‌های الکترونیکی)
 * - متادیتای SQLite
 *
 * @implements {PluginUIProps}
 */
export default function FileMetaRenderer({
  result,
  isRunning,
  readOnly = false,
  onSendToChat,
  className,
}: PluginUIProps) {
  // Parse result data
  const data = useMemo(() => {
    if (!result || !result.data) return null;
    return result.data as unknown as FileMetaResult;
  }, [result]);

  // Parse warnings
  const warnings = useMemo(() => {
    if (!result || !result.warnings) return [];
    return result.warnings as string[];
  }, [result]);

  // Loading state
  if (isRunning) {
    return (
      <div className={cn('flex min-h-[300px] items-center justify-center', className)}>
        <div className="text-center">
          <Loader variant="spinner" size="xl" className="mx-auto mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            در حال استخراج متادیتا...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data) {
    return (
      <div className={cn('flex min-h-[300px] items-center justify-center', className)}>
        <Empty
          image={<PiFileBold className="mx-auto h-16 w-16 text-gray-400" />}
          text="هیچ فایلی آپلود نشده"
          textClassName="text-gray-600 dark:text-gray-400"
        />
      </div>
    );
  }

  // Denormalized / summary shapes (e.g. plugin.file_manager.detail `metadata`) are not FileMetaResult.
  if (!data.metadata || typeof data.metadata !== 'object') {
    return (
      <div className={cn('space-y-3', className)}>
        <Alert color="info">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            این داده ساختار کامل خروجی ابزار <code className="text-xs">file.meta</code> نیست (مثلاً خلاصه از
            file_manager). برای UI کامل، ابزار را از صفحهٔ پلاگین یا مسیر اجرای ابزار اجرا کنید.
          </p>
        </Alert>
        <pre className="max-h-96 overflow-auto rounded-lg border border-muted bg-gray-50 p-4 text-xs leading-relaxed text-gray-800 dark:bg-gray-900 dark:text-gray-200">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert color="warning" className="mb-4">
          <div className="flex items-start gap-2">
            <PiWarningBold className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="mb-1 font-semibold">هشدارها:</p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {warnings.map((warn, idx) => (
                  <li key={idx} className="text-gray-700 dark:text-gray-300">
                    {warn}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Alert>
      )}

      {/* اطلاعات پایه فایل */}
      <FileInfoCard data={data} />

      {/* GPS Location — اگر موجود باشد */}
      {data.location && <GpsMapSection location={data.location} />}

      {/* متادیتای تصویر (EXIF) */}
      {data.metadata?.image && <ExifSection exif={data.metadata.image} />}

      {/* متادیتای صوتی */}
      {data.metadata?.audio && <AudioMetaSection audio={data.metadata.audio} />}

      {/* متادیتای ویدیویی */}
      {data.metadata?.video && <VideoMetaSection video={data.metadata.video} />}

      {/* محتویات آرشیو */}
      {data.metadata?.archive && <ArchivePreview archive={data.metadata.archive} />}

      {/* Extended Attributes (xattr) */}
      {data.xattrs && Object.keys(data.xattrs).length > 0 && (
        <XattrsSection xattrs={data.xattrs} />
      )}

      {/* Hidden Data (Binwalk) */}
      {data.hidden_data && data.hidden_data.hit_count > 0 && (
        <HiddenDataSection hiddenData={data.hidden_data} />
      )}

      {/* متادیتای متنی */}
      {data.metadata?.text && <TextMetaSection text={data.metadata.text} />}

      {/* متادیتای Office */}
      {data.metadata?.office && <OfficeMetaSection office={data.metadata.office} />}

      {/* متادیتای EPUB */}
      {data.metadata?.epub && <EpubMetaSection epub={data.metadata.epub} />}

      {/* متادیتای سند (fallback برای انواع دیگر) */}
      {data.metadata?.document && (
        <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
          <p className="mb-2 font-semibold text-gray-900 dark:text-gray-700">
            اطلاعات سند
          </p>
          <pre className="overflow-auto text-xs text-gray-700 dark:text-gray-300">
            {JSON.stringify(data.metadata.document, null, 2)}
          </pre>
        </div>
      )}

      {/* متادیتای SQLite */}
      {data.metadata?.sqlite && (
        <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
          <p className="mb-2 font-semibold text-gray-900 dark:text-gray-700">
            اطلاعات SQLite
          </p>
          <pre className="overflow-auto text-xs text-gray-700 dark:text-gray-300">
            {JSON.stringify(data.metadata.sqlite, null, 2)}
          </pre>
        </div>
      )}

      {/* دکمه ارسال به چت */}
      {onSendToChat && !readOnly && (
        <div className="flex justify-end">
          <button
            onClick={() =>
              onSendToChat({
                summary: `📄 ${data.filename} (${data.kind})`,
                fullText: JSON.stringify(data, null, 2),
                contentType: 'json',
                meta: {
                  filename: data.filename,
                  size: data.size_bytes,
                  mime: data.mime_type,
                  sha256: data.sha256,
                },
              })
            }
            className="rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            ارسال به چت
          </button>
        </div>
      )}
    </div>
  );
}
