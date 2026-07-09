import { storageService } from '@/services/storage.service';
import type { FilmstripSpriteMeta } from '../timeline/filmstrip-timeline';
import type { VideoChapter, VideoSubtitleTrack } from '../types';

/** Load chapter markers for advanced mode (404 → empty list). */
export async function loadArtifactChapters(artifactId: string): Promise<VideoChapter[]> {
  return storageService.fetchArtifactChapters(artifactId);
}

/** Load VTT subtitle tracks for advanced mode (404 → empty list). */
export async function loadArtifactSubtitles(artifactId: string): Promise<VideoSubtitleTrack[]> {
  return storageService.fetchArtifactSubtitles(artifactId);
}

/** Load filmstrip sprite meta (404 → null, FE uses offscreen sampler). */
export async function loadArtifactFilmstrip(
  artifactId: string,
  intervalSec = 10,
  width = 160
): Promise<FilmstripSpriteMeta | null> {
  return storageService.fetchArtifactFilmstrip(artifactId, intervalSec, width);
}
