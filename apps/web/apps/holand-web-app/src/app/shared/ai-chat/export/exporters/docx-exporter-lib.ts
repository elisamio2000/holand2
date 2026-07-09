// ============================================
// Advanced DOCX Exporter — Using docx library
// More professional and customizable than docshift
// ============================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  ImageRun,
  convertInchesToTwip,
} from 'docx';
import type {
  ConversationExportData,
  ExportOptions,
  IExporter,
} from '../export-types';

/**
 * Advanced DOCX Exporter using docx library
 * 
 * Advantages over docshift:
 * - Full programmatic control
 * - Better TypeScript support
 * - More styling options
 * - Tables, sections, headers/footers
 * - TOC support
 */
const RTL_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Latin body font — Calibri ships with Word. */
const FONT_LATIN = 'Calibri';
/** Complex-script font — Tahoma shapes Persian/Arabic correctly without embedding. */
const FONT_CS = 'Tahoma';

function containsRTL(text: string): boolean {
  return RTL_RE.test(text);
}

/** True when the conversation is predominantly RTL (Persian/Arabic). */
function detectDocRtl(data: ConversationExportData): boolean {
  let rtl = 0;
  let total = 0;
  for (const msg of data.messages) {
    const sample = `${msg.content}${msg.thinking || ''}`;
    for (const ch of sample) {
      total += 1;
      if (RTL_RE.test(ch)) rtl += 1;
    }
  }
  return total > 0 && rtl / total > 0.08;
}

type FontSpec = { ascii: string; hAnsi: string; cs: string; eastAsia: string };

function fontSpec(rtl: boolean): FontSpec {
  if (rtl) {
    return { ascii: FONT_CS, hAnsi: FONT_CS, cs: FONT_CS, eastAsia: FONT_CS };
  }
  return { ascii: FONT_LATIN, hAnsi: FONT_LATIN, cs: FONT_CS, eastAsia: FONT_LATIN };
}

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  color?: string;
  font?: string;
}

function makeRun(text: string, docRtl: boolean, style: RunStyle = {}): TextRun {
  const rtl = docRtl || containsRTL(text);
  const size = style.size ?? 22;
  const fonts = style.font
    ? { ascii: style.font, hAnsi: style.font, cs: FONT_CS, eastAsia: style.font }
    : fontSpec(rtl);
  return new TextRun({
    text,
    size,
    bold: style.bold,
    italics: style.italics,
    color: style.color,
    font: fonts,
    rightToLeft: rtl,
  });
}

type ParagraphOptions = Extract<
  ConstructorParameters<typeof Paragraph>[0],
  object
>;

function rtlParagraph(
  props: ParagraphOptions,
  text: string,
  docRtl: boolean
): Paragraph {
  const rtl = docRtl || containsRTL(text);
  return new Paragraph({
    ...props,
    bidirectional: rtl,
    alignment: rtl ? AlignmentType.RIGHT : props.alignment,
  });
}

