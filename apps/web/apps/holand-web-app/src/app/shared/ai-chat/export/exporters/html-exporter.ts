import type {
  ConversationExportData,
  ExportOptions,
  IExporter,
} from '../export-types';
import { buildInteractiveChatHtml } from '../build-interactive-chat-html';

export class HTMLExporter implements IExporter {
  async export(
    data: ConversationExportData,
    options: ExportOptions
  ): Promise<string> {
    return buildInteractiveChatHtml(data, {
      ...options,
      interactiveHtml: options.interactiveHtml !== false,
      labels: options.labels,
    });
  }
}
