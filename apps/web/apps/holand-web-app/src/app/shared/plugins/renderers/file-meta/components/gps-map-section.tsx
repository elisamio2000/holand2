// ============================================
// GpsMapSection — نمایش اطلاعات GPS و نقشه
// نمایش مختصات GPS و نقشه تعاملی با MapCore
// ============================================

'use client';

import { useState } from 'react';
import { Button, Text, Title } from 'rizzui';
import { PiMapPinBold, PiCopyBold, PiCheckBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import type { GpsLocation } from '../file-meta-types';
import SimpleMapViewer from './simple-map-viewer';

interface GpsMapSectionProps {
  location: GpsLocation;
  className?: string;
}

/**
 * بخش نمایش GPS + نقشه.
 *
 * نمایش مختصات جغرافیایی با:
 * - کپی مختصات به clipboard
 * - نقشه تعاملی با MapCore (offline-capable)
 */
export default function GpsMapSection({ location, className }: GpsMapSectionProps) {
  const [copied, setCopied] = useState(false);

  // کپی مختصات به clipboard
  const handleCopy = async () => {
    const coords = `${location.latitude}, ${location.longitude}`;
    try {
      await navigator.clipboard.writeText(coords);
      setCopied(true);
      toast.success('مختصات کپی شد');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('خطا در کپی');
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
        <PiMapPinBold className="h-6 w-6 text-red-500" />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          موقعیت جغرافیایی
        </Title>
      </div>

      {/* Grid اطلاعات */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Latitude */}
        <div>
          <Text className="text-xs text-gray-500 dark:text-gray-400">عرض جغرافیایی</Text>
          <Text className="font-mono font-medium text-gray-900 dark:text-gray-700">
            {location.latitude.toFixed(6)}
          </Text>
        </div>

        {/* Longitude */}
        <div>
          <Text className="text-xs text-gray-500 dark:text-gray-400">طول جغرافیایی</Text>
          <Text className="font-mono font-medium text-gray-900 dark:text-gray-700">
            {location.longitude.toFixed(6)}
          </Text>
        </div>

        {/* Altitude */}
        {location.altitude !== undefined && location.altitude !== null && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">ارتفاع</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {location.altitude} متر
            </Text>
          </div>
        )}

        {/* Source */}
        {location.source && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">منبع</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {location.source}
            </Text>
          </div>
        )}
      </div>

      {/* Copy Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopy}
        className="mb-4"
      >
        {copied ? (
          <>
            <PiCheckBold className="mr-2 h-4 w-4" />
            کپی شد
          </>
        ) : (
          <>
            <PiCopyBold className="mr-2 h-4 w-4" />
            کپی مختصات
          </>
        )}
      </Button>

      {/* Map Viewer */}
      <SimpleMapViewer location={location} height={300} />
    </div>
  );
}
