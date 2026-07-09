import type {
  ConversationExportData,
  ExportLabels,
  ExportOptions,
  IExporter,
} from '../export-types';
import { markdownToPlainText } from '../utils/markdown-helpers';

async function loadPdfMake(): Promise<{
  createPdf: (def: unknown) => { getBlob: (cb: (b: Blob) => void) => void };
}> {
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');

  const pdfMake = (pdfMakeModule as { default?: unknown }).default ?? pdfMakeModule;
  const pdfFonts =
    (pdfFontsModule as { default?: { pdfMake?: { vfs: unknown } }; pdfMake?: { vfs: unknown } })
      .default ?? pdfFontsModule;

  const vfs =
    (pdfFonts as { pdfMake?: { vfs: unknown } }).pdfMake?.vfs ??
    (pdfFonts as { default?: { pdfMake?: { vfs: unknown } } }).default?.pdfMake?.vfs;

  if (!vfs) {
    throw new Error('pdfmake: virtual font filesystem failed to load');
  }

  (pdfMake as { vfs: unknown }).vfs = vfs;
  return pdfMake as {
    createPdf: (def: unknown) => { getBlob: (cb: (b: Blob) => void) => void };
  };
}

function L(options: ExportOptions): ExportLabels {
  return (
    options.labels || {
      user: 'User',
      assistant: 'Assistant',
      thinking: 'Thinking',
      tools: 'Tools',
      attachments: 'Attachments',
      sessionFiles: 'Session files',
      exportedAt: 'Exported',
      model: 'Model',
      totalMessages: 'Messages',
      footer: 'Exported from AI Chat',
    }
  );
}

export class PDFExporter implements IExporter {
  async export(
    data: ConversationExportData,
    options: ExportOptions
  ): Promise<Blob> {
    const pdfMake = await loadPdfMake();
    const labels = L(options);
    const content: Record<string, unknown>[] = [];

    content.push({
      text: data.title,
      style: 'title',
      alignment: 'center',
      margin: [0, 0, 0, 16],
    });

    if (options.includeMetadata) {
      content.push({
        text: [
          `${labels.exportedAt}: ${new Date(data.metadata.exportedAt).toLocaleString()}\n`,
          `${labels.model}: ${data.metadata.model}\n`,
          `${labels.totalMessages}: ${data.metadata.totalMessages}`,
        ],
        style: 'metadata',
        alignment: 'center',
        margin: [0, 0, 0, 20],
      });
    }

    for (let idx = 0; idx < data.messages.length; idx++) {
      const msg = data.messages[idx];
      const roleLabel = msg.role === 'user' ? labels.user : labels.assistant;
      const ts = new Date(msg.timestamp).toLocaleString();

      content.push({
        columns: [
          { text: roleLabel, style: 'messageHeader' },
          { text: ts, style: 'timestamp', alignment: 'right' },
        ],
        margin: [0, 12, 0, 6],
      });

      const plain = markdownToPlainText(msg.content);
      if (plain) {
        content.push({ text: plain, margin: [0, 0, 0, 8] });
      }

      if (options.includeThinking && msg.thinking) {
        content.push({
          text: labels.thinking,
          style: 'sectionHeader',
          margin: [0, 8, 0, 4],
        });
        content.push({
          text: markdownToPlainText(msg.thinking),
          margin: [8, 0, 8, 8],
          background: '#f3f4f6',
        });
      }

      if (options.includeArtifacts && msg.artifacts?.length) {
        content.push({
          text: labels.attachments,
          style: 'sectionHeader',
          margin: [0, 8, 0, 4],
        });
        for (const art of msg.artifacts) {
          if (art.dataUri && art.mimeType.startsWith('image/')) {
            content.push({
              image: art.dataUri,
              width: 400,
              margin: [0, 4, 0, 8],
            });
            content.push({
              text: art.filename,
              style: 'caption',
              margin: [0, 0, 0, 8],
            });
          } else {
            content.push({
              text: `${art.filename} (${art.mimeType})`,
              margin: [0, 2, 0, 2],
            });
          }
        }
      }

      if (idx < data.messages.length - 1) {
        content.push({
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#e5e7eb',
            },
          ],
          margin: [0, 10, 0, 0],
        });
      }
    }

    if (data.embeddedAssets?.length) {
      content.push({
        text: labels.sessionFiles,
        style: 'sectionHeader',
        pageBreak: 'before',
        margin: [0, 16, 0, 8],
      });
      for (const asset of data.embeddedAssets) {
        if (asset.mimeType.startsWith('image/')) {
          content.push({
            image: asset.dataUri,
            width: 420,
            margin: [0, 8, 0, 4],
          });
        }
        content.push({
          text: asset.filename,
          style: 'caption',
          margin: [0, 0, 0, 12],
        });
      }
    }

    content.push({
      text: `${labels.footer} — ${data.metadata.exportedAt}`,
      style: 'footer',
      alignment: 'center',
      margin: [0, 24, 0, 0],
    });

    const docDefinition = {
      content,
      styles: {
        title: { fontSize: 22, bold: true, color: '#111827' },
        metadata: { fontSize: 9, color: '#6b7280' },
        messageHeader: { fontSize: 12, bold: true, color: '#2563eb' },
        timestamp: { fontSize: 9, color: '#9ca3af' },
        sectionHeader: { fontSize: 11, bold: true, color: '#374151' },
        caption: { fontSize: 9, color: '#6b7280', italics: true },
        footer: { fontSize: 9, color: '#6b7280', italics: true },
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
        color: '#111827',
        lineHeight: 1.35,
      },
      pageMargins: [48, 56, 48, 56],
    };

    return new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => resolve(blob));
      } catch (error) {
        reject(error);
      }
    });
  }
}
