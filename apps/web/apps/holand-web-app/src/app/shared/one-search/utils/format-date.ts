export function formatRelativeDate(isoString: string, locale: string = 'en'): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return locale === 'fa' ? 'همین الان' : 'Just now';
    if (diffMins < 60) {
      return locale === 'fa' ? `${diffMins} دقیقه پیش` : `${diffMins} min ago`;
    }
    if (diffHours < 24) {
      return locale === 'fa' ? `${diffHours} ساعت پیش` : `${diffHours} hours ago`;
    }
    if (diffDays < 7) {
      return locale === 'fa' ? `${diffDays} روز پیش` : `${diffDays} days ago`;
    }

    return date.toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getFileIcon(mimeType?: string): string {
  if (!mimeType) return '📄';

  const iconMap: Record<string, string> = {
    'application/pdf': '📄',
    'application/vnd.ms-excel': '📊',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
    'application/msword': '📝',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
    'image/jpeg': '📷',
    'image/png': '📷',
    'image/gif': '📷',
    'image/svg+xml': '📷',
    'audio/mpeg': '🎵',
    'audio/mp4': '🎵',
    'audio/wav': '🎵',
    'video/mp4': '🎬',
    'video/x-matroska': '🎬',
    'video/quicktime': '🎬',
    'application/zip': '🗜️',
    'application/x-rar-compressed': '🗜️',
    'text/plain': '📝',
    'text/html': '🌐',
    'application/json': '{ }',
  };

  for (const [key, icon] of Object.entries(iconMap)) {
    if (mimeType.includes(key) || key.includes(mimeType)) {
      return icon;
    }
  }

  if (mimeType.startsWith('image/')) return '📷';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('text/')) return '📝';

  return '📄';
}
