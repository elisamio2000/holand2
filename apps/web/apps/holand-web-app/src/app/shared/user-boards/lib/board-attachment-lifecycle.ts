import { storageService } from '@/services/storage.service';
import type { BoardAttachmentRef, BoardMediaObject, BoardObject } from './board-types';
import { createAttachmentRefFromArtifact, normalizeAttachmentRef } from './board-attachment-utils';
import { getBoardBlobUrl } from './board-blob-store';

const TEXT_PREVIEW_BYTES = 4096;

export async function checkArtifactAvailable(artifactId: string): Promise<boolean> {
  try {
    await storageService.getArtifact(artifactId);
    return true;
  } catch {
    return false;
  }
}

export async function refreshAttachmentFromStorage(
  ref: BoardAttachmentRef
): Promise<BoardAttachmentRef | null> {
  try {
    const detail = await storageService.getArtifact(ref.artifactId);
    return normalizeAttachmentRef({
      ...ref,
      name: detail.filename ?? ref.name,
      mimeType: detail.mime_type ?? ref.mimeType ?? ref.mime,
      size: detail.file_size != null ? Number(detail.file_size) : ref.size,
    });
  } catch {
    return null;
  }
}

export async function fetchTextHeadPreview(
  artifactId: string,
  maxBytes = TEXT_PREVIEW_BYTES
): Promise<string | null> {
  try {
    const blob = await storageService.fetchArtifactBlob(artifactId, 'inline');
    const slice = blob.slice(0, maxBytes);
    const text = await slice.text();
    return text;
  } catch {
    return null;
  }
}

export function removeCanvasPlacementsForAttachments(
  objects: BoardObject[],
  attachmentRefIds: string[]
): BoardObject[] {
  const idSet = new Set(attachmentRefIds);
  return objects.filter(
    (o) => !(o.type === 'media' && o.attachmentRefId && idSet.has(o.attachmentRefId))
  );
}

export interface BlobMigrateResult {
  migrated: number;
  failed: number;
  attachments: BoardAttachmentRef[];
  objectRewires: Array<{
    objectId: string;
    artifactId: string;
    attachmentRefId: string;
  }>;
}

/** Upload legacy canvas media (blobKey only) to cloud and return new library entries. */
export async function migrateBlobMediaToCloud(
  objects: BoardObject[],
  existingAttachments: BoardAttachmentRef[]
): Promise<BlobMigrateResult> {
  const existingIds = new Set(existingAttachments.map((a) => a.artifactId));
  const newAttachments: BoardAttachmentRef[] = [];
  const objectRewires: BlobMigrateResult['objectRewires'] = [];
  let migrated = 0;
  let failed = 0;

  for (const o of objects) {
    if (o.type !== 'media') continue;
    const m = o as BoardMediaObject;
    if (!m.blobKey || m.artifactId) continue;

    try {
      const url = await getBoardBlobUrl(m.blobKey);
      if (!url) {
        failed += 1;
        continue;
      }
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], m.name || 'media.bin', {
        type: m.mime || blob.type || 'application/octet-stream',
      });
      const upload = await storageService.uploadFileSmart(file);
      const artifactId = upload?.uploaded?.[0]?.id;
      if (!artifactId || existingIds.has(String(artifactId))) {
        failed += 1;
        continue;
      }
      const ref = createAttachmentRefFromArtifact(
        {
          artifactId: String(artifactId),
          name: m.name,
          mime_type: m.mime,
        },
        'upload'
      );
      existingIds.add(ref.artifactId);
      newAttachments.push(ref);
      objectRewires.push({
        objectId: m.id,
        artifactId: ref.artifactId,
        attachmentRefId: ref.id,
      });
      migrated += 1;
    } catch {
      failed += 1;
    }
  }

  return { migrated, failed, attachments: newAttachments, objectRewires };
}

export function applyBlobMigrateRewires(
  objects: BoardObject[],
  rewires: BlobMigrateResult['objectRewires']
): BoardObject[] {
  if (!rewires.length) return objects;
  const byId = new Map(rewires.map((r) => [r.objectId, r]));
  return objects.map((o) => {
    if (o.type !== 'media') return o;
    const patch = byId.get(o.id);
    if (!patch) return o;
    const { blobKey: _removed, ...rest } = o as BoardMediaObject;
    return {
      ...rest,
      artifactId: patch.artifactId,
      attachmentRefId: patch.attachmentRefId,
    };
  });
}
