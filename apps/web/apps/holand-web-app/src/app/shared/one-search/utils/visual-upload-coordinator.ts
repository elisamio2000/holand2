// ============================================
// One Search — serialize visual uploads (rate-limit protection)
// ============================================

import { uploadImageForVisualSearch } from './visual-search-upload';
import type { OneSearchQueryImage } from '@/types/one-search.types';

const MIN_UPLOAD_INTERVAL_MS = 900;

let uploadGeneration = 0;
let lastUploadFinishedAt = 0;
let inFlight: Promise<OneSearchQueryImage> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Drop in-flight upload intent when user picks a newer file. */
export function cancelPendingVisualUploads(): void {
  uploadGeneration += 1;
  inFlight = null;
}

/**
 * Queue visual uploads: one at a time, paced interval, latest file wins.
 */
export async function queueVisualSearchUpload(file: File): Promise<OneSearchQueryImage> {
  const gen = ++uploadGeneration;

  const since = Date.now() - lastUploadFinishedAt;
  if (since < MIN_UPLOAD_INTERVAL_MS) {
    await sleep(MIN_UPLOAD_INTERVAL_MS - since);
  }
  if (gen !== uploadGeneration) {
    throw new DOMException('Upload superseded by a newer selection', 'AbortError');
  }

  const run = uploadImageForVisualSearch(file).finally(() => {
    lastUploadFinishedAt = Date.now();
    if (inFlight === run) inFlight = null;
  });

  inFlight = run;
  return run;
}
