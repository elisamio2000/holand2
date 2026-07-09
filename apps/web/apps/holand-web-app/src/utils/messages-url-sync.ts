import type { MessagesViewMode } from '@/types/messages.types';

/** True when URL has caught up with a manual view-mode change and sync may resume. */
export function isViewModeUrlSettled(
  viewMode: MessagesViewMode,
  urlView: string | null
): boolean {
  if (viewMode === 'people') return urlView === 'people';
  return urlView !== 'people';
}

/** Whether the URL→state sync effect should run (respects manual override until settled). */
export function shouldSyncViewFromUrl(
  userOverrideActive: boolean,
  viewMode: MessagesViewMode,
  urlView: string | null,
  overrideTargetMode?: MessagesViewMode | null
): boolean {
  if (!userOverrideActive) return true;
  const target = overrideTargetMode ?? viewMode;
  return isViewModeUrlSettled(target, urlView);
}

export function buildUrlSyncKey(urlView: string | null, urlPartner: string | null): string {
  return `${urlView ?? ''}|${urlPartner ?? ''}`;
}
