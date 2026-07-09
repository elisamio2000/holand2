// ============================================
// file_manager.list → OneSearchHit
// ============================================

import { routes } from '@/config/routes';
import { THUMBNAIL_PRESETS } from '@/config/file-upload.config';
import { storageService } from '@/services/storage.service';
import { supportsStorageThumbnailEndpoint } from '@/utils/storage-media-url';
import type { Artifact } from '@/types/storage.types';
import type { OneSearchHit, OneSearchLaneId } from '@/types/one-search.types';

const FM_TOOL = 'plugin.file_manager.list';
const FM_ENDPOINT = '/tools/plugin_file_manager_list/execute';

function isMediaArtifact(artifact: Artifact): boolean {
  const mime = (artifact.mime_type || '').toLowerCase();
  const media = (artifact.media_type || '').toLowerCase();
  return (
    mime.startsWith('image/') ||
    mime.startsWith('audio/') ||
    mime.startsWith('video/') ||
    media === 'image' ||
    media === 'audio' ||
    media === 'video'
  );
}

export function laneForArtifact(artifact: Artifact): OneSearchLaneId {
  return isMediaArtifact(artifact) ? 'storage' : 'files';
}

export function mapArtifactToHit(
  artifact: Artifact,
  query: string,
  args: Record<string, unknown>
): OneSearchHit {
  const lane = laneForArtifact(artifact);
  const preset = THUMBNAIL_PRESETS.fileExplorerGrid;
  const thumbUrl = supportsStorageThumbnailEndpoint(
    artifact.mime_type,
    artifact.media_type
  )
    ? storageService.getThumbnailUrl(
        artifact.id,
        preset.width,
        preset.height,
        'webp',
        preset.quality,
        artifact.mime_type,
        artifact.media_type
      )
    : undefined;

  return {
    id: `fm-${artifact.id}`,
    title: artifact.filename || artifact.id,
    snippet: [
      artifact.mime_type,
      artifact.folder_path ? `path: ${artifact.folder_path}` : null,
      artifact.uploaded_by ? `by ${artifact.uploaded_by}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    href: `${routes.fileExplorer}?search=${encodeURIComponent(query)}&artifact=${artifact.id}`,
    occurredAt: artifact.created_at,
    meta: {
      mime: artifact.mime_type,
      media_type: artifact.media_type,
      artifact_id: artifact.id,
      session_id: artifact.session_id,
      path: artifact.folder_path,
      source: FM_TOOL,
      sourceEndpoint: FM_ENDPOINT,
      sourceArgs: args,
      lane,
      url: storageService.getDownloadUrl(artifact.id, 'inline'),
      thumb_url: thumbUrl ?? undefined,
      size_bytes: artifact.file_size,
    },
  };
}

export function mapArtifactsToHits(
  items: Artifact[],
  query: string,
  args: Record<string, unknown>
): { files: OneSearchHit[]; storage: OneSearchHit[] } {
  const files: OneSearchHit[] = [];
  const storage: OneSearchHit[] = [];
  for (const item of items) {
    const hit = mapArtifactToHit(item, query, args);
    if (laneForArtifact(item) === 'storage') storage.push(hit);
    else files.push(hit);
  }
  return { files, storage };
}

export { FM_ENDPOINT, FM_TOOL };
