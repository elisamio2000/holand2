const DEFAULT_AVATAR_SRC = '/brand/brand-mark-4x.svg';
const DEPRECATED_AVATAR_SRCS = new Set(['/brand/user-avatar-placeholder.svg', '/brand/brand-mark-4x.png']);

export function isValidAvatarUrl(value: string): boolean {
  if (!value) return true;
  if (value.startsWith('data:image/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return value.startsWith('/');
  }
}

export function resolveAvatarSrc(
  avatarUrl: string | null | undefined,
  fallbackSeed?: string
): string {
  if (avatarUrl && isValidAvatarUrl(avatarUrl)) {
    if (DEPRECATED_AVATAR_SRCS.has(avatarUrl)) {
      return DEFAULT_AVATAR_SRC;
    }
    return avatarUrl;
  }
  void fallbackSeed;
  return DEFAULT_AVATAR_SRC;
}
