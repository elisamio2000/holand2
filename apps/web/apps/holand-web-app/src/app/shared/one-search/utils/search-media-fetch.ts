// ============================================
// One Search — cancel pending media fetches on new query
// ============================================

import { shareTokenQueue, thumbnailQueue } from '@/utils/request-queue';

/** Drop queued (not yet running) thumbnail/share-token tasks when search changes. */
export function cancelSearchMediaQueues(): void {
  thumbnailQueue.cancelPending();
  shareTokenQueue.cancelPending();
}
