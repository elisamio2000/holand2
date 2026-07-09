import { describe, expect, it } from 'vitest';
import {
  extractArtifactIdFromGatewaySrc,
  normalizeGatewayArtifactSrc,
  shouldUseAuthenticatedMediaFetch,
} from '../gateway-media-url';

describe('extractArtifactIdFromGatewaySrc', () => {
  const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('extracts UUID from gateway proxy path', () => {
    expect(
      extractArtifactIdFromGatewaySrc(
        `/api/gateway/storage/artifacts/${id}/download`
      )
    ).toBe(id);
  });

  it('extracts UUID from bare storage path', () => {
    expect(
      extractArtifactIdFromGatewaySrc(`/storage/artifacts/${id}/download?inline=1`)
    ).toBe(id);
  });

  it('returns undefined for public URLs', () => {
    expect(extractArtifactIdFromGatewaySrc('https://cdn.example.com/audio.mp3')).toBeUndefined();
  });
});

describe('normalizeGatewayArtifactSrc', () => {
  it('prefixes bare storage paths with gateway proxy', () => {
    expect(normalizeGatewayArtifactSrc('/storage/artifacts/x/download')).toBe(
      '/api/gateway/storage/artifacts/x/download'
    );
  });
});

describe('shouldUseAuthenticatedMediaFetch', () => {
  it('requires auth for gateway artifact URLs', () => {
    expect(
      shouldUseAuthenticatedMediaFetch('/api/gateway/storage/artifacts/x/download')
    ).toBe(true);
  });

  it('skips auth for blob URLs', () => {
    expect(shouldUseAuthenticatedMediaFetch('blob:http://localhost/abc')).toBe(false);
  });
});