function dataUriToUint8Array(dataUri: string): Uint8Array | null {
  const commaIdx = dataUri.indexOf(',');
  if (commaIdx === -1) return null;
  try {
    const base64 = dataUri.slice(commaIdx + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function imageTypeFromMime(
  mime: string
): 'png' | 'jpg' | 'gif' | 'bmp' | null {
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('bmp')) return 'bmp';
  return null;
}

export class AdvancedDOCXExporter implements IExporter {
  private docRtl = false;

  async export(
    data: ConversationExportData,
    options: ExportOptions
  ): Promise<Blob> {
    this.docRtl = detectDocRtl(data);
    const defaultFonts = fontSpec(this.docRtl);

    const doc = new Document({
      // Tahoma (cs) renders Persian correctly in Word without font embedding.
      styles: {
        default: {
          document: {
            run: {
              font: defaultFonts,
              size: 22,
              rightToLeft: this.docRtl,
            },
            paragraph: {
              alignment: this.docRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            },
          },
        },
      },
      numbering: {
        config: [
          {
            reference: 'export-numbering',
            levels: [
              {
                level: 0,
                format: 'decimal',
                text: '%1.',
                alignment: AlignmentType.START,
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          children: [
            // Title page
            ...this.createTitlePage(data, options, this.docRtl),
            
            // Separator
            new Paragraph({
              text: '',
              border: {
                bottom: {
                  color: '2563eb',
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
              spacing: { after: 400 },
            }),
            
            // Messages
            ...this.createMessages(data, options, this.docRtl),
            
            // Footer
            ...this.createFooter(data, options),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    return blob;
  }

  private createTitlePage(
    data: ConversationExportData,
    options: ExportOptions,
    docRtl: boolean
  ): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const title = data.title || 'Conversation Export';

    paragraphs.push(
      rtlParagraph(
        {
          text: title,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        },
        title,
        docRtl
      )
    );

    if (options.includeMetadata) {
      const L = options.labels;
      const metadata = [
        `${L?.exportedAt || 'Exported'}: ${new Date(data.metadata.exportedAt).toLocaleString()}`,
        `${L?.model || 'Model'}: ${data.metadata.model}`,
        `${L?.totalMessages || 'Messages'}: ${data.metadata.totalMessages}`,
      ];

      metadata.forEach((text) => {
        paragraphs.push(
          rtlParagraph(
            {
              children: [makeRun(text, docRtl, { size: 20, color: '666666' })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            },
            text,
            docRtl
          )
        );
      });

      paragraphs.push(
        new Paragraph({
          text: '',
          spacing: { after: 200 },
        })
      );
    }

    return paragraphs;
  }

  private createMessages(
    data: ConversationExportData,
    options: ExportOptions,
    docRtl: boolean
  ): (Paragraph | Table)[] {
    const paragraphs: (Paragraph | Table)[] = [];

    data.messages.forEach((message, idx) => {
      // Message header
      const role =
        message.role === 'user'
          ? options.labels?.user || 'User'
          : options.labels?.assistant || 'Assistant';
      const roleColor = message.role === 'user' ? '7c3aed' : '2563eb';
      const timestamp = new Date(message.timestamp).toLocaleString();

      paragraphs.push(
        rtlParagraph(
          {
            children: [
              makeRun(role, docRtl, { bold: true, size: 28, color: roleColor }),
              makeRun(`    ${timestamp}`, docRtl, { size: 18, color: '9ca3af' }),
            ],
            spacing: { before: idx === 0 ? 0 : 400, after: 200 },
          },
          role,
          docRtl
        )
      );

      // Message content
      const contentParagraphs = this.parseMarkdownContent(message.content, {}, docRtl);
      paragraphs.push(...contentParagraphs);

      // Thinking process
      if (options.includeThinking && message.thinking) {
        paragraphs.push(
          rtlParagraph(
            {
              children: [
                makeRun(options.labels?.thinking || 'Thinking', docRtl, {
                  bold: true,
                  size: 24,
                  color: '059669',
                }),
              ],
              spacing: { before: 200, after: 100 },
            },
            options.labels?.thinking || 'Thinking',
            docRtl
          )
        );

        const thinkingParagraphs = this.parseMarkdownContent(
          message.thinking,
          { background: 'f0fdf4' },
          docRtl
        );
        paragraphs.push(...thinkingParagraphs);
      }

      // Tool runs
      if (options.includeToolRuns && message.toolRuns && message.toolRuns.length > 0) {
        paragraphs.push(
          rtlParagraph(
            {
              children: [
                makeRun(options.labels?.tools || 'Tools', docRtl, {
                  bold: true,
                  size: 24,
                  color: '1e40af',
                }),
              ],
              spacing: { before: 200, after: 100 },
            },
            options.labels?.tools || 'Tools',
            docRtl
          )
        );

        message.toolRuns.forEach((tool: { name: string; status: string }) => {
          const line = `• ${tool.name}: ${tool.status}`;
          paragraphs.push(
            rtlParagraph(
              {
                children: [
                  makeRun('• ', docRtl, { size: 22 }),
                  makeRun(tool.name, docRtl, { bold: true, size: 22 }),
                  makeRun(`: ${tool.status}`, docRtl, { size: 22 }),
                ],
                spacing: { after: 80 },
              },
              line,
              docRtl
            )
          );
        });
      }

      // Artifacts
      if (options.includeArtifacts && message.artifacts && message.artifacts.length > 0) {
        paragraphs.push(
          rtlParagraph(
            {
              children: [
                makeRun(options.labels?.attachments || 'Attachments', docRtl, {
                  bold: true,
                  size: 24,
                  color: '92400e',
                }),
              ],
              spacing: { before: 200, after: 100 },
            },
            options.labels?.attachments || 'Attachments',
            docRtl
          )
        );

        message.artifacts.forEach((artifact) => {
          const imgType = imageTypeFromMime(artifact.mimeType);
          const bytes = artifact.dataUri
            ? dataUriToUint8Array(artifact.dataUri)
            : null;

          if (imgType && bytes) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: bytes,
                    type: imgType,
                    transformation: { width: 420, height: 280 },
                  }),
                ],
                spacing: { before: 80, after: 40 },
              })
            );
            paragraphs.push(
              rtlParagraph(
                {
                  children: [makeRun(artifact.filename, docRtl, { size: 18, color: '6b7280', italics: true })],
                  spacing: { after: 80 },
                },
                artifact.filename,
                docRtl
              )
            );
          } else {
            const line = `• ${artifact.filename} (${artifact.mimeType})`;
            paragraphs.push(
              rtlParagraph(
                {
                  children: [makeRun(line, docRtl, { size: 22 })],
                  spacing: { after: 80 },
                },
                line,
                docRtl
              )
            );
          }
        });
      }

      // Message metadata
      if (options.includeMetadata) {
        const meta: string[] = [];
        if (message.feedback) {
          meta.push(`${message.feedback}`);
        }
        if (message.processingTime != null) {
          meta.push(`${message.processingTime.toFixed(2)}s`);
        }
        if (message.totalTokens != null) {
          meta.push(`${message.totalTokens} tokens`);
        }

        if (meta.length > 0) {
          const metaLine = meta.join(' • ');
          paragraphs.push(
            rtlParagraph(
              {
                children: [makeRun(metaLine, docRtl, { size: 18, color: '6b7280' })],
                spacing: { before: 100, after: 0 },
              },
              metaLine,
              docRtl
            )
          );
        }
      }
    });

    return paragraphs;
  }

  private parseMarkdownContent(
    markdown: string,
    opts: { background?: string } = {},
    docRtl = false
  ): (Paragraph | Table)[] {
    const blocks: (Paragraph | Table)[] = [];
    const lines = markdown.split('\n');

    const isTableSep = (l: string) =>
      /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(l);
    const splitRow = (l: string) => {
      let t = l.trim();
      if (t.startsWith('|')) t = t.slice(1);
      if (t.endsWith('|')) t = t.slice(0, -1);
      return t.split('|').map((c) => c.trim());
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Fenced code block
      if (line.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push(
          rtlParagraph(
            {
              children: [
                makeRun(codeLines.join('\n'), docRtl, {
                  font: 'Courier New',
                  size: 20,
                  color: '1e293b',
                }),
              ],
              shading: { type: ShadingType.SOLID, color: 'f3f4f6' },
              spacing: { before: 100, after: 100 },
            },
            codeLines.join('\n'),
            docRtl
          )
        );
        continue;
      }

      // GFM table
      if (
        line.includes('|') &&
        i + 1 < lines.length &&
        isTableSep(lines[i + 1])
      ) {
        const headers = splitRow(line);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        i--; // step back; outer loop will i++

        const headerRow = new TableRow({
          tableHeader: true,
          children: headers.map(
            (h) =>
              new TableCell({
                shading: { type: ShadingType.SOLID, color: 'f3f4f6' },
                children: [
                  rtlParagraph(
                    {
                      children: [makeRun(h, docRtl, { bold: true, size: 20 })],
                    },
                    h,
                    docRtl
                  ),
                ],
              })
          ),
        });

        const bodyRows = rows.map(
          (r) =>
            new TableRow({
              children: r.map(
                (c) =>
                  new TableCell({
                    children: [
                      rtlParagraph(
                        {
                          children: this.parseInlineFormatting(c, docRtl),
                        },
                        c,
                        docRtl
                      ),
                    ],
                  })
              ),
            })
        );

        blocks.push(
          new Table({
            visuallyRightToLeft: docRtl,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 2, color: 'd1d5db' },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: 'd1d5db' },
              left: { style: BorderStyle.SINGLE, size: 2, color: 'd1d5db' },
              right: { style: BorderStyle.SINGLE, size: 2, color: 'd1d5db' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'e5e7eb' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'e5e7eb' },
            },
            rows: [headerRow, ...bodyRows],
          })
        );
        continue;
      }

      // Empty line
      if (!line.trim()) {
        blocks.push(new Paragraph({ text: '', spacing: { before: 60, after: 60 } }));
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        blocks.push(
          rtlParagraph(
            { text: line.slice(2), heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } },
            line,
            docRtl
          )
        );
        continue;
      }
      if (line.startsWith('## ')) {
        blocks.push(
          rtlParagraph(
            { text: line.slice(3), heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 90 } },
            line,
            docRtl
          )
        );
        continue;
      }
      if (line.startsWith('### ')) {
        blocks.push(
          rtlParagraph(
            { text: line.slice(4), heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } },
            line,
            docRtl
          )
        );
        continue;
      }

      // List item (ordered or unordered)
      const listMatch = line.match(/^\s*([*+-]|\d+\.)\s+(.*)$/);
      if (listMatch) {
        const text = listMatch[2];
        const ordered = /\d+\./.test(listMatch[1]);
        blocks.push(
          rtlParagraph(
            {
              children: this.parseInlineFormatting(text, docRtl),
              ...(ordered
                ? { numbering: { reference: 'export-numbering', level: 0 } }
                : { bullet: { level: 0 } }),
              spacing: { after: 60 },
            },
            text,
            docRtl
          )
        );
        continue;
      }

      // Blockquote
      if (/^\s*>\s?/.test(line)) {
        const text = line.replace(/^\s*>\s?/, '');
        const bqBorder = docRtl || containsRTL(text)
          ? { right: { style: BorderStyle.SINGLE, size: 12, color: 'd1d5db', space: 8 } }
          : { left: { style: BorderStyle.SINGLE, size: 12, color: 'd1d5db', space: 8 } };
        blocks.push(
          rtlParagraph(
            {
              children: this.parseInlineFormatting(text, docRtl),
              indent: docRtl
                ? { right: convertInchesToTwip(0.3) }
                : { left: convertInchesToTwip(0.3) },
              border: bqBorder,
              spacing: { after: 80 },
            },
            text,
            docRtl
          )
        );
        continue;
      }

      // Regular paragraph
      blocks.push(
        rtlParagraph(
          {
            children: this.parseInlineFormatting(line, docRtl),
            spacing: { after: 120 },
            ...(opts.background && {
              shading: { type: ShadingType.SOLID, color: opts.background },
            }),
          },
          line,
          docRtl
        )
      );
    }

    return blocks;
  }

  private parseInlineFormatting(text: string, docRtl = false): TextRun[] {
    const runs: TextRun[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        runs.push(makeRun(text.slice(lastIndex, match.index), docRtl));
      }

      const matched = match[0];

      if (matched.startsWith('**')) {
        runs.push(makeRun(matched.slice(2, -2), docRtl, { bold: true }));
      } else if (matched.startsWith('*')) {
        runs.push(makeRun(matched.slice(1, -1), docRtl, { italics: true }));
      } else if (matched.startsWith('`')) {
        runs.push(
          makeRun(matched.slice(1, -1), docRtl, {
            font: 'Courier New',
            size: 20,
            color: 'db2777',
          })
        );
      }

      lastIndex = match.index + matched.length;
    }

    if (lastIndex < text.length) {
      runs.push(makeRun(text.slice(lastIndex), docRtl));
    }

    return runs.length > 0 ? runs : [makeRun(text, docRtl)];
  }

  private createFooter(
    data: ConversationExportData,
    options: ExportOptions
  ): Paragraph[] {
    const footerLabel = options.labels?.footer || 'Exported from AI Chat';
    return [
      new Paragraph({
        text: '',
        spacing: { before: 400 },
        border: {
          top: {
            color: 'e5e7eb',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      }),
      rtlParagraph(
        {
          children: [
            makeRun(`${footerLabel} — ${data.metadata.exportedAt}`, this.docRtl, {
              size: 18,
              color: '6b7280',
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
        },
        footerLabel,
        this.docRtl
      ),
    ];
  }
}
