'use client';

import VideoPlayer from './index';
import { useVideoPlayerSessionStore } from './store/video-player-session-store';

/**
 * Global in-app PiP dock — mirror-only chrome bound to MPS session when available.
 * Native browser PiP does not mount here (handled by requestVideoPiP).
 */
export function GlobalVideoPlayerHost() {
  const pipSession = useVideoPlayerSessionStore((s) => s.pipSession);
  const closePip = useVideoPlayerSessionStore((s) => s.closePip);

  const payload = pipSession.payload;
  if (!pipSession.active || pipSession.mode !== 'in-app' || !payload) return null;
  if (!payload.mediaSessionId && !payload.src) return null;

  return (
    <VideoPlayer
      src={payload.src ?? ''}
      poster={payload.poster}
      title={payload.title}
      mimeType={payload.mimeType}
      artifactId={payload.artifactId}
      mediaSessionId={payload.mediaSessionId}
      initialCurrentTime={payload.initialCurrentTime}
      initialIsPlaying={payload.initialIsPlaying}
      variant="pip"
      enablePiP
      onClose={() => {
        payload.onClose?.();
        closePip();
      }}
    />
  );
}
