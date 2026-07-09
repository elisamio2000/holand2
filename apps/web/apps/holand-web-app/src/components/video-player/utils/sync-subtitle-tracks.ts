import type { VideoSubtitleTrack } from '../types';

const resolvedSrcCache = new Map<string, string>();

/**
 * Resolve subtitle src to a browser-playable URL.
 * VTT behind auth must be presigned or same-origin; fetch+blob for gateway paths.
 */
export async function resolveSubtitleTrackSrc(src: string): Promise<string> {
  if (!src) return src;
  if (src.startsWith('blob:') || src.startsWith('data:')) return src;
  const cached = resolvedSrcCache.get(src);
  if (cached) return cached;

  if (src.startsWith('http://') || src.startsWith('https://')) {
    resolvedSrcCache.set(src, src);
    return src;
  }

  const url = src.startsWith('/') ? src : `/${src}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`subtitle_fetch_failed:${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  resolvedSrcCache.set(src, objectUrl);
  return objectUrl;
}

/**
 * Sync `<track>` elements on a shared/external `<video>` for CC.
 * Safe to call after DOM reparent (chat inline ↔ modal).
 */
export async function syncSubtitleTracks(
  video: HTMLVideoElement,
  tracks: VideoSubtitleTrack[],
  activeId: string | null
): Promise<void> {
  const existing = video.querySelectorAll('track[data-vp-sync]');
  existing.forEach((el) => el.remove());

  await Promise.all(
    tracks.map(async (track, index) => {
      if (!track.src) return;
      try {
        const resolved = await resolveSubtitleTrackSrc(track.src);
        const el = document.createElement('track');
        el.kind = track.kind ?? 'subtitles';
        el.label = track.label;
        el.srclang = track.language;
        el.src = resolved;
        el.default = track.default ?? false;
        el.dataset.vpSync = track.id;
        video.appendChild(el);
        const textTrack = video.textTracks[index];
        if (textTrack) {
          textTrack.mode = track.id === activeId ? 'showing' : 'hidden';
        }
      } catch {
        // Skip unavailable tracks (404 until BE ships)
      }
    })
  );

  Array.from(video.textTracks).forEach((tt, i) => {
    const id = tracks[i]?.id;
    tt.mode = id && id === activeId ? 'showing' : 'hidden';
  });
}

export function applyActiveSubtitleMode(
  video: HTMLVideoElement,
  tracks: VideoSubtitleTrack[],
  activeId: string | null
): void {
  Array.from(video.textTracks).forEach((tt, i) => {
    const id = tracks[i]?.id;
    tt.mode = id && id === activeId ? 'showing' : 'hidden';
  });
}
