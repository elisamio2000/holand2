import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/storage.service', () => ({
  storageService: {
    deleteArtifactsViaBatch: vi.fn().mockResolvedValue({ ok: true, processed: 1 }),
  },
}));

import { storageService } from '@/services/storage.service';
import {
  hydrateEphemeralQueryImage,
  isEphemeralCleanupEnabled,
  purgeActiveEphemeralArtifact,
  purgeEphemeralArtifact,
  purgeEphemeralQueryImage,
  registerEphemeralArtifact,
  releaseEphemeralArtifact,
  clearPersistedEphemeralArtifact,
} from '../ephemeral-visual-artifact';

describe('ephemeral-visual-artifact', () => {
  beforeEach(() => {
    vi.mocked(storageService.deleteArtifactsViaBatch).mockClear();
    releaseEphemeralArtifact();
    clearPersistedEphemeralArtifact();
    vi.stubEnv('NEXT_PUBLIC_ONE_SEARCH_EPHEMERAL_CLEANUP', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    releaseEphemeralArtifact();
    clearPersistedEphemeralArtifact();
  });

  it('hydrates ephemeral flag from sessionStorage after URL sync', () => {
    registerEphemeralArtifact('persisted-1');
    const hydrated = hydrateEphemeralQueryImage({ artifact_id: 'persisted-1' });
    expect(hydrated?.ephemeral).toBe(true);
  });

  it('purgeEphemeralQueryImage deletes only when ephemeral flag is set', () => {
    purgeEphemeralQueryImage({ artifact_id: 'a1', ephemeral: true });
    expect(storageService.deleteArtifactsViaBatch).toHaveBeenCalledWith(['a1']);

    vi.mocked(storageService.deleteArtifactsViaBatch).mockClear();
    purgeEphemeralQueryImage({ artifact_id: 'a2', ephemeral: false });
    expect(storageService.deleteArtifactsViaBatch).not.toHaveBeenCalled();
  });

  it('purgeEphemeralArtifact deletes and purgeActiveEphemeralArtifact is idempotent', () => {
    registerEphemeralArtifact('active-1');
    purgeEphemeralArtifact('active-1');
    expect(storageService.deleteArtifactsViaBatch).toHaveBeenCalledWith(['active-1']);

    vi.mocked(storageService.deleteArtifactsViaBatch).mockClear();
    purgeActiveEphemeralArtifact();
    expect(storageService.deleteArtifactsViaBatch).not.toHaveBeenCalled();
  });

  it('skips delete when cleanup env flag is false', () => {
    vi.stubEnv('NEXT_PUBLIC_ONE_SEARCH_EPHEMERAL_CLEANUP', 'false');
    expect(isEphemeralCleanupEnabled()).toBe(false);
    purgeEphemeralQueryImage({ artifact_id: 'a3', ephemeral: true });
    expect(storageService.deleteArtifactsViaBatch).not.toHaveBeenCalled();
  });

  it('swallows delete errors without throwing', async () => {
    vi.mocked(storageService.deleteArtifactsViaBatch).mockRejectedValueOnce(new Error('network'));
    expect(() =>
      purgeEphemeralQueryImage({ artifact_id: 'a4', ephemeral: true })
    ).not.toThrow();
    await Promise.resolve();
  });
});
