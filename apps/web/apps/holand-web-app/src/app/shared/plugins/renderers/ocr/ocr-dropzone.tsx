// ============================================
// OcrDropzone — آپلود و پیش‌نمایش تصویر برای OCR
//
// ویژگی‌ها:
// - Drag & Drop + کلیک برای انتخاب
// - پیش‌نمایش تصویر
// - آپلود به /api/plugins/ocr/upload-temp
// - نمایش progress
// - اعتبارسنجی فرمت (jpg/png/webp/bmp/tiff)
// ============================================
'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Button, Text, Loader } from 'rizzui';
import {
  PiImageBold,
  PiUploadSimpleBold,
  PiXBold,
  PiFileBold,
  PiArrowsClockwiseBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import toast from 'react-hot-toast';
import type { TempUploadedFile } from '../../plugin-ui-types';

// ==========================================
// Constants
// ==========================================

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.gif'];
const ACCEPTED_MIME = [
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/webp',
  'image/tiff',
  'image/gif',
];
const MAX_SIZE_MB = 20;

// ==========================================
// Types
// ==========================================

interface OcrDropzoneProps {
  /** فایل آپلود شده — null یعنی هنوز فایلی نیست */
  uploadedFile: TempUploadedFile | null;
  /** callback وقتی فایل با موفقیت آپلود شد */
  onFileReady: (file: TempUploadedFile) => void;
  /** callback حذف فایل */
  onFileRemove: () => void;
  /** disabled در حالت readOnly یا isRunning */
  disabled?: boolean;
  className?: string;
}

// ==========================================
// File Size Formatter
// ==========================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ==========================================
// Component
// ==========================================

export default function OcrDropzone({
  uploadedFile,
  onFileReady,
  onFileRemove,
  disabled = false,
  className,
}: OcrDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // ==========================================
  // Validation
  // ==========================================

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME.includes(file.type)) {
      return `فرمت ${file.type} پشتیبانی نمی‌شود. فرمت‌های مجاز: ${ACCEPTED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `حجم فایل نباید از ${MAX_SIZE_MB} مگابایت بیشتر باشد`;
    }
    return null;
  };

  // ==========================================
  // Upload Handler
  // ==========================================

  const handleUpload = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/plugins/ocr/upload-temp', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({})) as Record<string, unknown>;
          throw new Error((err.error as string) || 'خطا در آپلود فایل');
        }

        const json = await response.json() as Record<string, unknown>;
        const result: TempUploadedFile = (json.file ?? json) as TempUploadedFile;
        onFileReady(result);
        toast.success('تصویر با موفقیت بارگذاری شد');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'خطا در آپلود';
        toast.error(msg);
        console.error('[OcrDropzone] Upload failed:', err);
      } finally {
        setIsUploading(false);
      }
    },
    [onFileReady]
  );

  // ==========================================
  // Drag & Drop Handlers
  // ==========================================

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  // ==========================================
  // Render: Has File
  // ==========================================

  if (uploadedFile) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border border-muted bg-gray-0 dark:bg-gray-50',
          className
        )}
      >
        {/* Image Preview */}
        <div className="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-200/10">
          {uploadedFile.previewUrl ? (
            <Image
              src={uploadedFile.previewUrl}
              alt={uploadedFile.originalName}
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <PiImageBold className="h-12 w-12 text-gray-300 dark:text-gray-600" />
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex items-center justify-between p-3">
          <div className="flex min-w-0 items-center gap-2">
            <PiFileBold className="h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0">
              <Text className="truncate text-sm font-medium">
                {uploadedFile.originalName}
              </Text>
              <Text className="text-xs text-gray-400">
                {formatSize(uploadedFile.sizeBytes)} · {uploadedFile.mimeType}
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-1 ps-2">
            {/* تعویض تصویر */}
            {!disabled && (
              <Button
                size="sm"
                variant="text"
                onClick={() => inputRef.current?.click()}
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                title="تغییر تصویر"
              >
                <PiArrowsClockwiseBold className="h-4 w-4" />
              </Button>
            )}
            {/* حذف */}
            {!disabled && (
              <Button
                size="sm"
                variant="text"
                onClick={onFileRemove}
                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                title="حذف تصویر"
              >
                <PiXBold className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Hidden input for re-upload */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME.join(',')}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </div>
    );
  }

  // ==========================================
  // Render: Drop Zone (Empty)
  // ==========================================

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => !disabled && !isUploading && inputRef.current?.click()}
      className={cn(
        'flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3',
        'rounded-xl border-2 border-dashed transition-colors',
        isDragging
          ? 'border-primary bg-primary/5 dark:bg-primary/10'
          : 'border-muted bg-gray-0 hover:border-primary/50 hover:bg-gray-50 dark:bg-gray-50 dark:hover:bg-gray-100/5',
        (disabled || isUploading) && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      {isUploading ? (
        <>
          <Loader size="lg" variant="spinner" />
          <Text className="text-sm text-gray-500">در حال بارگذاری...</Text>
        </>
      ) : (
        <>
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full',
              isDragging ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-200/10'
            )}
          >
            {isDragging ? (
              <PiUploadSimpleBold className="h-7 w-7 text-primary" />
            ) : (
              <PiImageBold className="h-7 w-7 text-gray-400" />
            )}
          </div>

          <div className="text-center">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isDragging ? 'رها کنید' : 'تصویر را اینجا بکشید'}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-400">
              یا{' '}
              <span className="font-medium text-primary">انتخاب از دیسک</span>
            </Text>
          </div>

          <Text className="text-xs text-gray-400">
            {ACCEPTED_EXTENSIONS.join(', ')} · حداکثر {MAX_SIZE_MB} MB
          </Text>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME.join(',')}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
    </div>
  );
}
