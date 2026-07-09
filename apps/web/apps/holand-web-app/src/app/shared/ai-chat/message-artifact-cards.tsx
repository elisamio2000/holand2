'use client';

import cn from '@core/utils/class-names';
import FileTypeIcon from '@/components/file-type-icon';
import { MpsUltraCompactAudio, MpsUltraCompactVideo } from '@/components/media-playback';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { PiDownloadSimpleBold, PiEye } from 'react-icons/pi';
import AuthenticatedImage from './authenticated-image';
import { chatService } from '@/services/chat.service';
import { debugLog } from '@/utils/debug-logger';
import { formatFileSize, THUMBNAIL_PRESETS } from '@/config/file-upload.config';
import type { ArtifactInput } from '@/types/chat.types';

export interface ArtifactPreviewOpenPayload {
  src: string;
  name: string;
  mimeType?: string | null;
  fileSize?: number | null;
  localPreviewUrl?: string;
  artifactId?: string;
}

interface MessageArtifactCardsProps {
  artifacts: ArtifactInput[];
  variant: 'user' | 'assistant';
  onOpenPreview: (p: ArtifactPreviewOpenPayload) => void;
}

export default function MessageArtifactCards({
  artifacts,
  variant,
  onOpenPreview,
}: MessageArtifactCardsProps) {
  const { t } = useTranslation();
  const maxClass = variant === 'user' ? 'max-w-[75%]' : 'max-w-full';

  if (!artifacts?.length) return null;

  return (
    <div className={cn('flex flex-col gap-1.5', maxClass)}>
      {artifacts.map((att: ArtifactInput, idx: number) => {
        const isImage = att.mime_type?.startsWith('image/') ?? false;
        const isVideo = att.mime_type?.startsWith('video/') ?? false;
        const isAudio = att.mime_type?.startsWith('audio/') ?? false;
        const fileName = att.name ?? att.path.split('/').pop() ?? 'file';
        const fileSizeStr = formatFileSize(att.size);
        const fileUrl = att.id
          ? chatService.getArtifactUrl(att.id)
          : chatService.getArtifactUrl(att.path);

        const openPreview = () =>
          onOpenPreview({
            src: fileUrl,
            name: att.name ?? fileName,
            mimeType: att.mime_type,
            fileSize: att.size,
            localPreviewUrl: att.localPreviewUrl,
            artifactId: att.id ?? undefined,
          });

        const videoThumb =
          isVideo && att.id && !att.localPreviewUrl
            ? chatService.getArtifactThumbnailUrl(
                att.id,
                THUMBNAIL_PRESETS.attachmentCard.width,
                THUMBNAIL_PRESETS.attachmentCard.height,
                'webp',
                THUMBNAIL_PRESETS.attachmentCard.quality,
                att.mime_type ?? undefined
              )
            : null;

        debugLog.thumbnail('MessageArtifactCards', {
          idx,
          artifactId: att.id,
          mimeType: att.mime_type,
          fileName,
        });

        if (isVideo) {
          return (
            <MpsUltraCompactVideo
              key={att.id ?? idx}
              src={fileUrl}
              title={fileName}
              mimeType={att.mime_type ?? undefined}
              fileSize={att.size ?? undefined}
              artifactId={att.id ?? undefined}
              poster={videoThumb ?? undefined}
              rowId={att.id ?? `artifact-${idx}`}
              localPreviewUrl={att.localPreviewUrl}
              onRowPreview={openPreview}
              onDownload={async () => {
                try {
                  await chatService.downloadFile(fileUrl, fileName);
                  toast.success(`"${fileName}" downloaded`);
                } catch {
                  toast.error(t('toast.failedDownloadFile'));
                }
              }}
            />
          );
        }

        if (isAudio) {
          return (
            <MpsUltraCompactAudio
              key={att.id ?? idx}
              src={fileUrl}
              title={fileName}
              mimeType={att.mime_type ?? undefined}
              fileSize={att.size ?? undefined}
              artifactId={att.id ?? undefined}
              localPreviewUrl={att.localPreviewUrl}
              rowId={att.id ?? `artifact-${idx}`}
              onDownload={async () => {
                try {
                  await chatService.downloadFile(fileUrl, fileName);
                  toast.success(`"${fileName}" downloaded`);
                } catch {
                  toast.error(t('toast.failedDownloadFile'));
                }
              }}
            />
          );
        }

        return (
          <div
            key={att.id ?? idx}
            className={cn(
              'group/file flex items-start gap-3 rounded-lg border border-muted p-3 transition-colors',
              'hover:border-primary/20 hover:bg-gray-50/50 dark:hover:bg-gray-100/30',
              'bg-gray-0 dark:bg-gray-50'
            )}
          >
            <div className="relative mt-0.5 shrink-0">
              {isImage ? (
                <div
                  className="h-10 w-10 cursor-pointer overflow-hidden rounded-lg border border-muted bg-gray-100 dark:bg-gray-200/30"
                  onClick={openPreview}
                >
                  <AuthenticatedImage
                    src={fileUrl}
                    localPreviewUrl={att.localPreviewUrl}
                    thumbnailSrc={
                      !att.localPreviewUrl && att.id
                        ? chatService.getArtifactThumbnailUrl(
                            att.id,
                            THUMBNAIL_PRESETS.attachmentCard.width,
                            THUMBNAIL_PRESETS.attachmentCard.height,
                            'webp',
                            THUMBNAIL_PRESETS.attachmentCard.quality,
                            att.mime_type ?? undefined
                          ) ?? undefined
                        : undefined
                    }
                    alt={fileName}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <FileTypeIcon
                  mimeType={att.mime_type}
                  filename={fileName}
                  size="md"
                  onClick={openPreview}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
                {fileName}
              </p>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                {fileSizeStr !== '—' && <span>{fileSizeStr}</span>}
                {att.mime_type && (
                  <span className="capitalize">{att.mime_type.split('/').pop()}</span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={openPreview}
                  className="flex items-center gap-1 text-gray-500 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                >
                  <PiEye className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </button>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await chatService.downloadFile(fileUrl, fileName);
                      toast.success(`"${fileName}" downloaded`);
                    } catch {
                      toast.error(t('toast.failedDownloadFile'));
                    }
                  }}
                  className="flex items-center gap-1 text-gray-500 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                >
                  <PiDownloadSimpleBold className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
