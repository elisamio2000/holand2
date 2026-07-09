import { useCallback } from 'react';
import { createId } from '@paralleldrive/cuid2';
import toast from 'react-hot-toast';
import type { TFunction } from 'i18next';
import { storageService } from '@/services/storage.service';
import type {
  BoardAttachmentRef,
  BoardAttachmentSource,
  BoardObject,
  BoardSnapshot,
} from '../lib/board-types';
import {
  countAttachmentPlacements,
  createAttachmentRefFromArtifact,
  isDuplicateArtifact,
  normalizeAttachmentRef,
} from '../lib/board-attachment-utils';
import { refreshAttachmentFromStorage } from '../lib/board-attachment-lifecycle';

export interface RemoveAttachmentsOptions {
  skipPlacementCheck?: boolean;
  /** When true, also remove canvas media linked to these library entries */
  removeCanvasPlacements?: boolean;
}

export interface UseBoardAttachmentsOptions {
  snapshot: BoardSnapshot;
  onAttachmentsChange: (attachments: BoardAttachmentRef[]) => void;
  onRemoveCanvasPlacements?: (attachmentRefIds: string[]) => void;
  guardMutation: () => boolean;
  t: TFunction;
}

export function useBoardAttachments({
  snapshot,
  onAttachmentsChange,
  onRemoveCanvasPlacements,
  guardMutation,
  t,
}: UseBoardAttachmentsOptions) {
  const attachments = snapshot.attachments ?? [];

  const addRef = useCallback(
    (ref: BoardAttachmentRef) => {
      if (isDuplicateArtifact(attachments, ref.artifactId)) {
        toast.error(t('boards.attachments.duplicate', 'Already attached'));
        return false;
      }
      onAttachmentsChange([...attachments, normalizeAttachmentRef(ref)]);
      toast.success(t('boards.attachments.added', 'Attachment added'));
      return true;
    },
    [attachments, onAttachmentsChange, t]
  );

  const addFromArtifact = useCallback(
    (
      meta: {
        artifactId: string;
        name: string;
        mime_type?: string;
        size?: number;
        thumbnailUrl?: string;
      },
      source: BoardAttachmentSource
    ): BoardAttachmentRef | false => {
      if (!guardMutation()) return false;
      if (isDuplicateArtifact(attachments, meta.artifactId)) {
        toast.error(t('boards.attachments.duplicate', 'Already attached'));
        return false;
      }
      const ref = createAttachmentRefFromArtifact(meta, source);
      ref.id = createId();
      onAttachmentsChange([...attachments, ref]);
      toast.success(t('boards.attachments.added', 'Attachment added'));
      return ref;
    },
    [attachments, onAttachmentsChange, guardMutation, t]
  );

  const addFromUpload = useCallback(
    async (file: File): Promise<BoardAttachmentRef | false> => {
      if (!guardMutation()) return false;
      try {
        const result = await storageService.uploadFileSmart(file);
        const artifactId = result?.uploaded?.[0]?.id;
        if (!artifactId) {
          toast.error(t('boards.attachments.uploadFail', 'Upload failed'));
          return false;
        }
        return addFromArtifact(
          {
            artifactId: String(artifactId),
            name: file.name,
            mime_type: file.type || undefined,
            size: file.size,
          },
          'upload'
        );
      } catch {
        toast.error(t('boards.attachments.uploadFail', 'Upload failed'));
        return false;
      }
    },
    [addFromArtifact, guardMutation, t]
  );

  const addFromPaste = useCallback(
    async (file: File): Promise<BoardAttachmentRef | false> => {
      if (!guardMutation()) return false;
      try {
        const result = await storageService.uploadFileSmart(file);
        const artifactId = result?.uploaded?.[0]?.id;
        if (!artifactId) {
          toast.error(t('boards.attachments.uploadFail', 'Upload failed'));
          return false;
        }
        return addFromArtifact(
          {
            artifactId: String(artifactId),
            name: file.name,
            mime_type: file.type || undefined,
            size: file.size,
          },
          'paste'
        );
      } catch {
        toast.error(t('boards.attachments.uploadFail', 'Upload failed'));
        return false;
      }
    },
    [addFromArtifact, guardMutation, t]
  );

  const addFromLink = useCallback(
    (artifactId: string, name?: string): BoardAttachmentRef | false => {
      if (!guardMutation()) return false;
      return addFromArtifact(
        { artifactId, name: name ?? artifactId, mime_type: undefined },
        'link'
      );
    },
    [addFromArtifact, guardMutation]
  );

  const removeAttachments = useCallback(
    (ids: string[], opts?: RemoveAttachmentsOptions) => {
      if (!guardMutation()) return;
      const toRemove = attachments.filter((a) => ids.includes(a.id));
      if (!toRemove.length) return;

      if (!opts?.skipPlacementCheck && !opts?.removeCanvasPlacements) {
        const placed = toRemove.filter(
          (a) => countAttachmentPlacements(snapshot.objects, a.id) > 0
        );
        if (placed.length) {
          const ok = window.confirm(
            t(
              'boards.attachments.removePlacedConfirm',
              '{{count}} attachment(s) are placed on the canvas. Remove from library anyway?',
              { count: placed.length }
            )
          );
          if (!ok) return;
        }
      }

      if (opts?.removeCanvasPlacements) {
        onRemoveCanvasPlacements?.(ids);
      }

      onAttachmentsChange(attachments.filter((a) => !ids.includes(a.id)));
      toast.success(t('boards.attachments.removed', 'Removed from library'));
    },
    [attachments, snapshot.objects, onAttachmentsChange, onRemoveCanvasPlacements, guardMutation, t]
  );

  const refreshMetadata = useCallback(
    async (libraryId: string) => {
      const ref = attachments.find((a) => a.id === libraryId);
      if (!ref) return false;
      const updated = await refreshAttachmentFromStorage(ref);
      if (!updated) {
        toast.error(t('boards.attachments.refreshFailed', 'Could not refresh metadata'));
        return false;
      }
      onAttachmentsChange(
        attachments.map((a) => (a.id === libraryId ? updated : a))
      );
      toast.success(t('boards.attachments.refreshed', 'Metadata updated'));
      return true;
    },
    [attachments, onAttachmentsChange, t]
  );

  const findByLibraryId = useCallback(
    (libraryId: string): BoardAttachmentRef | undefined =>
      attachments.find((a) => a.id === libraryId),
    [attachments]
  );

  const findByArtifactId = useCallback(
    (artifactId: string): BoardAttachmentRef | undefined =>
      attachments.find((a) => a.artifactId === artifactId),
    [attachments]
  );

  return {
    attachments,
    addRef,
    addFromArtifact,
    addFromUpload,
    addFromPaste,
    addFromLink,
    removeAttachments,
    refreshMetadata,
    findByLibraryId,
    findByArtifactId,
  };
}

export function buildMediaFromAttachment(
  att: BoardAttachmentRef,
  patch: Partial<import('../lib/board-types').BoardMediaObject> = {}
): import('../lib/board-types').BoardMediaObject {
  const mime = att.mimeType ?? att.mime ?? 'application/octet-stream';
  return {
    id: createId(),
    type: 'media',
    x: 0,
    y: 0,
    width: 160,
    height: 120,
    name: att.name,
    mime,
    artifactId: att.artifactId,
    attachmentRefId: att.id,
    thumbnail: att.thumbnailUrl,
    ...patch,
  };
}

export function attachmentIdsOnCanvas(objects: BoardObject[]): Set<string> {
  const ids = new Set<string>();
  for (const o of objects) {
    if (o.type === 'media' && o.attachmentRefId) ids.add(o.attachmentRefId);
  }
  return ids;
}
