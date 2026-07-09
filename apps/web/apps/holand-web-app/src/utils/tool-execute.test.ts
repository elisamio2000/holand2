import { describe, expect, it } from 'vitest';
import { normalizeFileManagerShareResult } from './tool-execute';

describe('normalizeFileManagerShareResult', () => {
  it('reads token from nested share object (live gateway shape)', () => {
    const result = normalizeFileManagerShareResult({
      ok: true,
      share: {
        token: 'abc123',
        expires_at: '2026-06-20T10:56:50Z',
        gateway_download_path: '/storage/shares/abc123/download',
        gateway_resolve_path: '/storage/shares/abc123/resolve',
      },
    });

    expect(result).toEqual({
      token: 'abc123',
      expires_at: '2026-06-20T10:56:50Z',
      gateway_download_path: '/storage/shares/abc123/download',
      gateway_resolve_path: '/storage/shares/abc123/resolve',
      revoked: false,
    });
  });

  it('reads token from flat payload', () => {
    const result = normalizeFileManagerShareResult({
      token: 'flat-token',
      gateway_download_path: '/storage/shares/flat-token/download',
    });

    expect(result?.token).toBe('flat-token');
  });

  it('returns null when token is missing', () => {
    expect(normalizeFileManagerShareResult({ ok: true, share: {} })).toBeNull();
    expect(normalizeFileManagerShareResult(null)).toBeNull();
  });
});
