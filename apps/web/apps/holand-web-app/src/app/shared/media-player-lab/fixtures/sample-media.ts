/** Central sample URLs from public/test-media — no JWT required. */

export const SAMPLE_AUDIO = {
  src: '/test-media/female_02.mp3',
  title: 'Lab Sample Audio (female_02)',
  mimeType: 'audio/mpeg',
  /** Bytes on disk — duration is read from media metadata at runtime */
  fileSize: 39_868,
} as const;

/** Shared props for every live lab AudioPlayer — one real file, no mock duration */
export const LAB_AUDIO_PLAYER_PROPS = {
  src: SAMPLE_AUDIO.src,
  title: SAMPLE_AUDIO.title,
  mimeType: SAMPLE_AUDIO.mimeType,
  fileSize: SAMPLE_AUDIO.fileSize,
} as const;

export const SAMPLE_VIDEO = {
  src: '/test-media/test-video.mp4',
  title: 'Lab Sample Video (test-video)',
  mimeType: 'video/mp4',
  duration: 30,
  width: 1280,
  height: 720,
  fileSize: 1_128_375,
} as const;

export const MOCK_ARTIFACT_IDS = {
  audio: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  video: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
} as const;

/** Gateway-style URL for integration scenarios (not fetched when localPreviewUrl is set). */
export function mockGatewaySrc(artifactId: string, filename: string): string {
  return `/api/v1/storage/artifacts/${artifactId}/download/${encodeURIComponent(filename)}`;
}
