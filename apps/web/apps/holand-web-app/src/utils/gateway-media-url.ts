/**
 * Media URLs that must be fetched with JWT (same-origin gateway proxy),
 * because raw <img src> / <video src> cannot send Authorization headers.
 */

export function normalizeGatewayArtifactSrc(src: string): string {
  const s = src.trim();
  if (!s) return s;
  if (s.startsWith('/storage/')) {
    return `/api/gateway${s}`;
  }
  return s;
}

export function shouldUseAuthenticatedMediaFetch(src: string): boolean {
  if (!src) return false;
  const s = src.trim();
  if (s.startsWith('blob:') || s.startsWith('data:')) return false;
  if (s.startsWith('/api/gateway')) return true;
  if (/\/storage\/artifacts\//i.test(s)) return true;
  return false;
}

/** Extract storage artifact UUID from gateway download URLs. */
export function extractArtifactIdFromGatewaySrc(src?: string): string | undefined {
  if (!src) return undefined;
  const match = src.match(
    /\/storage\/artifacts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i
  );
  return match?.[1];
}
