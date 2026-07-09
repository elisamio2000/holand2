// ============================================
// File Icon Utilities — single global source for all file-type icons
// Used by: AI chat, file-manager, file-explorer, one-search, plugins
// ============================================

import React from 'react';
import cn from '@core/utils/class-names';

import PDFIcon from '@core/components/icons/pdf-solid';
import DocIcon from '@core/components/icons/doc-solid';
import XLSIcon from '@core/components/icons/xls-solid';
import PPTIcon from '@core/components/icons/ppt-solid';
import ZIPIcon from '@core/components/icons/zip-solid';
import XMLIcon from '@core/components/icons/xml-solid';
import CodeIcon from '@core/components/icons/code-solid';
import TXTIcon from '@core/components/icons/txt-solid';
import FileIcon from '@core/components/icons/file-solid';
import ImageIcon from '@core/components/icons/image-solid';
import VideoIcon from '@core/components/icons/video-solid';
import MusicIcon from '@core/components/icons/music-solid';
import DbIcon from '@core/components/icons/db-solid';
import FolderIcon from '@core/components/icons/folder-solid';

export interface FileIconProps {
  className?: string;
}

/** Scales with thumbnail cell via @container + cqmin (video cards, file explorer grid). */
export const THUMBNAIL_FALLBACK_ICON_CLASS = {
  video: 'size-[clamp(3rem,38cqmin,5.5rem)] shrink-0',
  default: 'size-[clamp(2.5rem,32cqmin,4.5rem)] shrink-0',
} as const;

const DB_EXTENSIONS = new Set([
  'accdb',
  'mdb',
  'sqlite',
  'sqlite3',
  'db',
]);

const DB_MIME_HINTS = ['msaccess', 'access', 'sqlite', 'x-sqlite3'];

function isDatabaseType(type: string, ext?: string): boolean {
  if (ext && DB_EXTENSIONS.has(ext)) return true;
  return DB_MIME_HINTS.some((h) => type.includes(h));
}

function isSpreadsheetType(type: string, ext?: string): boolean {
  if (ext === 'csv') return true;
  return (
    type === 'application/vnd.ms-excel' ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'text/csv' ||
    type.includes('excel') ||
    type.includes('spreadsheet')
  );
}

/**
 * Resolve icon from MIME type (optional extension for ambiguous types like text/csv).
 */
export function getFileIcon(
  mimeType?: string | null,
  className = 'h-8 w-8',
  extension?: string | null
): React.ReactNode {
  const ext = extension?.toLowerCase().replace(/^\./, '');

  if (!mimeType && ext) {
    return getFileIconByExtension(`file.${ext}`, className);
  }

  if (!mimeType) {
    return <FileIcon className={className} />;
  }

  const type = mimeType.toLowerCase();

  if (type.startsWith('image/')) return <ImageIcon className={className} />;
  if (type.startsWith('audio/')) return <MusicIcon className={className} />;
  if (type.startsWith('video/')) {
    return <VideoIcon className={cn(className, '[transform:scaleX(1)]')} />;
  }
  if (type === 'application/pdf') return <PDFIcon className={className} />;

  if (isDatabaseType(type, ext)) return <DbIcon className={className} />;

  if (
    type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type.includes('word')
  ) {
    return <DocIcon className={className} />;
  }

  if (isSpreadsheetType(type, ext)) return <XLSIcon className={className} />;

  if (
    type === 'application/vnd.ms-powerpoint' ||
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    type.includes('powerpoint') ||
    type.includes('presentation')
  ) {
    return <PPTIcon className={className} />;
  }

  if (
    type === 'application/zip' ||
    type === 'application/x-zip-compressed' ||
    type === 'application/x-rar-compressed' ||
    type === 'application/x-7z-compressed' ||
    type === 'application/x-tar' ||
    type === 'application/gzip' ||
    type.includes('zip') ||
    type.includes('compress') ||
    type.includes('archive')
  ) {
    return <ZIPIcon className={className} />;
  }

  if (type === 'application/xml' || type === 'text/xml' || type.includes('xml')) {
    return <XMLIcon className={className} />;
  }

  if (
    type === 'application/javascript' ||
    type === 'application/json' ||
    type === 'application/typescript' ||
    type === 'text/javascript' ||
    type === 'text/html' ||
    type === 'text/css' ||
    type === 'text/x-python' ||
    type === 'text/x-java' ||
    type.includes('javascript') ||
    type.includes('json') ||
    type.includes('html') ||
    type.includes('css') ||
    type.includes('python') ||
    type.includes('java') ||
    type.includes('code')
  ) {
    return <CodeIcon className={className} />;
  }

  if (type === 'text/plain' || type.startsWith('text/')) {
    return <TXTIcon className={className} />;
  }

  return <FileIcon className={className} />;
}

export function getFileIconByExtension(
  filename?: string | null,
  className = 'h-8 w-8'
): React.ReactNode {
  if (!filename) return <FileIcon className={className} />;

  const ext = filename.toLowerCase().split('.').pop() || '';

  const extToMime: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/m4a',
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    wmv: 'video/x-ms-wmv',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    accdb: 'application/msaccess',
    mdb: 'application/x-msaccess',
    sqlite: 'application/x-sqlite3',
    db: 'application/x-sqlite3',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    js: 'application/javascript',
    ts: 'application/typescript',
    jsx: 'text/javascript',
    tsx: 'text/typescript',
    json: 'application/json',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    py: 'text/x-python',
    java: 'text/x-java',
    xml: 'application/xml',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    txt: 'text/plain',
    md: 'text/markdown',
    log: 'text/plain',
  };

  const mimeType = extToMime[ext];
  return getFileIcon(mimeType, className, ext);
}

export function isImageMimeType(mimeType?: string | null): boolean {
  return !!mimeType?.toLowerCase().startsWith('image/');
}

export function isVideoMimeType(mimeType?: string | null): boolean {
  return !!mimeType?.toLowerCase().startsWith('video/');
}

export function isAudioMimeType(mimeType?: string | null): boolean {
  return !!mimeType?.toLowerCase().startsWith('audio/');
}

export function canUseFileThumbnail(mimeType?: string | null): boolean {
  const t = mimeType?.toLowerCase() ?? '';
  return t.startsWith('image/') || t.startsWith('video/') || t === 'application/pdf';
}

export function getFolderIcon(className = 'h-8 w-8'): React.ReactNode {
  return <FolderIcon className={className} />;
}

export {
  PDFIcon,
  DocIcon,
  XLSIcon,
  PPTIcon,
  ZIPIcon,
  XMLIcon,
  CodeIcon,
  TXTIcon,
  FileIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  DbIcon,
  FolderIcon,
};
