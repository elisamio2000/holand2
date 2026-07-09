'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { VideoPlayer } from '@/components/video-player';

interface VideoPreviewProps {
  blob: Blob;
  className?: string;
}

/**
 * Bug-report recording preview — uses the global VideoPlayer so recordings get
 * the same professional controls (seek, speed, screenshot, fullscreen) as the
 * rest of the app.
 */
export default function VideoPreview({ blob, className }: VideoPreviewProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  const fileSize = useMemo(() => blob.size, [blob]);

  if (!url) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <VideoPlayer
        src={url}
        variant="full"
        title={t('messages.bugReport.video.preview', 'Video Recording')}
        mimeType={blob.type || 'video/webm'}
        fileSize={fileSize}
        enableFullscreen
        enablePiP
      />
      <Text className="text-xs text-gray-500">
        {t('messages.bugReport.video.hint', 'This video will be included in your bug report')}
      </Text>
    </div>
  );
}
