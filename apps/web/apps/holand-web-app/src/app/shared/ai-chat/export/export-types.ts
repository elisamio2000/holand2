// ============================================
// Export Types — Type definitions for chat export functionality
// ============================================

export type ExportFormat = 'md' | 'json' | 'pdf' | 'docx' | 'html';

/** i18n labels — no emojis; passed from export menu */
export interface ExportLabels {
  user: string;
  assistant: string;
  thinking: string;
  tools: string;
  attachments: string;
  sessionFiles: string;
  exportedAt: string;
  model: string;
  totalMessages: string;
  footer: string;
  /** Sidebar second tab title (AI memory) */
  aiMemory?: string;
  /** File card "Preview" action */
  preview?: string;
  /** File card "Download" action */
  download?: string;
  /** Suffix after total size in the sidebar footer */
  totalSuffix?: string;
}

/**
 * How session files are packaged:
 * - inline: base64 data URIs embedded in the single output file (fully offline, large)
 * - zip:    files saved under `files/` in a ZIP; output references them via relative links
 * - none:   files are not exported
 */
export type AssetMode = 'inline' | 'zip' | 'none';

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeThinking?: boolean;
  includeToolRuns?: boolean;
  includeArtifacts?: boolean;
  stylesPreset?: 'compact' | 'standard' | 'detailed';
  /** Localized UI strings for export content */
  labels?: ExportLabels;
  /** Embed session files as base64 data URIs (legacy flag → assetMode 'inline') */
  embedAssets?: boolean;
  /** Packaging strategy for session files */
  assetMode?: AssetMode;
  /** Interactive HTML: Mermaid diagrams, syntax highlight, collapsible panels */
  interactiveHtml?: boolean;
  includeMemory?: boolean;
  includeTraces?: boolean;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  error?: string;
}

export interface EmbeddedAsset {
  id: string;
  filename: string;
  mimeType: string;
  /** High-level category (image/video/audio/document) when known. */
  mediaType?: string;
  /** ISO creation date when known. */
  createdAt?: string;
  /** Base64 data URI (inline mode). Empty in zip mode. */
  dataUri: string;
  /** Relative path inside the ZIP, e.g. "files/photo.jpg" (zip mode only). */
  relPath?: string;
  /** Best href to use in output: dataUri (inline) or relPath (zip). */
  href?: string;
  sizeBytes: number;
  sourceUrl?: string;
}

/** A binary file collected for ZIP packaging. */
export interface ZipFileEntry {
  relPath: string;
  blob: Blob;
}

/** Result of enriching export data with session files. */
export interface AssetEnrichResult {
  data: ConversationExportData;
  /** Files to add to a ZIP (only populated in zip mode). */
  zipFiles: ZipFileEntry[];
}

export interface ConversationExportData {
  sessionId: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    thinking?: string;
    artifacts?: Array<{
      id: string;
      filename: string;
      mimeType: string;
      url: string;
      dataUri?: string;
      /** Relative path inside the ZIP (zip mode only). */
      relPath?: string;
    }>;
    toolRuns?: Array<{
      id: string;
      name: string;
      status: string;
      input?: unknown;
      output?: unknown;
    }>;
    timestamp: string;
    feedback?: 'like' | 'dislike' | null;
    processingTime?: number;
    totalTokens?: number;
  }>;
  metadata: {
    exportedAt: string;
    totalMessages: number;
    model: string;
    userId?: string;
  };
  /** All session files embedded for offline export */
  embeddedAssets?: EmbeddedAsset[];
}

export interface IExporter {
  export(
    data: ConversationExportData,
    options: ExportOptions
  ): string | Promise<string> | Blob | Promise<Blob>;
}
