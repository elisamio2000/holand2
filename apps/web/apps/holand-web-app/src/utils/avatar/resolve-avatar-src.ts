const DEFAULT_AVATAR_SRC = '/logo.png';

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
    return avatarUrl;
  }
  if (fallbackSeed?.trim()) {
    return `${DEFAULT_AVATAR_SRC}?u=${encodeURIComponent(fallbackSeed)}`;
  }
  return DEFAULT_AVATAR_SRC;
}
