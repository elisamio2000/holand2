import { chatService } from '@/services/chat.service';
import { normalizeGatewayArtifactSrc } from '@/utils/gateway-media-url';
import type { UIMessage, ArtifactInput } from '@/types/chat.types';
import type {
  AssetEnrichResult,
  AssetMode,
  ConversationExportData,
  EmbeddedAsset,
  ZipFileEntry,
} from '../export-types';

// Inline mode keeps everything in one file → cap each asset to avoid huge documents.
const MAX_INLINE_BYTES = 12 * 1024 * 1024;
// ZIP mode writes raw files → allow much larger assets.
const MAX_ZIP_BYTES = 256 * 1024 * 1024;

interface AssetCandidate {
  id: string;
  filename: string;
  mimeType: string;
  mediaType?: string;
  createdAt?: string;
  fetchUrl: string;
  localBlobUrl?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function artifactKey(artifact: ArtifactInput): string {
  return artifact.id || artifact.path || artifact.name || '';
}

function pushCandidate(
  map: Map<string, AssetCandidate>,
  artifact: ArtifactInput,
  extra?: { mediaType?: string; createdAt?: string }
) {
  const id = artifactKey(artifact);
  if (!id || map.has(id)) return;

  const filename = artifact.name || id.split('/').pop() || 'file';
  const mimeType = artifact.mime_type || 'application/octet-stream';

  let fetchUrl = '';
  if (artifact.id) {
    fetchUrl = chatService.getArtifactUrl(artifact.id);
  } else if (artifact.path) {
    fetchUrl = chatService.getArtifactUrl(artifact.path);
  }

  const localBlobUrl =
    typeof artifact.localPreviewUrl === 'string' &&
    (artifact.localPreviewUrl.startsWith('blob:') ||
      artifact.localPreviewUrl.startsWith('data:'))
      ? artifact.localPreviewUrl
      : undefined;

  if (!fetchUrl && !localBlobUrl) return;

  map.set(id, {
    id,
    filename,
    mimeType,
    mediaType: extra?.mediaType,
    createdAt: extra?.createdAt,
    fetchUrl,
    localBlobUrl,
  });
}

function collectCandidates(
  messages: UIMessage[]
): Map<string, AssetCandidate> {
  const map = new Map<string, AssetCandidate>();

  for (const message of messages) {
    for (const artifact of message.artifacts || []) {
      pushCandidate(map, artifact);
    }
  }

  return map;
}

async function fetchAssetBlob(
  candidate: AssetCandidate,
  authHeaders: Record<string, string>
): Promise<Blob | null> {
  try {
    if (candidate.localBlobUrl) {
      const res = await fetch(candidate.localBlobUrl);
      if (res.ok) return await res.blob();
    }
    if (!candidate.fetchUrl) return null;
    const res = await fetch(candidate.fetchUrl, { headers: authHeaders });
    if (!res.ok) {
      console.warn('[Export] Asset fetch failed:', candidate.filename, res.status);
      return null;
    }
    return await res.blob();
  } catch (error) {
    console.warn('[Export] Asset fetch error:', candidate.filename, error);
    return null;
  }
}

function buildDataUri(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

/** Sanitize a filename for safe use inside a ZIP path, keeping the extension. */
function sanitizeAssetName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
  return cleaned || 'file';
}

/** Produce a unique relative path under files/ for a ZIP entry. */
function uniqueRelPath(used: Set<string>, filename: string): string {
  const safe = sanitizeAssetName(filename);
  const dot = safe.lastIndexOf('.');
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : '';
  let candidate = `files/${safe}`;
  let n = 1;
  while (used.has(candidate.toLowerCase())) {
    candidate = `files/${base}-${n}${ext}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Replace every reference to an asset (sourceUrl / id) with its export href. */
function replaceMediaUrls(text: string, assets: EmbeddedAsset[]): string {
  let result = text;
  for (const asset of assets) {
    const href = asset.href || asset.dataUri || asset.relPath;
    if (!href) continue;
    if (asset.sourceUrl) {
      result = result.split(asset.sourceUrl).join(href);
      const normalized = normalizeGatewayArtifactSrc(asset.sourceUrl);
      if (normalized && normalized !== asset.sourceUrl) {
        result = result.split(normalized).join(href);
      }
    }
    if (asset.id) result = result.split(asset.id).join(href);
  }
  return result;
}

function resolveMode(mode: AssetMode | undefined, embedAssets?: boolean): AssetMode {
  if (mode) return mode;
  // Legacy flag mapping.
  if (embedAssets === false) return 'none';
  return 'inline';
}

/**
 * Fetch all session attachments and attach them to the export data.
 *
 * - inline: assets become base64 data URIs embedded directly in the document.
 * - zip: assets are returned as `zipFiles` and referenced via relative `files/` links.
 * - none: nothing is fetched.
 *
 * Mirrors the graph-explorer offline guarantee: the exported artifact works
 * without any server connection.
 */
export async function enrichExportDataWithAssets(
  data: ConversationExportData,
  messages: UIMessage[],
  mode: AssetMode = 'inline'
): Promise<AssetEnrichResult> {
  if (mode === 'none') {
    return { data, zipFiles: [] };
  }

  const candidates = collectCandidates(messages);

  try {
    const sessionArtifacts = await chatService.getSessionArtifacts(data.sessionId);
    for (const artifact of sessionArtifacts) {
      pushCandidate(
        candidates,
        {
          id: artifact.id,
          path: artifact.storage_path || artifact.id,
          name: artifact.original_filename,
          mime_type: artifact.mime_type,
        },
        { mediaType: artifact.media_type, createdAt: artifact.created_at }
      );
    }
  } catch (error) {
    console.warn('[Export] Session artifacts list unavailable:', error);
  }

  const authHeaders = await chatService.getAuthHeaders();
  const embeddedAssets: EmbeddedAsset[] = [];
  const zipFiles: ZipFileEntry[] = [];
  const usedPaths = new Set<string>();
  const maxBytes = mode === 'zip' ? MAX_ZIP_BYTES : MAX_INLINE_BYTES;

  for (const candidate of candidates.values()) {
    const blob = await fetchAssetBlob(candidate, authHeaders);
    if (!blob || blob.size === 0) continue;
    if (blob.size > maxBytes) {
      console.warn('[Export] Skipping oversized asset:', candidate.filename, blob.size);
      continue;
    }

    const mimeType = blob.type || candidate.mimeType;

    if (mode === 'zip') {
      const relPath = uniqueRelPath(usedPaths, candidate.filename);
      zipFiles.push({ relPath, blob });
      embeddedAssets.push({
        id: candidate.id,
        filename: candidate.filename,
        mimeType,
        mediaType: candidate.mediaType,
        createdAt: candidate.createdAt,
        dataUri: '',
        relPath,
        href: relPath,
        sizeBytes: blob.size,
        sourceUrl: candidate.fetchUrl || undefined,
      });
    } else {
      const base64 = await blobToBase64(blob);
      const dataUri = buildDataUri(mimeType, base64);
      embeddedAssets.push({
        id: candidate.id,
        filename: candidate.filename,
        mimeType,
        mediaType: candidate.mediaType,
        createdAt: candidate.createdAt,
        dataUri,
        href: dataUri,
        sizeBytes: blob.size,
        sourceUrl: candidate.fetchUrl || undefined,
      });
    }
  }

  const assetById = new Map(embeddedAssets.map((a) => [a.id, a]));

  const messagesOut = data.messages.map((message) => {
    let content = message.content;
    let thinking = message.thinking;

    if (embeddedAssets.length > 0) {
      content = replaceMediaUrls(content, embeddedAssets);
      if (thinking) thinking = replaceMediaUrls(thinking, embeddedAssets);
    }

    const artifacts = message.artifacts?.map((artifact) => {
      const embedded = assetById.get(artifact.id);
      if (!embedded) return artifact;
      const href = embedded.href || embedded.dataUri || embedded.relPath || artifact.url;
      return {
        ...artifact,
        url: href,
        dataUri: embedded.dataUri || undefined,
        relPath: embedded.relPath,
      };
    });

    return { ...message, content, thinking, artifacts };
  });

  return {
    data: {
      ...data,
      messages: messagesOut,
      embeddedAssets,
    },
    zipFiles,
  };
}
