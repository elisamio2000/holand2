import type { ExportLabels } from '../export-types';

/** Build localized labels passed into the exporters (no emojis, i18n-driven). */
export function buildExportLabels(t: (key: string) => string): ExportLabels {
  return {
    user: t('chatPage.exportLabels.user'),
    assistant: t('chatPage.exportLabels.assistant'),
    thinking: t('chatPage.exportLabels.thinking'),
    tools: t('chatPage.exportLabels.tools'),
    attachments: t('chatPage.exportLabels.attachments'),
    sessionFiles: t('chatPage.exportLabels.sessionFiles'),
    exportedAt: t('chatPage.exportLabels.exportedAt'),
    model: t('chatPage.exportLabels.model'),
    totalMessages: t('chatPage.exportLabels.totalMessages'),
    footer: t('chatPage.exportLabels.footer'),
    aiMemory: t('chatPage.exportLabels.aiMemory'),
    preview: t('chatPage.exportLabels.preview'),
    download: t('chatPage.exportLabels.download'),
    totalSuffix: t('chatPage.exportLabels.totalSuffix'),
  };
}
