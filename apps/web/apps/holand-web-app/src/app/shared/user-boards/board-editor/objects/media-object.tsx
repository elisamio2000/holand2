'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import cn from '@core/utils/class-names';
import { getFileCategory } from '@/utils/mime-utils';
import type { BoardAttachmentRef, BoardMediaObject } from '../../lib/board-types';
import { deriveAttachmentCategory } from '../../lib/board-attachment-utils';
import { getBoardBlobUrl } from '../../lib/board-blob-store';
import { BoardAttachmentPreview } from '../components/board-attachment-preview';
import { BoardAttachmentInlinePlayer } from '../components/board-attachment-inline-player';

interface MediaObjectProps {
  object: BoardMediaObject;
  selected: boolean;
  onSelect: (e: React.PointerEvent) => void;
  onDragStart: (e: React.PointerEvent) => void;
  onOpenPreview?: () => void;
  showConnectPorts?: boolean;
  onConnectPortPointerDown?: (e: React.PointerEvent, port: 'top' | 'bottom') => void;
  onConnectBodyPointerDown?: (e: React.PointerEvent) => void;
}

function mediaToPreviewAttachment(obj: BoardMediaObject): BoardAttachmentRef {
  const mime = obj.mime || 'application/octet-stream';
  return {
    id: obj.attachmentRefId ?? obj.id,
    artifactId: obj.artifactId ?? obj.id,
    name: obj.name,
    mimeType: mime,
    mime,
    category: deriveAttachmentCategory(mime),
    thumbnailUrl: obj.thumbnail,
    addedAt: '',
    source: obj.artifactId ? 'upload' : 'link',
  };
}

function MediaObjectViewInner({
  object,
  selected,
  onSelect,
  onDragStart,
  onOpenPreview,
  showConnectPorts,
  onConnectPortPointerDown,
  onConnectBodyPointerDown,
}: MediaObjectProps) {
  const [blobUrl, setBlobUrl] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (object.blobKey) {
        const url = await getBoardBlobUrl(object.blobKey);
        if (!cancelled) setBlobUrl(url ?? undefined);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [object.blobKey]);

  const category = useMemo(
    () => getFileCategory(object.mime, object.name),
    [object.mime, object.name]
  );

  const previewAttachment = useMemo(() => {
    const att = mediaToPreviewAttachment(object);
    if (blobUrl && !object.artifactId) {
      return { ...att, thumbnailUrl: blobUrl };
    }
    return att;
  }, [object, blobUrl]);

  const isPlayable = category === 'audio' || category === 'video';
  const hasArtifactPlayback = Boolean(object.artifactId);

  const cx = object.x + object.width / 2;

  return (
    <g>
      {showConnectPorts ? (
        <>
          <rect
            x={cx - 4}
            y={object.y - 4}
            width={8}
            height={8}
            className="fill-slate-800 stroke-white"
            strokeWidth={1}
            data-board-connect-port={object.id}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onConnectPortPointerDown?.(e, 'top');
            }}
          />
          <rect
            x={cx - 4}
            y={object.y + object.height - 4}
            width={8}
            height={8}
            className="fill-slate-800 stroke-white"
            strokeWidth={1}
            data-board-connect-port={object.id}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onConnectPortPointerDown?.(e, 'bottom');
            }}
          />
        </>
      ) : null}
      <foreignObject
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        className="overflow-visible"
        data-board-object={object.id}
        data-board-type="media"
        opacity={object.opacity ?? 1}
        onPointerDown={(e) => {
          if (showConnectPorts) {
            e.stopPropagation();
            onConnectBodyPointerDown?.(e);
          }
        }}
      >
        <div
          className={cn(
            'flex h-full select-none flex-col overflow-hidden rounded-md border bg-white dark:bg-gray-100',
            selected ? 'ring-2 ring-primary' : 'border-muted',
            object.locked ? 'cursor-not-allowed' : 'cursor-grab'
          )}
          onPointerDown={(e) => {
            if (showConnectPorts) return;
            const target = e.target as HTMLElement;
            if (target.closest('[data-board-media-controls]')) return;
            if (!object.locked) onDragStart(e);
            onSelect(e);
          }}
          onDoubleClick={() => onOpenPreview?.()}
        >
          <div className="truncate border-b border-muted px-2 py-0.5 text-[10px] text-gray-500">
            {object.name}
          </div>
          <div
            className="relative flex min-h-0 flex-1 flex-col justify-center bg-muted/20 p-1"
            data-board-media-controls
          >
            {isPlayable && hasArtifactPlayback ? (
              <BoardAttachmentInlinePlayer
                attachment={previewAttachment}
                rowId={`board-media-${object.id}`}
                layout="canvas"
                className="min-h-0 flex-1"
                onCanvasExpand={onOpenPreview}
              />
            ) : (
              <div className="relative mx-auto h-full w-full max-h-full max-w-full min-h-[48px]">
                <BoardAttachmentPreview
                  attachment={previewAttachment}
                  compact={false}
                  livePreview
                  className="h-full w-full rounded-sm"
                />
              </div>
            )}
          </div>
          {object.caption ? (
            <div className="truncate px-2 py-0.5 text-[10px] text-gray-600">{object.caption}</div>
          ) : null}
        </div>
      </foreignObject>
    </g>
  );
}

export const MediaObjectView = memo(MediaObjectViewInner);
