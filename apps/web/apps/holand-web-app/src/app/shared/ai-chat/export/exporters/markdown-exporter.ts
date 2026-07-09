import type {
  ConversationExportData,
  ExportLabels,
  ExportOptions,
  IExporter,
} from '../export-types';

function labels(options: ExportOptions): ExportLabels {
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

export class MarkdownExporter implements IExporter {
  export(data: ConversationExportData, options: ExportOptions): string {
    const L = labels(options);
    let md = `# ${data.title}\n\n`;

    if (options.includeMetadata) {
      md += `**${L.exportedAt}:** ${data.metadata.exportedAt}\n\n`;
      md += `**${L.model}:** ${data.metadata.model}\n\n`;
      md += `**${L.totalMessages}:** ${data.metadata.totalMessages}\n\n`;
      md += `---\n\n`;
    }

    for (const msg of data.messages) {
      const roleLabel = msg.role === 'user' ? L.user : L.assistant;
      const ts = new Date(msg.timestamp).toLocaleString();

      md += `## ${roleLabel}\n\n`;
      md += `*${ts}*\n\n`;
      md += `${msg.content}\n\n`;

      if (options.includeThinking && msg.thinking) {
        md += `### ${L.thinking}\n\n${msg.thinking}\n\n`;
      }

      if (options.includeToolRuns && msg.toolRuns?.length) {
        md += `### ${L.tools}\n\n`;
        for (const tool of msg.toolRuns) {
          md += `- **${tool.name}**: ${tool.status}\n`;
        }
        md += '\n';
      }

      if (options.includeArtifacts && msg.artifacts?.length) {
        md += `### ${L.attachments}\n\n`;
        for (const artifact of msg.artifacts) {
          const href = artifact.dataUri || artifact.relPath || artifact.url;
          if (artifact.mimeType.startsWith('image/') && href) {
            md += `![${artifact.filename}](${href})\n\n`;
          } else {
            md += `- [${artifact.filename}](${href})\n`;
          }
        }
        md += '\n';
      }

      if (options.includeMetadata) {
        const meta: string[] = [];
        if (msg.feedback) meta.push(`Feedback: ${msg.feedback}`);
        if (msg.processingTime != null)
          meta.push(`Processing: ${msg.processingTime.toFixed(2)}s`);
        if (msg.totalTokens != null) meta.push(`Tokens: ${msg.totalTokens}`);
        if (meta.length) md += `*${meta.join(' | ')}*\n\n`;
      }

      md += `---\n\n`;
    }

    if (data.embeddedAssets?.length) {
      md += `## ${L.sessionFiles}\n\n`;
      for (const asset of data.embeddedAssets) {
        const href = asset.href || asset.dataUri || asset.relPath || '';
        if (asset.mimeType.startsWith('image/')) {
          md += `### ${asset.filename}\n\n![${asset.filename}](${href})\n\n`;
        } else {
          md += `- [${asset.filename}](${href})\n`;
        }
      }
      md += '\n';
    }

    md += `---\n\n*${L.footer} — ${data.metadata.exportedAt}*\n`;
    return md;
  }
}
