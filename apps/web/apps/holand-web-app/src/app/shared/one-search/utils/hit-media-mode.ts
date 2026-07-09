// ============================================
// One Search — shared media mode matching for views
// ============================================

import type { OneSearchHit, OneSearchMode } from '@/types/one-search.types';
import { inferHitMediaType, inferHitMime } from './normalize-search-hits';

export function hitMatchesSearchMode(
  hit: OneSearchHit,
  mode: Exclude<OneSearchMode, 'all' | 'text' | 'file'>
): boolean {
  const mediaType = inferHitMediaType(hit);
  const mime = inferHitMime(hit);
  if (mode === 'image') return mediaType === 'image' || mime.startsWith('image/');
  if (mode === 'audio') return mediaType === 'audio' || mime.includes('audio');
  if (mode === 'video') return mediaType === 'video' || mime.startsWith('video/');
  return false;
}
