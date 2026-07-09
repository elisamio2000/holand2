// ============================================
// Download Helper — Utilities for downloading exported files
// ============================================

/**
 * Download a file to the user's device
 * @param content - File content (string or Blob)
 * @param filename - Name of the file to download
 * @param mimeType - MIME type of the file
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string
): void {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Sanitize a filename for safe download
 * @param name - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/gi, '_') // Allow Persian/Arabic characters
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 100); // Limit length
}

/**
 * Get MIME type for export format
 * @param format - Export format
 * @returns MIME type string
 */
export function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    md: 'text/markdown',
    json: 'application/json',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    html: 'text/html',
  };
  return mimeTypes[format] || 'application/octet-stream';
}

/**
 * Generate a timestamp string for filenames
 * @returns Formatted timestamp (YYYY-MM-DD_HH-mm-ss)
 */
export function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19)
    .replace('T', '_');
}
