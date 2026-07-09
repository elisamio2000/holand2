import type { ZipFileEntry } from '../export-types';

export interface PackageExportZipParams {
  /** Name of the main document inside the archive (e.g. "chat.html"). */
  documentName: string;
  /** UTF-8 text content of the main document. */
  documentContent: string;
  /** Session files to bundle under their relative paths (e.g. "files/img.jpg"). */
  files: ZipFileEntry[];
}

/**
 * Bundle an HTML/Markdown export together with its session files into a single
 * ZIP archive. The document references the files via relative `files/...` links,
 * so the user can extract the archive and open every attachment fully offline.
 */
export async function packageExportZip({
  documentName,
  documentContent,
  files,
}: PackageExportZipParams): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  zip.file(documentName, documentContent);

  for (const entry of files) {
    if (!entry.relPath || !entry.blob) continue;
    zip.file(entry.relPath, entry.blob);
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
