'use client';

import { MediaLoadError } from '@/components/media-playback/components/media-load-error';
import type { VideoPlaybackStatus } from '@/components/video-player/types';

interface VideoErrorStateProps {
  status: VideoPlaybackStatus;
  format?: string;
  onRetry?: () => void;
  onDownload?: () => void;
  className?: string;
}

export function VideoErrorState({
  status,
  format,
  onRetry,
  onDownload,
  className,
}: VideoErrorStateProps) {
  return (
    <MediaLoadError
      kind="video"
      unsupported={status === 'unsupported'}
      format={format}
      onRetry={onRetry}
      onDownload={onDownload}
      className={className}
    />
  );
}
