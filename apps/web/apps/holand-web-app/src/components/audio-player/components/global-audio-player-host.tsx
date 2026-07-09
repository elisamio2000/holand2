'use client';

import {
  useAudioPlayerPrefs,
  useAudioPlayerSession,
  useStickyControls,
  resolveStickyLayout,
  isStickyBarVisible,
  useAudioPlayerStore,
} from '../store/audio-player-store';
import { StickyVariant } from '../variants/sticky';
import { useMediaSession } from '@/components/media-playback';

/**
 * Global sticky audio bar — mirror/remote UI only (single playback engine on page).
 * When mediaSessionId is linked, playback state mirrors from MPS store.
 */
export function GlobalAudioPlayerHost() {
  const session = useAudioPlayerSession();
  const prefs = useAudioPlayerPrefs();
  const controls = useStickyControls();
  const updatePrefs = useAudioPlayerStore((s) => s.updatePrefs);
  const mpsSession = useMediaSession(session.mediaSessionId);

  const visible = isStickyBarVisible(session);

  if (!visible || !controls) return null;

  const layout = resolveStickyLayout(session.stickyLayout, prefs.stickyLayout);
  const currentTime = mpsSession?.currentTime ?? session.currentTime;
  const duration = mpsSession?.duration ?? session.duration;
  const isPlaying = mpsSession?.isPlaying ?? session.isPlaying;

  return (
    <StickyVariant
      title={session.title}
      currentTime={currentTime}
      duration={duration}
      isPlaying={isPlaying}
      stickyLayout={layout}
      queueIndex={session.queueIndex}
      queueLength={session.queueLength}
      showQueueControls={session.queueLength > 1}
      volume={prefs.volume}
      isMuted={prefs.isMuted}
      playbackRate={prefs.playbackRate}
      isLooping={prefs.isLooping}
      onTogglePlay={() => controls.togglePlay?.()}
      onSeek={(seconds) => controls.seekTo?.(seconds)}
      onPrev={() => controls.onPrev?.()}
      onNext={() => controls.onNext?.()}
      onVolumeChange={(vol) => {
        updatePrefs({ volume: vol, isMuted: vol === 0 });
        controls.onVolumeChange?.(vol);
      }}
      onToggleLoop={() => updatePrefs({ isLooping: !prefs.isLooping })}
      onSpeedChange={(speed) => updatePrefs({ playbackRate: speed })}
    />
  );
}
