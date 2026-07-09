// ============================================
// Storage artifact media helpers — JWT-safe download + hit meta
// ============================================

import { storageService } from '@/services/storage.service';

/** Extract artifact UUID from one-search hit meta. */
export function artifactIdFromHit(
  meta?: Record<string, unknown>
): string | undefined {
  const id = meta?.artifact_id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/** True when URL targets gateway-proxied storage (requires Bearer on fetch). */
export function isProtectedStorageUrl(url: string): boolean {
  return (
    url.includes('/api/gateway/storage/') ||
    url.startsWith('/storage/artifacts/') ||
    url.startsWith('/storage/files/')
  );
}

/** Download via JWT-backed blob fetch (never use window.open for these URLs). */
export async function downloadStorageArtifact(
  artifactId: string,
  filename?: string
): Promise<void> {
  await storageService.downloadArtifact(artifactId, filename, 'attachment');
}
