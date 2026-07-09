'use client';
/* eslint-disable @next/next/no-img-element -- thumbnail from authenticated blob URL */

import { PiXBold } from 'react-icons/pi';
import { getFileIconByExtension } from '@/utils/file-icons';
import type { AttachmentInfo, PendingAttachment } from '@/types/messages.types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type AttachmentCardProps = {
  att: PendingAttachment | AttachmentInfo;
  onRemove?: (id: string) => void;
  compact?: boolean;
};

export default function AttachmentCard({ att, onRemove, compact }: AttachmentCardProps) {
  const name = att.name;
  const size = att.size;
  const isImage =
    ('type' in att && att.type?.startsWith('image/')) ||
    ('mime_type' in att && att.mime_type?.startsWith('image/'));
  const dataUrl = 'dataUrl' in att ? att.dataUrl : undefined;
  const uploading = 'uploading' in att && att.uploading;
  const progress = 'progress' in att ? att.progress : undefined;

  return (
    <div
      className={
        compact
          ? 'flex items-center gap-2 rounded-lg border border-muted bg-gray-50 px-2 py-1.5 dark:bg-gray-100'
          : 'group relative flex items-center gap-2.5 rounded-xl border border-muted bg-gray-50 p-2 pr-3 dark:bg-gray-100'
      }
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-muted bg-gray-0">
        {isImage && dataUrl ? (
          <img src={dataUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="[&>svg]:h-6 [&>svg]:w-6">
            {getFileIconByExtension(name, 'h-6 w-6')}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">{name}</p>
        <p className="text-[10px] text-gray-500">
          {uploading ? `Uploading ${progress ?? 0}%` : formatFileSize(size)}
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(att.id)}
          className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40"
        >
          <PiXBold className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
