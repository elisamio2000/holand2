import { caseImporterService } from '@/services/case-importer.service';

/** Best-effort delete of staging session after successful import (non-fatal on failure). */
export async function cleanupStagingSessionAfterImport(
  sessionId: string | null | undefined
): Promise<void> {
  if (!sessionId?.trim()) return;
  try {
    await caseImporterService.deleteStagingSession(sessionId);
    console.info('[staging-cleanup] Session removed:', sessionId);
  } catch (err: unknown) {
    console.warn('[staging-cleanup] Failed (non-fatal):', sessionId, err);
  }
}
