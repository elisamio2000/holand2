import { createId } from '@paralleldrive/cuid2';
import type {
  BoardAttachmentCategory,
  BoardAttachmentRef,
  BoardAttachmentSource,
  BoardObject,
  BoardSnapshot,
} from './board-types';

/** Case importer folder prefix — align with backend case_importer layout. */
export function resolveCaseFilePrefix(caseId: string): string {
  const trimmed = caseId.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `case_importer/${trimmed}/` : '';
}

/** True when caseId yields a non-empty folder prefix for file manager scoping. */
export function isCasePrefixValid(caseId: string | undefined): boolean {
  if (!caseId?.trim()) return false;
  return resolveCaseFilePrefix(caseId).length > 0;
}

export function deriveAttachmentCategory(mime?: string): BoardAttachmentCategory {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (
    m.includes('pdf') ||
    m.startsWith('text/') ||
    m.includes('word') ||
    m.includes('document') ||
    m.includes('spreadsheet') ||
    m.includes('presentation')
  ) {
    return 'document';
  }
  if (
    m.includes('zip') ||
    m.includes('archive') ||
    m.includes('compressed') ||
    m.includes('tar') ||
    m.includes('gzip') ||
    m.includes('rar') ||
    m.includes('7z')
  ) {
    return 'archive';
  }
  return 'other';
}

export function attachmentMime(ref: BoardAttachmentRef): string | undefined {
  return ref.mimeType ?? ref.mime;
}

export function normalizeAttachmentRef(
  ref: Partial<BoardAttachmentRef> & Pick<BoardAttachmentRef, 'id' | 'artifactId' | 'name' | 'addedAt'>
): BoardAttachmentRef {
  const mimeType = ref.mimeType ?? ref.mime;
  return {
    id: ref.id,
    artifactId: ref.artifactId,
    name: ref.name,
    addedAt: ref.addedAt,
    mime: mimeType,
    mimeType,
    size: ref.size,
    source: ref.source ?? 'upload',
    thumbnailUrl: ref.thumbnailUrl,
    category: ref.category ?? deriveAttachmentCategory(mimeType),
  };
}

export function normalizeAttachmentList(
  attachments: BoardAttachmentRef[] | undefined
): BoardAttachmentRef[] {
  if (!Array.isArray(attachments)) return [];
  return attachments.map((a) =>
    normalizeAttachmentRef({
      ...a,
      id: a.id,
      artifactId: a.artifactId,
      name: a.name,
      addedAt: a.addedAt ?? new Date().toISOString(),
    })
  );
}

export function isDuplicateArtifact(
  attachments: BoardAttachmentRef[],
  artifactId: string
): boolean {
  return attachments.some((a) => a.artifactId === artifactId);
}

export function countAttachmentPlacements(
  objects: BoardObject[],
  attachmentRefId: string
): number {
  return objects.filter(
    (o) => o.type === 'media' && o.attachmentRefId === attachmentRefId
  ).length;
}

export function countAllPlacements(snapshot: BoardSnapshot): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of snapshot.objects) {
    if (o.type === 'media' && o.attachmentRefId) {
      counts.set(o.attachmentRefId, (counts.get(o.attachmentRefId) ?? 0) + 1);
    }
  }
  return counts;
}

export type AttachmentSortMode =
  | 'added-desc'
  | 'added-asc'
  | 'name-asc'
  | 'name-desc'
  | 'size-desc'
  | 'size-asc'
  | 'type';

export function sortAttachments(
  attachments: BoardAttachmentRef[],
  sortMode: AttachmentSortMode
): BoardAttachmentRef[] {
  const sorted = attachments.slice();
  switch (sortMode) {
    case 'added-desc':
      sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
      break;
    case 'added-asc':
      sorted.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'size-desc':
      sorted.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
      break;
    case 'size-asc':
      sorted.sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
      break;
    case 'type':
      sorted.sort(
        (a, b) =>
          (a.category ?? 'other').localeCompare(b.category ?? 'other') ||
          a.name.localeCompare(b.name)
      );
      break;
  }
  return sorted;
}

export function filterAttachments(
  attachments: BoardAttachmentRef[],
  opts: { search?: string; category?: BoardAttachmentCategory | null }
): BoardAttachmentRef[] {
  let out = attachments;
  if (opts.category) {
    out = out.filter((a) => (a.category ?? 'other') === opts.category);
  }
  const q = opts.search?.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.artifactId.toLowerCase().includes(q)
    );
  }
  return out;
}

export function createAttachmentRefFromArtifact(
  meta: {
    artifactId: string;
    name: string;
    mime_type?: string;
    size?: number;
    thumbnailUrl?: string;
  },
  source: BoardAttachmentSource
): BoardAttachmentRef {
  return normalizeAttachmentRef({
    id: createId(),
    artifactId: meta.artifactId,
    name: meta.name,
    mimeType: meta.mime_type,
    size: meta.size,
    source,
    thumbnailUrl: meta.thumbnailUrl,
    addedAt: new Date().toISOString(),
  });
}

export function formatAttachmentBytes(size?: number): string {
  if (size == null || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
