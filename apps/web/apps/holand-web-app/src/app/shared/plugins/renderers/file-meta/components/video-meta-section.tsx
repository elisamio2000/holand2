// ============================================
// VideoMetaSection — نمایش متادیتای ویدیویی
// ============================================

'use client';

import { useState } from 'react';
import { Button, Text, Title } from 'rizzui';
import { PiVideoBold, PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { VideoMetadata } from '../file-meta-types';

interface VideoMetaSectionProps {
  video: VideoMetadata;
  className?: string;
}

/**
 * بخش نمایش متادیتای ویدیویی.
 */
export default function VideoMetaSection({ video, className }: VideoMetaSectionProps) {
  const [showStreams, setShowStreams] = useState(false);

  // فرمت مدت زمان
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'نامشخص';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        <PiVideoBold className="h-6 w-6 text-red-500" />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          اطلاعات ویدیویی
        </Title>
      </div>

      {/* Grid اطلاعات */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        {/* Duration */}
        {video.duration !== undefined && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">مدت زمان</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {formatDuration(video.duration)}
            </Text>
          </div>
        )}

        {/* Resolution */}
        {video.width && video.height && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">رزولوشن</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {video.width} × {video.height}
            </Text>
          </div>
        )}

        {/* FPS */}
        {video.fps && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">نرخ فریم</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {video.fps.toFixed(2)} fps
            </Text>
          </div>
        )}

        {/* Video Codec */}
        {video.video_codec && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">Codec ویدیو</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {video.video_codec}
            </Text>
          </div>
        )}

        {/* Audio Codec */}
        {video.audio_codec && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">Codec صوت</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {video.audio_codec}
            </Text>
          </div>
        )}

        {/* Bitrate */}
        {video.bitrate && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">Bitrate</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {Math.round(video.bitrate)} kbps
            </Text>
          </div>
        )}
      </div>

      {/* استریم‌ها */}
      {video.streams && video.streams.length > 0 && (
        <div>
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowStreams(!showStreams)}
            className="text-gray-700 dark:text-gray-300"
          >
            {showStreams ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            استریم‌ها ({video.streams.length})
          </Button>
          {showStreams && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(video.streams, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
