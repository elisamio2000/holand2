import { storageService } from '@/services/storage.service';
import type { BoardAttachmentRef, BoardObject } from './board-types';
import { createAttachmentRefFromArtifact } from './board-attachment-utils';
import { buildMediaFromAttachment } from '../hooks/use-board-attachments';
import { nextZIndex } from './board-snapshot';

export interface CaseImportResult {
  attachments: BoardAttachmentRef[];
  mediaObjects: BoardObject[];
}

/** Import case-scoped images as library entries + media placements in a grid. */
export async function importCaseImagesToBoard(
  caseId: string,
  existingArtifactIds: Set<string>,
  startX = 0,
  startY = 0
): Promise<CaseImportResult> {
  const prefix = `case_importer/${caseId.trim().replace(/^\/+|\/+$/g, '')}/`;
  const res = await storageService.listFilesForExplorer({
    folder_prefix: prefix,
    session_id: caseId,
    page: 1,
    page_size: 40,
    media_type: 'image',
  });
  const items = (res.items ?? []).filter((a) => !existingArtifactIds.has(a.id));
  const attachments: BoardAttachmentRef[] = [];
  const mediaObjects: BoardObject[] = [];
  let col = 0;
  let row = 0;
  const cellW = 180;
  const cellH = 140;
  const cols = 4;

  for (const item of items) {
    const ref = createAttachmentRefFromArtifact(
      {
        artifactId: item.id,
        name: item.filename ?? item.id,
        mime_type: item.mime_type ?? undefined,
        size: item.file_size != null ? Number(item.file_size) : undefined,
      },
      'case'
    );
    attachments.push(ref);
    const x = startX + col * cellW;
    const y = startY + row * cellH;
    const z = nextZIndex({ objects: mediaObjects } as import('./board-types').BoardSnapshot);
    mediaObjects.push(
      buildMediaFromAttachment(ref, {
        x,
        y,
        width: 160,
        height: 120,
        z,
      })
    );
    col += 1;
    if (col >= cols) {
      col = 0;
      row += 1;
    }
  }

  return { attachments, mediaObjects };
}
