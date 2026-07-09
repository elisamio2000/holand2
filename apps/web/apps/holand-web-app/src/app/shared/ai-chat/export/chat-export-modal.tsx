'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Text, Title } from 'rizzui';
import {
  PiXBold,
  PiFileText,
  PiFileCode,
  PiFileHtml,
  PiFilePdf,
  PiFileDoc,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import type { UIMessage } from '@/types/chat.types';
import { exportConversation } from './index';
import { buildConversationExportData } from './utils/build-export-data';
import { buildExportLabels } from './utils/build-export-labels';
import type {
  AssetMode,
  ExportFormat,
  ExportOptions,
} from './export-types';

export interface ChatExportModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionTitle?: string;
  messages: UIMessage[];
}

const FORMATS: Array<{ format: ExportFormat; icon: typeof PiFileText; labelKey: string }> = [
  { format: 'html', icon: PiFileHtml, labelKey: 'chatPage.exportFormats.html' },
  { format: 'md', icon: PiFileText, labelKey: 'chatPage.exportFormats.md' },
  { format: 'pdf', icon: PiFilePdf, labelKey: 'chatPage.exportFormats.pdf' },
  { format: 'docx', icon: PiFileDoc, labelKey: 'chatPage.exportFormats.docx' },
  { format: 'json', icon: PiFileCode, labelKey: 'chatPage.exportFormats.json' },
];

/** Formats where a ZIP (relative-link) package is meaningful. */
function supportsZip(format: ExportFormat): boolean {
  return format === 'html' || format === 'md';
}

export default function ChatExportModal({
  open,
  onClose,
  sessionId,
  sessionTitle,
  messages,
}: ChatExportModalProps) {
  const { t } = useTranslation();

  const [format, setFormat] = useState<ExportFormat>('html');
  const [assetMode, setAssetMode] = useState<AssetMode>('inline');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeThinking, setIncludeThinking] = useState(true);
  const [includeToolRuns, setIncludeToolRuns] = useState(true);
  const [includeArtifacts, setIncludeArtifacts] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleFormatChange = useCallback((next: ExportFormat) => {
    setFormat(next);
    setAssetMode((prev) => (prev === 'zip' && !supportsZip(next) ? 'inline' : prev));
  }, []);

  const handleDownload = useCallback(async () => {
    if (exporting || messages.length === 0) return;
    setExporting(true);

    const data = buildConversationExportData(sessionId, sessionTitle || '', messages);
    const options: ExportOptions = {
      format,
      includeMetadata,
      includeThinking,
      includeToolRuns,
      includeArtifacts,
      assetMode,
      interactiveHtml: format === 'html',
      stylesPreset: 'standard',
      labels: buildExportLabels(t),
    };

    try {
      const result = await exportConversation(sessionId, options, data, messages);
      if (result.success) {
        toast.success(t('chatPage.exportSuccess', { filename: result.filename }));
        onClose();
      } else {
        toast.error(result.error || t('chatPage.exportFailed'));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('chatPage.exportFailed');
      toast.error(msg);
      console.error('[ChatExportModal] Export error:', error);
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    messages,
    sessionId,
    sessionTitle,
    format,
    includeMetadata,
    includeThinking,
    includeToolRuns,
    includeArtifacts,
    assetMode,
    t,
    onClose,
  ]);

  if (!open) return null;

  const canZip = supportsZip(format);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-muted bg-gray-0 shadow-2xl dark:bg-gray-50">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-muted px-4 py-3">
          <div>
            <Title as="h3" className="text-base font-semibold">
              {t('chatPage.exportModal.title')}
            </Title>
            <Text className="mt-0.5 text-xs text-gray-500">
              {t('chatPage.exportModal.subtitle')}
            </Text>
          </div>
          <button
            type="button"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200"
            onClick={onClose}
            aria-label="Close"
          >
            <PiXBold className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 overflow-y-auto px-4 py-4">
          {/* Format picker */}
          <div>
            <Text className="mb-1.5 text-xs font-medium text-gray-600">
              {t('chatPage.exportModal.format')}
            </Text>
            <div className="grid grid-cols-5 gap-2">
              {FORMATS.map(({ format: f, icon: Icon, labelKey }) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFormatChange(f)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] font-medium transition-colors',
                    format === f
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted text-gray-600 hover:border-primary/30 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-100/40'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Session files packaging */}
          <div className="space-y-2 rounded-lg border border-muted p-3">
            <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t('chatPage.exportModal.sessionFilesGroup')}
            </Text>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="radio"
                name="asset-mode"
                checked={assetMode === 'inline'}
                onChange={() => setAssetMode('inline')}
                className="accent-primary"
              />
              {t('chatPage.exportModal.assetInline')}
            </label>
            {canZip && (
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="asset-mode"
                  checked={assetMode === 'zip'}
                  onChange={() => setAssetMode('zip')}
                  className="accent-primary"
                />
                {t('chatPage.exportModal.assetZip')}
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="radio"
                name="asset-mode"
                checked={assetMode === 'none'}
                onChange={() => setAssetMode('none')}
                className="accent-primary"
              />
              {t('chatPage.exportModal.assetNone')}
            </label>
            {assetMode !== 'none' && (
              <Text className="pt-1 text-[11px] leading-relaxed text-gray-500">
                {assetMode === 'zip'
                  ? t('chatPage.exportModal.zipHint')
                  : t('chatPage.exportModal.inlineHint')}
              </Text>
            )}
          </div>

          {/* Content toggles */}
          <div className="space-y-2 rounded-lg border border-muted p-3">
            <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t('chatPage.exportModal.content')}
            </Text>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={includeMetadata}
                onChange={() => setIncludeMetadata((v) => !v)}
              />
              {t('chatPage.exportModal.includeMetadata')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={includeThinking}
                onChange={() => setIncludeThinking((v) => !v)}
              />
              {t('chatPage.exportModal.includeThinking')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={includeToolRuns}
                onChange={() => setIncludeToolRuns((v) => !v)}
              />
              {t('chatPage.exportModal.includeToolRuns')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={includeArtifacts}
                onChange={() => setIncludeArtifacts((v) => !v)}
              />
              {t('chatPage.exportModal.includeArtifacts')}
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-muted px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={exporting}>
            {t('chatPage.exportModal.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={() => void handleDownload()}
            isLoading={exporting}
            disabled={messages.length === 0}
          >
            {exporting
              ? t('chatPage.exportModal.exporting')
              : t('chatPage.exportModal.download')}
          </Button>
        </div>
      </div>
    </div>
  );
}
