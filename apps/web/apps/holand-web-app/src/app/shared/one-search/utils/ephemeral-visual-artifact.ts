// ============================================
// Ephemeral visual query artifacts — upload + delete workaround (Option A)
// ============================================

import { storageService } from '@/services/storage.service';
import type { OneSearchQueryImage } from '@/types/one-search.types';

const EPHEMERAL_SESSION_KEY = 'one-search:ephemeral-artifact-id';

let activeEphemeralId: string | null = null;

function readCleanupFlag(): boolean {
  const flag = process.env.NEXT_PUBLIC_ONE_SEARCH_EPHEMERAL_CLEANUP;
  if (flag === 'false') return false;
  return true;
}

export function isEphemeralCleanupEnabled(): boolean {
  return readCleanupFlag();
}

function readSessionEphemeralId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(EPHEMERAL_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionEphemeralId(artifactId: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (artifactId) sessionStorage.setItem(EPHEMERAL_SESSION_KEY, artifactId);
    else sessionStorage.removeItem(EPHEMERAL_SESSION_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Restore ephemeral flag when URL sync drops it but session still tracks upload. */
export function hydrateEphemeralQueryImage(
  queryImage: OneSearchQueryImage | null
): OneSearchQueryImage | null {
  if (!queryImage?.artifact_id) return queryImage;
  if (queryImage.ephemeral) return queryImage;
  const id = queryImage.artifact_id.trim();
  const persisted = readSessionEphemeralId();
  if (persisted && persisted === id) {
    return { ...queryImage, ephemeral: true };
  }
  if (activeEphemeralId === id) {
    return { ...queryImage, ephemeral: true };
  }
  return queryImage;
}

/** Track the current session upload eligible for cleanup. */
export function registerEphemeralArtifact(artifactId: string): void {
  if (!artifactId.trim()) return;
  activeEphemeralId = artifactId.trim();
  writeSessionEphemeralId(activeEphemeralId);
}

export function releaseEphemeralArtifact(artifactId?: string | null): void {
  const id = artifactId?.trim();
  if (!id || activeEphemeralId === id) {
    activeEphemeralId = null;
  }
  if (id && readSessionEphemeralId() === id) {
    writeSessionEphemeralId(null);
  }
}

/** Fire-and-forget delete — never blocks UI. */
export function purgeEphemeralArtifact(artifactId: string | null | undefined): void {
  if (!isEphemeralCleanupEnabled()) return;
  const id = artifactId?.trim();
  if (!id) return;

  if (activeEphemeralId === id) {
    activeEphemeralId = null;
  }
  if (readSessionEphemeralId() === id) {
    writeSessionEphemeralId(null);
  }

  void storageService.deleteArtifactsViaBatch([id]).catch((err) => {
    console.warn('[OneSearch] ephemeral artifact cleanup failed:', { id, err });
  });
}

export function purgeEphemeralQueryImage(queryImage: OneSearchQueryImage | null | undefined): void {
  if (!queryImage?.ephemeral) return;
  purgeEphemeralArtifact(queryImage.artifact_id);
}

export function purgeActiveEphemeralArtifact(): void {
  if (!activeEphemeralId) return;
  purgeEphemeralArtifact(activeEphemeralId);
}

export function clearPersistedEphemeralArtifact(): void {
  writeSessionEphemeralId(null);
  activeEphemeralId = null;
}
