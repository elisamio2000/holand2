import type {
  ConversationExportData,
  ExportOptions,
  IExporter,
} from '../export-types';

/**
 * DOCX exporter — uses the `docx` library (reliable, supports fonts, tables,
 * RTL/bidi). docshift was dropped: unreliable HTML->docx, no table/font control.
 */
export class DOCXExporter implements IExporter {
  async export(
    data: ConversationExportData,
    options: ExportOptions
  ): Promise<Blob> {
    const { AdvancedDOCXExporter } = await import('./docx-exporter-lib');
    return new AdvancedDOCXExporter().export(data, options);
  }
}
