// ============================================
// AudioMetaSection — نمایش متادیتای صوتی
// ============================================

'use client';

import { useState } from 'react';
import { Button, Text, Title } from 'rizzui';
import { PiMusicNoteBold, PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { AudioMetadata } from '../file-meta-types';

interface AudioMetaSectionProps {
  audio: AudioMetadata;
  className?: string;
}

/**
 * بخش نمایش متادیتای صوتی.
 */
export default function AudioMetaSection({ audio, className }: AudioMetaSectionProps) {
  const [showRawTags, setShowRawTags] = useState(false);
  const [showProbe, setShowProbe] = useState(false);

  // فرمت مدت زمان (ثانیه → mm:ss)
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'نامشخص';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
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
        <PiMusicNoteBold className="h-6 w-6 text-purple-500" />
        <Title as="h5" className="text-base font-semibold text-gray-900 dark:text-gray-700">
          اطلاعات صوتی
        </Title>
      </div>

      {/* Grid اطلاعات */}
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        {/* Duration */}
        {audio.duration !== undefined && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">مدت زمان</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {formatDuration(audio.duration)}
            </Text>
          </div>
        )}

        {/* Bitrate */}
        {audio.bitrate && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">Bitrate</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {Math.round(audio.bitrate)} kbps
            </Text>
          </div>
        )}

        {/* Sample Rate */}
        {audio.sample_rate && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">Sample Rate</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {audio.sample_rate} Hz
            </Text>
          </div>
        )}

        {/* Channels */}
        {audio.channels && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">کانال‌ها</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {audio.channels === 1 ? 'مونو' : audio.channels === 2 ? 'استریو' : audio.channels}
            </Text>
          </div>
        )}

        {/* Codec */}
        {audio.codec && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">Codec</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {audio.codec}
            </Text>
          </div>
        )}

        {/* Title */}
        {audio.title && (
          <div className="col-span-2 md:col-span-3">
            <Text className="text-xs text-gray-500 dark:text-gray-400">عنوان</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {audio.title}
            </Text>
          </div>
        )}

        {/* Artist */}
        {audio.artist && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">هنرمند</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {audio.artist}
            </Text>
          </div>
        )}

        {/* Album */}
        {audio.album && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">آلبوم</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {audio.album}
            </Text>
          </div>
        )}

        {/* Genre */}
        {audio.genre && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">ژانر</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {audio.genre}
            </Text>
          </div>
        )}

        {/* Year */}
        {audio.year && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">سال</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {audio.year}
            </Text>
          </div>
        )}

        {/* Track */}
        {audio.track && (
          <div>
            <Text className="text-xs text-gray-500 dark:text-gray-400">شماره قطعه</Text>
            <Text className="font-medium text-gray-900 dark:text-gray-700">
              {audio.track}
            </Text>
          </div>
        )}
      </div>

      {/* تگ‌های خام */}
      {audio.tags_raw && Object.keys(audio.tags_raw).length > 0 && (
        <div className="mb-2">
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowRawTags(!showRawTags)}
            className="text-gray-700 dark:text-gray-300"
          >
            {showRawTags ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            تگ‌های خام ({Object.keys(audio.tags_raw).length} فیلد)
          </Button>
          {showRawTags && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(audio.tags_raw, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ffprobe */}
      {audio.probe && Object.keys(audio.probe).length > 0 && (
        <div>
          <Button
            variant="text"
            size="sm"
            onClick={() => setShowProbe(!showProbe)}
            className="text-gray-700 dark:text-gray-300"
          >
            {showProbe ? <PiCaretUpBold className="mr-1" /> : <PiCaretDownBold className="mr-1" />}
            ffprobe ({Object.keys(audio.probe).length} فیلد)
          </Button>
          {showProbe && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-100">
              <pre className="text-xs text-gray-700 dark:text-gray-300">
                {JSON.stringify(audio.probe, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
