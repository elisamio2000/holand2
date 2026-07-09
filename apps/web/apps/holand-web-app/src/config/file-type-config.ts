// ============================================
// File Type Configuration
// Color scheme and display settings for file types in File Explorer
// Matches the colorful design pattern from graph/edit-entities
// v0.43.0 — added Phosphor icon per type for icon-driven chip bar.
// ============================================

import type { ComponentType } from 'react';
import {
  FileIcon,
  ImageIcon,
  PDFIcon,
  VideoIcon,
  MusicIcon,
  ZIPIcon,
  TXTIcon,
} from '@/utils/file-icons';
import DocIcon from '@core/components/icons/doc-solid';
import type { FileTypeKey } from '@/types/storage.types';

interface FileTypeConfig {
  /** Display label (Persian) */
  label: string;
  /** Hex color for pills/badges */
  color: string;
  /** Tailwind color class for borders/backgrounds when needed */
  colorClass: string;
  /** Associated MIME prefixes for auto-detection */
  mimePatterns: string[];
  /** Phosphor icon component (v0.43.0). */
  icon: ComponentType<{ className?: string }>;
}

/**
 * File type configuration — colors match graph entity colors for consistency.
 *
 * Inspired by ENTITY_TYPE_CONFIG from graph-explorer.
 */
export const FILE_TYPE_CONFIG: Record<FileTypeKey, FileTypeConfig> = {
  all: {
    label: 'همه فایل‌ها',
    color: '#6b7280', // gray-500
    colorClass: 'gray',
    mimePatterns: [],
    icon: FileIcon,
  },
  image: {
    label: 'تصاویر',
    color: '#f97316', // orange-500
    colorClass: 'orange',
    mimePatterns: ['image/'],
    icon: ImageIcon,
  },
  pdf: {
    label: 'PDF',
    color: '#3b82f6', // blue-500
    colorClass: 'blue',
    mimePatterns: ['application/pdf'],
    icon: PDFIcon,
  },
  video: {
    label: 'ویدیو',
    color: '#ef4444', // red-500
    colorClass: 'red',
    mimePatterns: ['video/'],
    icon: VideoIcon,
  },
  audio: {
    label: 'صوت',
    color: '#eab308', // yellow-500
    colorClass: 'yellow',
    mimePatterns: ['audio/'],
    icon: MusicIcon,
  },
  archive: {
    label: 'فشرده',
    color: '#10b981', // green-500
    colorClass: 'green',
    mimePatterns: ['application/zip', 'application/x-tar', 'application/x-rar', 'application/x-7z'],
    icon: ZIPIcon,
  },
  text: {
    label: 'متن',
    color: '#8b5cf6', // violet-500
    colorClass: 'violet',
    mimePatterns: ['text/'],
    icon: TXTIcon,
  },
  other: {
    label: 'سایر',
    color: '#6b7280', // gray-500
    colorClass: 'gray',
    mimePatterns: [],
    icon: DocIcon,
  },
};

/**
 * Get file type config by key.
 * Fallback to 'other' if not found.
 */
export function getFileTypeConfig(type: string): FileTypeConfig {
  return FILE_TYPE_CONFIG[type as FileTypeKey] ?? FILE_TYPE_CONFIG.other;
}

/**
 * Detect file type from MIME string.
 * Returns the matching FileTypeKey.
 */
export function detectFileType(mimeType: string): FileTypeKey {
  if (!mimeType) return 'other';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/')) return 'text';
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z') ||
    mimeType.includes('archive') ||
    mimeType.includes('compressed')
  ) return 'archive';
  
  return 'other';
}
