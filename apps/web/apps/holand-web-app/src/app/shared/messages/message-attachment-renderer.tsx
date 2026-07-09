'use client';

import { Tooltip } from '@/components/tooltip';
import { useMemo } from 'react';
import cn from '@core/utils/class-names';
import FileTypeIcon from '@/components/file-type-icon';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { PiDownloadSimpleBold, PiEye } from 'react-icons/pi';

import AuthenticatedImage from '@/app/shared/ai-chat/authenticated-image';
import { useFilePreview } from '@/app/shared/file-preview';
import { chatService } from '@/services/chat.service';
import { formatFileSize } from '@/config/file-upload.config';
import {
  MpsUltraCompactAudio,
  MpsUltraCompactVideo,
} from '@/components/media-playback';
import type { AttachmentInfo } from '@/types/messages.types';
import {
  isPublicAttachmentUrl,
  resolveMessageAttachmentSrc,
} from './resolve-message-attachment-src';

type MessageAttachmentRendererProps = {
  attachment: AttachmentInfo;
  compact?: boolean;
  className?: string;
};

export default function MessageAttachmentRenderer({
  attachment,
  compact = false,
  className,
}: MessageAttachmentRendererProps) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();
  const src = useMemo(() => resolveMessageAttachmentSrc(attachment), [attachment]);
  const mime = attachment.mime_type ?? '';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/') || mime === 'audio/webm';
  const isPublic = isPublicAttachmentUrl(src);
  const fileSizeStr = formatFileSize(attachment.size);

  if (isAudio) {
    return (
      <MpsUltraCompactAudio
        artifactId={attachment.id}
        src={src}
        mimeType={mime}
        fileSize={attachment.size}
        title={attachment.name}
        rowId={attachment.id}
        className={cn(compact ? 'max-w-sm' : 'max-w-md', className)}
        onDownload={async () => {
          try {
            await chatService.downloadFile(src, attachment.name);
            toast.success(`"${attachment.name}" downloaded`);
          } catch {
            toast.error(t('toast.failedDownloadFile', 'Download failed'));
          }
        }}
      />
    );
  }

  if (isVideo) {
    const poster =
      !isPublic && attachment.id
        ? chatService.getArtifactThumbnailUrl(attachment.id, 96, 96, 'webp', 80, mime)
        : undefined;

    return (
      <MpsUltraCompactVideo
        src={src}
        title={attachment.name}
        mimeType={mime}
        fileSize={attachment.size}
        artifactId={attachment.id}
        poster={poster ?? undefined}
        rowId={attachment.id}
        className={cn(compact ? 'max-w-sm' : 'max-w-md', className)}
        onDownload={async () => {
          try {
            await chatService.downloadFile(src, attachment.name);
            toast.success(`"${attachment.name}" downloaded`);
          } catch {
            toast.error(t('toast.failedDownloadFile', 'Download failed'));
          }
        }}
      />
    );
  }

  const openPreview = () =>
    openFilePreview({
      src,
      name: attachment.name,
      mimeType: mime,
      fileSize: attachment.size,
      artifactId: attachment.id,
    });

  const imageThumb = isImage ? (
    isPublic ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={attachment.name}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    ) : (
      <AuthenticatedImage
        src={src}
        alt={attachment.name}
        className="h-full w-full object-cover"
      />
    )
  ) : null;

  return (
    <div
      className={cn(
        'group/file flex items-start gap-3 rounded-lg border border-muted bg-gray-0 p-3 transition-colors',
        'hover:border-primary/20 hover:bg-gray-50/50 dark:bg-gray-50 dark:hover:bg-gray-100/30',
        compact ? 'max-w-sm' : 'max-w-md',
        className
      )}
    >
      <div className="relative mt-0.5 shrink-0">
        {isImage ? (
          <FileTypeIcon
            mimeType={mime}
            filename={attachment.name}
            size="md"
            onClick={openPreview}
            thumbnail={imageThumb}
          />
        ) : (
          <FileTypeIcon
            mimeType={mime}
            filename={attachment.name}
            size="md"
            onClick={openPreview}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
          {attachment.name}
        </p>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {fileSizeStr !== '—' && <span>{fileSizeStr}</span>}
          {mime && <span className="capitalize">{mime.split('/').pop()}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <Tooltip content={t('messages.attachments.preview', 'Preview')} placement="bottom">
            <button
              type="button"
              onClick={openPreview}
              aria-label={t('messages.attachments.preview', 'Preview')}
              className="flex items-center justify-center rounded p-0.5 text-gray-500 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-primary"
            >
              <PiEye className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <Tooltip content={t('messages.attachments.download', 'Download')} placement="bottom">
            <button
              type="button"
              aria-label={t('messages.attachments.download', 'Download')}
              onClick={async () => {
                try {
                  await chatService.downloadFile(src, attachment.name);
                  toast.success(`"${attachment.name}" downloaded`);
                } catch {
                  toast.error(t('toast.failedDownloadFile', 'Download failed'));
                }
              }}
              className="flex items-center justify-center rounded p-0.5 text-gray-500 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-primary"
            >
              <PiDownloadSimpleBold className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
