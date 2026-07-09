'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiFolderOpen } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { AttachmentInfo, MessageDetail, MessageItem } from '@/types/messages.types';
import { getFileIconByExtension } from '@/utils/file-icons';
import { useFilePreview } from '@/app/shared/file-preview';
import {
  MpsUltraCompactAudio,
  MpsUltraCompactVideo,
} from '@/components/media-playback';
import { chatService } from '@/services/chat.service';
import { resolveMessageAttachmentSrc } from './resolve-message-attachment-src';

type FileFilter = 'all' | 'image' | 'video' | 'audio' | 'document';

function filterMime(mime: string, filter: FileFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'image') return mime.startsWith('image/');
  if (filter === 'video') return mime.startsWith('video/');
  if (filter === 'audio') return mime.startsWith('audio/');
  return !mime.startsWith('image/') && !mime.startsWith('video/') && !mime.startsWith('audio/');
}

type ThreadFilesPanelProps = {
  message: MessageDetail | null;
  replies: MessageItem[];
};

export default function ThreadFilesPanel({ message, replies }: ThreadFilesPanelProps) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();
  const [filter, setFilter] = useState<FileFilter>('all');

  const allFiles = useMemo(() => {
    const map = new Map<string, AttachmentInfo>();
    const collect = (m: MessageItem | MessageDetail | null) => {
      m?.attachments?.forEach((a) => map.set(a.id, a));
    };
    collect(message);
    replies.forEach(collect);
    return [...map.values()];
  }, [message, replies]);

  const filtered = allFiles.filter((a) => filterMime(a.mime_type, filter));

  const filters: { key: FileFilter; label: string }[] = [
    { key: 'all', label: t('messages.rail.filterAll') },
    { key: 'image', label: t('messages.rail.filterImages') },
    { key: 'video', label: t('messages.rail.filterVideo') },
    { key: 'audio', label: t('messages.rail.filterAudio') },
    { key: 'document', label: t('messages.rail.filterDocs') },
  ];

  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
        <PiFolderOpen className="mb-2 h-8 w-8 text-gray-300" />
        <p className="text-xs text-gray-400">{t('messages.rail.selectThread')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 flex-wrap gap-1 border-b border-muted px-2 py-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
              filter === f.key
                ? 'bg-primary/10 text-primary'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200/20'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-gray-400">{t('messages.rail.noFiles')}</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((att) => {
              const mime = att.mime_type ?? '';
              const src = resolveMessageAttachmentSrc(att);

              if (mime.startsWith('audio/')) {
                return (
                  <MpsUltraCompactAudio
                    key={att.id}
                    artifactId={att.id}
                    src={src}
                    mimeType={mime}
                    fileSize={att.size}
                    title={att.name}
                    rowId={att.id}
                    className="mb-1"
                  />
                );
              }

              if (mime.startsWith('video/')) {
                const poster = att.id
                  ? chatService.getArtifactThumbnailUrl(att.id, 96, 96, 'webp', 80, mime)
                  : undefined;
                return (
                  <MpsUltraCompactVideo
                    key={att.id}
                    src={src}
                    title={att.name}
                    mimeType={mime}
                    fileSize={att.size}
                    artifactId={att.id}
                    poster={poster ?? undefined}
                    rowId={att.id}
                    className="mb-1"
                  />
                );
              }

              return (
                <button
                  key={att.id}
                  type="button"
                  onClick={() =>
                    openFilePreview({
                      src,
                      name: att.name,
                      mimeType: att.mime_type,
                      fileSize: att.size,
                      artifactId: att.id,
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-200/10"
                >
                  <span className="shrink-0">{getFileIconByExtension(att.name, 'h-4 w-4 text-gray-500')}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{att.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
