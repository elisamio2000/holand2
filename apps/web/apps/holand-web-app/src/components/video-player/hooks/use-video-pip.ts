import { useVideoPlayerSessionStore, type VideoPipPayload } from '../store/video-player-session-store';

export type { VideoPipPayload } from '../store/video-player-session-store';

export type VideoPipMode = 'native' | 'in-app';

/**
 * Unified PiP entry — browser native first, MPS-aware in-app dock on fallback.
 * Never clones full player props; passes session id + minimal metadata only.
 */
export async function requestVideoPiP(
  video: HTMLVideoElement | null,
  payload: VideoPipPayload
): Promise<VideoPipMode | null> {
  const store = useVideoPlayerSessionStore.getState();

  if (video && document.pictureInPictureElement === video) {
    await document.exitPictureInPicture?.();
    store.closePip();
    return null;
  }

  const nativeEnabled = typeof document !== 'undefined' && document.pictureInPictureEnabled !== false;

  if (video && nativeEnabled) {
    try {
      await video.requestPictureInPicture();
      store.markNativePip(payload);

      const onLeave = () => {
        video.removeEventListener('leavepictureinpicture', onLeave);
        store.closePip();
        payload.onClose?.();
      };
      video.addEventListener('leavepictureinpicture', onLeave);
      return 'native';
    } catch {
      // Denied or unsupported — fall through to in-app dock.
    }
  }

  store.openInAppPip(payload);
  return 'in-app';
}
