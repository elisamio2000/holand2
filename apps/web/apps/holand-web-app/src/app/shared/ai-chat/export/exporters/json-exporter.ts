// ============================================
// JSON Exporter — Export chat to JSON format
// ============================================

import type {
  ConversationExportData,
  ExportOptions,
  IExporter,
} from '../export-types';

export class JSONExporter implements IExporter {
  export(data: ConversationExportData, options: ExportOptions): string {
    // Filter data based on options
    const filtered: ConversationExportData = {
      ...data,
      embeddedAssets: options.embedAssets !== false ? data.embeddedAssets : undefined,
      messages: data.messages.map((msg) => {
        const filtered: any = {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        };

        if (options.includeThinking && msg.thinking) {
          filtered.thinking = msg.thinking;
        }

        if (options.includeToolRuns && msg.toolRuns) {
          filtered.toolRuns = msg.toolRuns;
        }

        if (options.includeArtifacts && msg.artifacts) {
          filtered.artifacts = msg.artifacts;
        }

        if (options.includeMetadata) {
          if (msg.feedback) filtered.feedback = msg.feedback;
          if (msg.processingTime != null) filtered.processingTime = msg.processingTime;
          if (msg.totalTokens != null) filtered.totalTokens = msg.totalTokens;
        }

        return filtered;
      }),
    };

    return JSON.stringify(filtered, null, 2);
  }
}
