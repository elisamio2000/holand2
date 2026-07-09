import { chatService } from '@/services/chat.service';
import type { ChatSession, UIMessage } from '@/types/chat.types';
import { buildConversationExportData } from './utils/build-export-data';
import { JSONExporter } from './exporters/json-exporter';
import { MarkdownExporter } from './exporters/markdown-exporter';
import { fetchExportEnrichment } from './utils/fetch-export-enrichment';
import type { ExportOptions } from './export-types';

export type BulkBackupMode = 'light' | 'full';
export type BulkBackupFormat = 'md' | 'json';

export interface BulkBackupProgress {
  phase: 'sessions' | 'messages' | 'files' | 'zip';
  current: number;
  total: number;
  sessionTitle?: string;
}

const EXPORT_OPTIONS: ExportOptions = {
  format: 'json',
  includeMetadata: true,
  includeThinking: true,
  includeToolRuns: true,
  includeArtifacts: true,
  embedAssets: false,
  assetMode: 'none',
};

async function fetchArtifactBlob(url: string, signal?: AbortSignal): Promise<Blob | null> {
  try {
    const res = await fetch(url, { signal, credentials: 'include' });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

export async function runBulkBackup(params: {
  sessionIds?: string[];
  mode: BulkBackupMode;
  formats?: BulkBackupFormat[];
  includeMemory?: boolean;
  includeTraces?: boolean;
  onProgress?: (progress: BulkBackupProgress) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const formats = params.formats?.length ? params.formats : (['json', 'md'] as BulkBackupFormat[]);
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const jsonExporter = new JSONExporter();
  const mdExporter = new MarkdownExporter();

  params.onProgress?.({ phase: 'sessions', current: 0, total: 1 });

  const allSessions = await chatService.listSessions({
    limit: 200,
    include_archived: true,
  });

  const sessions: ChatSession[] = params.sessionIds?.length
    ? allSessions.filter((s) => params.sessionIds!.includes(s.id))
    : allSessions;

  const manifest = {
    exportedAt: new Date().toISOString(),
    mode: params.mode,
    formats,
    includeMemory: Boolean(params.includeMemory),
    includeTraces: Boolean(params.includeTraces),
    sessionCount: sessions.length,
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updated_at: s.updated_at,
    })),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  for (let i = 0; i < sessions.length; i++) {
    if (params.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const session = sessions[i];
    params.onProgress?.({
      phase: 'messages',
      current: i + 1,
      total: sessions.length,
      sessionTitle: session.title,
    });

    const rawMessages = await chatService.listMessages(session.id, {
      limit: 500,
      include_tool_runs: true,
    });
    const messages = rawMessages as UIMessage[];
    const exportData = buildConversationExportData(session.id, session.title, messages);
    const enrichment = await fetchExportEnrichment(session.id, messages, {
      includeMemory: params.includeMemory,
      includeTraces: params.includeTraces,
    });
    const prefix = `sessions/${session.id}`;

    if (formats.includes('json')) {
      zip.file(
        `${prefix}/conversation.json`,
        jsonExporter.export(exportData, EXPORT_OPTIONS)
      );
    }
    if (formats.includes('md')) {
      zip.file(`${prefix}/conversation.md`, mdExporter.export(exportData, EXPORT_OPTIONS));
    }
    if (enrichment.memories?.length) {
      zip.file(`${prefix}/memory.json`, JSON.stringify(enrichment.memories, null, 2));
    }
    if (enrichment.traces?.length) {
      for (const tr of enrichment.traces) {
        zip.file(
          `${prefix}/traces/${tr.traceId}.json`,
          JSON.stringify(tr.trace, null, 2)
        );
      }
    }

    if (params.mode === 'full') {
      const seen = new Set<string>();
      for (const msg of messages) {
        const artifacts = msg.artifacts ?? [];
        for (const art of artifacts) {
          const id = art.id || art.path;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const url = art.id
            ? chatService.getArtifactUrl(art.id)
            : art.path
              ? chatService.getArtifactUrl(art.path)
              : '';
          if (!url) continue;
          params.onProgress?.({
            phase: 'files',
            current: i + 1,
            total: sessions.length,
            sessionTitle: session.title,
          });
          const blob = await fetchArtifactBlob(url, params.signal);
          if (blob) {
            const name = art.name || id.split('/').pop() || 'file';
            zip.file(`${prefix}/files/${name}`, blob);
          }
        }
      }
    }
  }

  params.onProgress?.({ phase: 'zip', current: 1, total: 1 });
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
