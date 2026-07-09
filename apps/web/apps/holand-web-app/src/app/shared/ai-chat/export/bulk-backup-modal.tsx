'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiDownloadSimple, PiUploadSimple, PiX } from 'react-icons/pi';
import { Button, Text, Title } from 'rizzui';
import toast from 'react-hot-toast';
import { downloadFile, sanitizeFilename, getTimestamp } from './utils/download-helper';
import {
  runBulkBackup,
  type BulkBackupMode,
  type BulkBackupProgress,
} from './bulk-backup-runner';
import { useBulkBackupOptions } from './hooks/use-bulk-backup-options';
import { importBackupAdapter } from '@/app/shared/ai-chat/adapters/chat-feature-adapter';
import type { ChatFeatureHealthMap } from '@/app/shared/ai-chat/adapters/chat-feature-adapter';
import { exportAllSessionsAdapter } from '@/app/shared/ai-chat/adapters/chat-feature-adapter';

interface BulkBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionIds?: string[];
  featureHealth?: ChatFeatureHealthMap;
  onImportComplete?: () => void;
}

type ModalTab = 'export' | 'import';

export default function BulkBackupModal({
  isOpen,
  onClose,
  sessionIds,
  featureHealth,
  onImportComplete,
}: BulkBackupModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ModalTab>('export');
  const [mode, setMode] = useState<BulkBackupMode>('light');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BulkBackupProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const serverExportAvailable = featureHealth?.exportAll === 'available';
  const importAvailable =
    featureHealth?.import === 'available' ||
    (process.env.NODE_ENV === 'development' && featureHealth?.import === 'unavailable');

  const {
    options,
    toggleFormat,
    includeMemory,
    setIncludeMemory,
    includeTraces,
    setIncludeTraces,
    useServerExport,
    setUseServerExport,
    canUseServerExport,
  } = useBulkBackupOptions(serverExportAvailable);

  const handleClose = useCallback(() => {
    if (isRunning) return;
    onClose();
  }, [isRunning, onClose]);

  const handleRunExport = useCallback(async () => {
    setIsRunning(true);
    setProgress(null);
    try {
      if (options.useServerExport && featureHealth) {
        const blob = await exportAllSessionsAdapter(featureHealth, {
          format: [...options.formats].join(','),
          include_files: mode === 'full',
        });
        if (!blob) throw new Error('Server export unavailable');
        downloadFile(blob, `chat-export-all_${getTimestamp()}.zip`, 'application/zip');
      } else {
        const blob = await runBulkBackup({
          sessionIds,
          mode,
          formats: [...options.formats],
          includeMemory: options.includeMemory,
          includeTraces: options.includeTraces,
          onProgress: setProgress,
        });
        const base = sessionIds?.length === 1 ? 'session-backup' : 'chat-backup-all';
        const filename = `${sanitizeFilename(base)}_${getTimestamp()}.zip`;
        downloadFile(blob, filename, 'application/zip');
      }
      toast.success(t('chatPage.bulkBackup.success'));
      onClose();
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error(t('chatPage.bulkBackup.cancelled'));
      } else {
        console.error('[BulkBackupModal]', error);
        toast.error(t('chatPage.bulkBackup.failed'));
      }
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }, [featureHealth, mode, onClose, options, sessionIds, t]);

  const handleImport = useCallback(
    async (file: File) => {
      if (!featureHealth) return;
      if (!window.confirm(t('chatPage.bulkBackup.importConfirm'))) return;
      setIsRunning(true);
      try {
        const result = await importBackupAdapter(featureHealth, file);
        toast.success(
          t('chatPage.bulkBackup.importSuccess', {
            imported: result.imported_sessions?.length ?? 0,
          })
        );
        onImportComplete?.();
        onClose();
      } catch (error: unknown) {
        console.error('[BulkBackupModal] import', error);
        toast.error(t('chatPage.bulkBackup.importFailed'));
      } finally {
        setIsRunning(false);
      }
    },
    [featureHealth, onClose, onImportComplete, t]
  );

  if (!isOpen) return null;

  const progressLabel =
    progress?.phase === 'zip'
      ? t('chatPage.bulkBackup.zipping')
      : progress
        ? t('chatPage.bulkBackup.progress', {
            current: progress.current,
            total: progress.total,
            title: progress.sessionTitle ?? '',
          })
        : '';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-muted bg-gray-0 p-5 shadow-xl dark:bg-gray-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-backup-title"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <Title id="bulk-backup-title" as="h3" className="text-base">
              {tab === 'export'
                ? sessionIds?.length
                  ? t('chatPage.bulkBackup.titleSelected', { count: sessionIds.length })
                  : t('chatPage.bulkBackup.titleAll')
                : t('chatPage.bulkBackup.importTitle')}
            </Title>
            <Text className="mt-1 text-sm text-gray-500">
              {tab === 'export'
                ? t('chatPage.bulkBackup.subtitle')
                : t('chatPage.bulkBackup.importSubtitle')}
            </Text>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isRunning}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
            aria-label={t('common.close')}
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex gap-2 border-b border-muted pb-2">
          <button
            type="button"
            onClick={() => setTab('export')}
            className={`rounded-md px-3 py-1 text-sm ${tab === 'export' ? 'bg-primary/10 text-primary' : 'text-gray-500'}`}
          >
            {t('chatPage.bulkBackup.tabExport')}
          </button>
          {importAvailable && (
            <button
              type="button"
              onClick={() => setTab('import')}
              className={`rounded-md px-3 py-1 text-sm ${tab === 'import' ? 'bg-primary/10 text-primary' : 'text-gray-500'}`}
            >
              {t('chatPage.bulkBackup.tabImport')}
            </button>
          )}
        </div>

        {tab === 'export' ? (
          <>
            <div className="mb-3 flex gap-2">
              {(['light', 'full'] as BulkBackupMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    mode === m
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-muted text-gray-600 hover:bg-gray-50 dark:text-gray-400'
                  }`}
                >
                  {t(`chatPage.bulkBackup.mode.${m}`)}
                </button>
              ))}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {(['json', 'md'] as const).map((fmt) => (
                <label key={fmt} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={options.formats.has(fmt)}
                    onChange={() => toggleFormat(fmt)}
                    disabled={isRunning}
                  />
                  {t(`chatPage.exportFormats.${fmt}`)}
                </label>
              ))}
            </div>

            <div className="mb-3 flex flex-col gap-1.5 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeMemory}
                  onChange={(e) => setIncludeMemory(e.target.checked)}
                  disabled={isRunning}
                />
                {t('chatPage.bulkBackup.includeMemory')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeTraces}
                  onChange={(e) => setIncludeTraces(e.target.checked)}
                  disabled={isRunning}
                />
                {t('chatPage.bulkBackup.includeTraces')}
              </label>
              {canUseServerExport && !sessionIds?.length && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useServerExport}
                    onChange={(e) => setUseServerExport(e.target.checked)}
                    disabled={isRunning}
                  />
                  {t('chatPage.bulkBackup.serverExport')}
                </label>
              )}
            </div>

            {isRunning && progressLabel && (
              <p className="mb-3 text-xs text-gray-500">{progressLabel}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isRunning}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleRunExport} isLoading={isRunning}>
                <PiDownloadSimple className="me-1.5 h-4 w-4" />
                {t('chatPage.bulkBackup.download')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = '';
              }}
            />
            <Button
              className="w-full"
              variant="outline"
              isLoading={isRunning}
              onClick={() => fileInputRef.current?.click()}
            >
              <PiUploadSimple className="me-1.5 h-4 w-4" />
              {t('chatPage.bulkBackup.chooseFile')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
