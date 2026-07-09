// ============================================
// One Search — shared file_manager.list args builder
// ============================================

import type { OneSearchMode } from '@/types/one-search.types';

export function fileManagerArgsForMode(
  query: string,
  mode: OneSearchMode,
  limit: number,
  options?: { minPageSize?: number }
): Record<string, unknown> {
  const pageSize = Math.max(limit, options?.minPageSize ?? limit);
  const base: Record<string, unknown> = {
    page: 1,
    page_size: pageSize,
    search: query,
    sort_by: 'created_at',
    sort_dir: 'desc',
  };
  if (mode === 'image') base.media_type = 'image';
  if (mode === 'audio') base.media_type = 'audio';
  if (mode === 'video') base.media_type = 'video';
  if (mode === 'text') base.media_type = 'text';
  return base;
}
