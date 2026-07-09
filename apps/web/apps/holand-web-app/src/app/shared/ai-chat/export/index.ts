// ============================================
// Export Orchestrator — Main export entry point
// ============================================

import { MarkdownExporter } from './exporters/markdown-exporter';
import { JSONExporter } from './exporters/json-exporter';
import { PDFExporter } from './exporters/pdf-exporter';
import { DOCXExporter } from './exporters/docx-exporter';
import { HTMLExporter } from './exporters/html-exporter';
import {
  downloadFile,
  sanitizeFilename,
  getMimeType,
  getTimestamp,
} from './utils/download-helper';
import { enrichExportDataWithAssets } from './utils/embed-assets';
import { printChatToPdf } from './print-chat-pdf';
import type { UIMessage } from '@/types/chat.types';
import type {
  AssetMode,
  ExportOptions,
  ExportResult,
  ConversationExportData,
  IExporter,
  ZipFileEntry,
} from './export-types';

const exporters: Record<string, IExporter> = {
  md: new MarkdownExporter(),
  json: new JSONExporter(),
  html: new HTMLExporter(),
};

export interface ExportConversationParams {
  sessionId: string;
  options: ExportOptions;
  preloadedData?: ConversationExportData;
  /** Raw UI messages — required to embed session attachments */
  messages?: UIMessage[];
}

/**
 * Export a conversation to the specified format.
 * Embeds session files as base64 when embedAssets is enabled (default).
 */
export async function exportConversation(
  sessionId: string,
  options: ExportOptions,
  preloadedData?: ConversationExportData,
  messages?: UIMessage[]
): Promise<ExportResult> {
  try {
    console.info(`[Export] Starting export for session ${sessionId} in format: ${options.format}`);

    let data = preloadedData ?? (await fetchConversationData(sessionId));

    if (!data || data.messages.length === 0) {
      throw new Error('No messages to export');
    }

    // Resolve packaging strategy for session files.
    const assetMode: AssetMode =
      options.assetMode ?? (options.embedAssets === false ? 'none' : 'inline');

    let zipFiles: ZipFileEntry[] = [];
    if (assetMode !== 'none' && messages?.length) {
      const enriched = await enrichExportDataWithAssets(data, messages, assetMode);
      data = enriched.data;
      zipFiles = enriched.zipFiles;
    }

    const timestamp = getTimestamp();
    const sanitizedTitle = sanitizeFilename(data.title || 'conversation');

    // PDF uses the browser print pipeline (faithful design + Persian, offline).
    if (options.format === 'pdf') {
      await printChatToPdf(data, options);
      return { success: true, filename: `${sanitizedTitle}.pdf` };
    }

    let content: string | Blob;

    if (options.format === 'docx') {
      content = await new DOCXExporter().export(data, options);
    } else {
      const exporter = exporters[options.format];
      if (!exporter) {
        throw new Error(`Unsupported export format: ${options.format}`);
      }
      content = await exporter.export(data, options);
    }

    // ZIP packaging: bundle the document + session files (relative links) into one archive.
    if (
      assetMode === 'zip' &&
      (options.format === 'html' || options.format === 'md') &&
      typeof content === 'string'
    ) {
      const { packageExportZip } = await import('./utils/zip-export');
      const zipBlob = await packageExportZip({
        documentName: `${sanitizedTitle}.${options.format}`,
        documentContent: content,
        files: zipFiles,
      });
      const zipFilename = `${sanitizedTitle}_${timestamp}.zip`;
      downloadFile(zipBlob, zipFilename, 'application/zip');
      console.info(`[Export] Successfully exported ZIP: ${zipFilename}`);
      return { success: true, filename: zipFilename };
    }

    const filename = `${sanitizedTitle}_${timestamp}.${options.format}`;

    downloadFile(content, filename, getMimeType(options.format));

    console.info(`[Export] Successfully exported: ${filename}`);

    return { success: true, filename };
  } catch (error) {
    console.error('[Export] Export failed:', error);

    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return { success: false, filename: '', error: errorMessage };
  }
}

async function fetchConversationData(sessionId: string): Promise<ConversationExportData> {
  const response = await fetch(`/api/chat/sessions/${sessionId}/export`);
  if (response.ok) {
    return (await response.json()) as ConversationExportData;
  }
  throw new Error('Failed to load conversation data');
}

export async function exportCurrentConversation(
  options: Omit<ExportOptions, 'format'> & { format: ExportOptions['format'] }
): Promise<ExportResult> {
  const pathParts = window.location.pathname.split('/');
  const sessionId = pathParts[pathParts.length - 1];

  if (!sessionId || sessionId === 'ai-chat') {
    throw new Error('No active conversation to export');
  }

  return exportConversation(sessionId, options);
}

export { MarkdownExporter, JSONExporter, PDFExporter, DOCXExporter, HTMLExporter };
export type { ExportOptions, ExportResult, ConversationExportData };
