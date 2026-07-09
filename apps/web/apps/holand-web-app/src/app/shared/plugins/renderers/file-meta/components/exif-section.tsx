// ============================================
// ExifSection — نمایش متادیتای تصویر (EXIF)
// ============================================

'use client';

import { useState } from 'react';
import { Badge, Button, Text, Title } from 'rizzui';
import { PiCameraBold, PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { ImageMetadata } from '../file-meta-types';

interface ExifSectionProps {
  exif: ImageMetadata;
  className?: string;
}

/**
 * بخش نمایش EXIF و اطلاعات تصویر.
 */
export default function ExifSection({ exif, className }: ExifSectionProps) {
  const [showRawExif, setShowRawExif] = useState(false);
  const [showExifTool, setShowExifTool] = useState(false);
  const [showMakerNotes, setShowMakerNotes] = useState(false);
  const [showXmp, setShowXmp] = useState(false);
  const [showIptc, setShowIptc] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <PiCameraBold className="h-6 w-6 text-blue-500" />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          اطلاعات تصویر
        </Title>
        {exif.is_edited && (
          <Badge variant="flat" color="warning" className="mr-auto">
            ویرایش شده
          </Badge>
        )}
      </div>

      {/* Grid اطلاعات اصلی */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        {/* Dimensions */}
        {exif.width && exif.height && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">ابعاد</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.width} × {exif.height}
            </Text>
          </div>
        )}

        {/* Format */}
        {exif.format && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">فرمت</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.format}
            </Text>
          </div>
        )}

        {/* Mode */}
        {exif.mode && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">حالت رنگی</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.mode}
            </Text>
          </div>
        )}

        {/* Camera Make */}
        {exif.camera_make && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">سازنده دوربین</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.camera_make}
            </Text>
          </div>
        )}

        {/* Camera Model */}
        {exif.camera_model && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">مدل دوربین</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.camera_model}
            </Text>
          </div>
        )}

        {/* Software */}
        {exif.software && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">نرم‌افزار</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.software}
            </Text>
          </div>
        )}

        {/* Date Taken */}
        {exif.date_taken && (
          <div className="col-span-2 md:col-span-3">
            <Text className="text-xs text-gray-500 dark:text-gray-400">تاریخ گرفتن عکس</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {new Date(exif.date_taken).toLocaleString('fa-IR')}
            </Text>
          </div>
        )}

        {/* Orientation */}
        {exif.orientation !== undefined && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">جهت</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.orientation}
            </Text>
          </div>
        )}

        {/* Lens Model (ExifTool) */}
        {exif.lens_model && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">مدل لنز</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.lens_model}
            </Text>
          </div>
        )}

        {/* Serial Number (ExifTool) */}
        {exif.serial_number && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">شماره سریال</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.serial_number}
            </Text>
          </div>
        )}

        {/* Shutter Count (ExifTool) */}
        {exif.shutter_count !== undefined && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">شمارش شاتر</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.shutter_count.toLocaleString('fa-IR')}
            </Text>
          </div>
        )}

        {/* Focus Mode (ExifTool) */}
        {exif.focus_mode && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">حالت فوکوس</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {exif.focus_mode}
            </Text>
          </div>
        )}
      </div>

      {/* EXIF خام */}
      {exif.exif_raw && Object.keys(exif.exif_raw).length > 0 && (
        <div className="mb-2">
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowRawExif(!showRawExif)}
            className="text-gray-700 dark:text-gray-300"
          >
            {showRawExif ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            EXIF خام ({Object.keys(exif.exif_raw).length} فیلد)
          </Button>
          {showRawExif && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(exif.exif_raw, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* MakerNotes (ExifTool) */}
      {exif.maker_notes && Object.keys(exif.maker_notes).length > 0 && (
        <div className="mb-2">
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowMakerNotes(!showMakerNotes)}
            className="text-gray-700 dark:text-gray-300"
          >
            {showMakerNotes ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            MakerNotes ({Object.keys(exif.maker_notes).length} فیلد)
          </Button>
          {showMakerNotes && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(exif.maker_notes, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* XMP (Adobe) */}
      {exif.xmp && Object.keys(exif.xmp).length > 0 && (
        <div className="mb-2">
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowXmp(!showXmp)}
            className="text-gray-700 dark:text-gray-300"
          >
            {showXmp ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            XMP (Adobe) ({Object.keys(exif.xmp).length} فیلد)
          </Button>
          {showXmp && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(exif.xmp, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* IPTC */}
      {exif.iptc && Object.keys(exif.iptc).length > 0 && (
        <div className="mb-2">
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowIptc(!showIptc)}
            className="text-gray-700 dark:text-gray-300"
          >
            {showIptc ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            IPTC ({Object.keys(exif.iptc).length} فیلد)
          </Button>
          {showIptc && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(exif.iptc, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ExifTool پیشرفته */}
      {exif.exiftool && Object.keys(exif.exiftool).length > 0 && (
        <div>
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowExifTool(!showExifTool)}
            className="text-gray-700 dark:text-gray-300"
          >
            {showExifTool ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            ExifTool پیشرفته ({Object.keys(exif.exiftool).length} فیلد)
          </Button>
          {showExifTool && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(exif.exiftool, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
