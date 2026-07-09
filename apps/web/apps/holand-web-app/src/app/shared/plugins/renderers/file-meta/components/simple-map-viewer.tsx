// ============================================
// SimpleMapViewer — نمایش ساده نقشه برای یک GPS location
// ============================================

'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Loader } from 'rizzui';
import type { MapMarker } from '@/app/shared/map';
import type { GpsLocation } from '../file-meta-types';

// Dynamic import برای SSR compatibility
const MapCore = dynamic(() => import('@/app/shared/map').then((mod) => mod.MapCore), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-muted bg-gray-50 dark:bg-gray-100">
      <Loader />
    </div>
  ),
});

interface SimpleMapViewerProps {
  /** اطلاعات GPS location */
  location: GpsLocation;
  /** ارتفاع نقشه (پیش‌فرض: 300px) */
  height?: number;
  /** CSS class اضافی */
  className?: string;
}

/**
 * SimpleMapViewer — نمایش یک marker روی نقشه.
 *
 * استفاده از MapCore به جای iframe embed GoogleMaps/OSM.
 * WHY: یکپارچگی با سیستم نقشه offline پروژه، dark mode support، عدم نیاز به اینترنت.
 *
 * @requires MapCore — هسته مرکزی نقشه پروژه
 */
export default function SimpleMapViewer({ location, height = 300, className }: SimpleMapViewerProps) {
  // تبدیل GPS location به MapMarker
  const marker = useMemo<MapMarker>(() => {
    return {
      id: 'gps-location',
      lat: location.latitude,
      lng: location.longitude,
      color: '#ef4444', // قرمز برای برجسته شدن
      popupHtml: `
        <div style="font-family: system-ui; font-size: 13px; line-height: 1.4;">
          <strong>موقعیت جغرافیایی</strong><br/>
          <span style="color: #6b7280;">عرض:</span> ${location.latitude.toFixed(6)}<br/>
          <span style="color: #6b7280;">طول:</span> ${location.longitude.toFixed(6)}
          ${location.altitude ? `<br/><span style="color: #6b7280;">ارتفاع:</span> ${location.altitude}m` : ''}
          ${location.source ? `<br/><span style="color: #6b7280;">منبع:</span> ${location.source}` : ''}
        </div>
      `,
    };
  }, [location]);

  return (
    <div className={className} style={{ height: `${height}px` }}>
      <MapCore
        markers={[marker]}
        center={[location.longitude, location.latitude]}
        zoom={12}
        minZoom={2}
        maxZoom={18}
        showNavigation
        showScale
        className="h-full w-full rounded-lg overflow-hidden"
      />
    </div>
  );
}
