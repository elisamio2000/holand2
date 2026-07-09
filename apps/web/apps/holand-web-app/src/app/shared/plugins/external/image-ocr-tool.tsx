// ============================================
// ImageOcrTool — Standalone multi-engine OCR extraction tool
//
// Layout: Left sidebar (image upload + engine selector) + Right panel (OCR result detail)
// Inspired by file-meta split-panel design + RBAC standards compliance.
// All UI text via react-i18next (ocr.* keys).
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text, Badge, ActionIcon, Loader, Title } from 'rizzui';
import {
  PiUploadSimpleBold,
  PiFolderOpenBold,
  PiTrashBold,
  PiPlayBold,
  PiArrowsClockwiseBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiClockBold,
  PiFileCsvBold,
  PiDownloadSimpleBold,
  PiMagnifyingGlassBold,
  PiFilesBold,
  PiInfoBold,
  PiWarningBold,
  PiImageBold,
  PiTextTBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { getFileIconByExtension } from '@/utils/file-icons';
import { externalPluginsService } from '@/services/external-plugins.service';

// ==========================================
// Types
// ==========================================

type FileStatus = 'idle' | 'processing' | 'done' | 'error';

interface OcrWord {
  text: string;
  confidence: number;
  bbox: [number, number][];
  engine: string;
}

interface OcrEngineResult {
  engine: string;
  engine_display: string;
  success: boolean;
  text: string;
  words: OcrWord[];
  confidence_avg: number;
  duration_ms: number;
  error?: string | null;
  char_count: number;
  word_count: number;
}

interface OcrResultData {
  filepath?: string;
  text: string;
  has_text: boolean;
  char_count: number;
  word_count: number;
  confidence_avg: number;
  primary_engine: string;
  primary_engine_display: string;
  words: OcrWord[];
  engine_results: OcrEngineResult[];
  engines_available: Record<string, any>;
  engine_order: string[];
  languages: any;
  detected_language?: string;
}

interface FileEntry {
  file: File;
  id: string;
  status: FileStatus;
  result: OcrResultData | null;
  progress: number;
  error?: string;
}

// ==========================================
// Helpers
// ==========================================

/**
 * Safely encode any value as a single CSV cell (RFC 4180).
 *
 * Security considerations:
 * - Null/undefined → empty quoted cell
 * - NFC Unicode normalization (prevents ambiguous filename encodings)
 * - Strips ASCII control characters (null bytes, bell, backspace, ESC, etc.)
 * - Collapses internal newlines to spaces (keeps rows intact in all readers)
 * - Blocks CSV formula injection (cells starting with =, +, -, @)
 * - Escapes double-quotes by doubling them (RFC 4180)
 */
function safeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  // NFC normalization prevents double-encoding Arabic / accented filenames
  s = s.normalize('NFC');
  // Strip non-printable control characters (keep TAB 0x09)
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Collapse internal line breaks so cell stays on one CSV row
  s = s.replace(/\r?\n|\r/g, ' ');
  // Block spreadsheet formula injection (OWASP CSV Injection)
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  // RFC 4180: double any existing double-quotes, then wrap the whole cell
  s = s.replace(/"/g, '""');
  return `"${s}"`;
}

/**
 * Export processed OCR results to an expanded UTF-8 BOM CSV file.
 *
 * Columns exported: filename, engine, text_preview, word_count, char_count,
 * confidence, duration_ms, text_direction, detected_language, bbox_count.
 *
 * @param entries - All file entries in the tool
 * @param t - i18n translation function (react-i18next)
 */
function exportToCSV(
  entries: FileEntry[],
  t: (k: string, o?: Record<string, unknown>) => string,
): void {
  console.info('[ImageOcrTool] Exporting CSV...');
  const done = entries.filter((e) => e.status === 'done' && e.result);
  if (done.length === 0) {
    console.warn('[ImageOcrTool] No data to export');
    toast.error(t('ocr.toast.noDataToExport'));
    return;
  }

  const headers = [
    'filename',
    'engine',
    'text_preview',
    'word_count',
    'char_count',
    'average_confidence',
    'duration_ms',
    'detected_language',
    'bbox_count',
    'has_text',
  ];

  const rows: string[][] = [headers.map((h) => `"${h}"`)];

  for (const entry of done) {
    const d = entry.result!;
    const textPreview =
      d.text.length > 100 ? d.text.substring(0, 100) + '...' : d.text;

    rows.push([
      safeCsvCell(entry.file.name),
      safeCsvCell(d.primary_engine_display),
      safeCsvCell(textPreview),
      safeCsvCell(d.word_count),
      safeCsvCell(d.char_count),
      safeCsvCell(d.confidence_avg),
      safeCsvCell(d.engine_results.find((r) => r.success)?.duration_ms),
      safeCsvCell(d.detected_language),
      safeCsvCell((d.words ?? []).length),
      safeCsvCell(d.has_text),
    ]);
  }

  // Cells already quoted by safeCsvCell - just join
  const csv = rows.map((r) => r.join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr-export-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  console.info('[ImageOcrTool] CSV exported:', { count: done.length });
  toast.success(t('ocr.toast.csvExported', { count: done.length }));
}

/**
 * Export processed OCR results to a structured JSON file.
 *
 * Exports the full metadata object per file, preserving nested structure
 * (words, bbox, engine_results, etc.).
 *
 * @param entries - All file entries in the tool
 * @param t - i18n translation function (react-i18next)
 */
function exportToJSON(
  entries: FileEntry[],
  t: (k: string, o?: Record<string, unknown>) => string,
): void {
  console.info('[ImageOcrTool] Exporting JSON...');
  const done = entries.filter((e) => e.status === 'done' && e.result);
  if (done.length === 0) {
    console.warn('[ImageOcrTool] No data to export');
    toast.error(t('ocr.toast.noDataToExport'));
    return;
  }

  const output = done.map((entry) => {
    const d = entry.result!;
    return {
      filename: entry.file.name,
      text: d.text,
      has_text: d.has_text,
      char_count: d.char_count,
      word_count: d.word_count,
      confidence_avg: d.confidence_avg,
      primary_engine: d.primary_engine,
      primary_engine_display: d.primary_engine_display,
      detected_language: d.detected_language ?? null,
      words: d.words ?? [],
      engine_results: d.engine_results ?? [],
      filepath: d.filepath,
    };
  });

  const json = JSON.stringify(output, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.info('[ImageOcrTool] JSON exported:', { count: done.length });
  toast.success(t('ocr.toast.jsonExported', { count: done.length }));
}

/**
 * NativeOcrResultPanel — Professional OCR result display component.
 *
 * Shows extracted text, statistics, words table with confidence bars.
 * No iframe dependencies - pure React native UI.
 *
 * @param data - OCR result data from backend
 * @param filename - Original image filename
 * @param t - i18n translation function
 */
function NativeOcrResultPanel({
  data,
  filename,
  t,
}: {
  data: OcrResultData;
  filename: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.text);
      setCopied(true);
      toast.success(t('ocr.toast.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[NativeOcrResultPanel] Copy failed:', err);
      toast.error('Failed to copy text');
    }
  }, [data.text, t]);

  // Confidence color helper
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'bg-green-500';
    if (conf >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-muted bg-gray-0 p-3 dark:bg-gray-50">
          <Text className="text-xs text-gray-500">{t('ocr.detail.characters')}</Text>
          <Title as="h5" className="mt-1 text-lg font-semibold">
            {data.char_count?.toLocaleString() ?? 0}
          </Title>
        </div>
        <div className="rounded-lg border border-muted bg-gray-0 p-3 dark:bg-gray-50">
          <Text className="text-xs text-gray-500">{t('ocr.detail.words')}</Text>
          <Title as="h5" className="mt-1 text-lg font-semibold">
            {data.word_count?.toLocaleString() ?? 0}
          </Title>
        </div>
        <div className="rounded-lg border border-muted bg-gray-0 p-3 dark:bg-gray-50">
          <Text className="text-xs text-gray-500">{t('ocr.detail.confidence')}</Text>
          <Title as="h5" className="mt-1 text-lg font-semibold">
            {data.confidence_avg
              ? `${Math.round(data.confidence_avg * 100)}%`
              : '—'}
          </Title>
        </div>
        <div className="rounded-lg border border-muted bg-gray-0 p-3 dark:bg-gray-50">
          <Text className="text-xs text-gray-500">{t('ocr.detail.engine')}</Text>
          <Title as="h5" className="mt-1 text-sm font-semibold">
            {data.primary_engine_display || data.primary_engine || '—'}
          </Title>
        </div>
      </div>

      {/* Extracted Text */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('ocr.detail.extractedText')}
          </Text>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            disabled={!data.text}
            className="gap-2"
          >
            {copied ? (
              <>
                <PiCheckCircleBold className="h-4 w-4" />
                {t('ocr.detail.copied')}
              </>
            ) : (
              <>
                <PiDownloadSimpleBold className="h-4 w-4" />
                {t('ocr.detail.copyText')}
              </>
            )}
          </Button>
        </div>
        <div className="relative max-h-64 overflow-y-auto rounded-lg border border-muted bg-white p-4 dark:bg-gray-100">
          {data.text ? (
            <Text
              className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800 dark:text-gray-100"
              dir="auto"
            >
              {data.text}
            </Text>
          ) : (
            <Text className="text-center text-sm text-gray-400">
              {t('ocr.detail.noTextFound')}
            </Text>
          )}
        </div>
      </div>

      {/* Words Table */}
      {data.words && data.words.length > 0 && (
        <div className="space-y-2">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('ocr.detail.wordsTable')} ({data.words.length})
          </Text>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-muted">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-100">
                <tr className="border-b border-muted">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                    {t('ocr.detail.word')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                    {t('ocr.detail.confidence')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-50">
                {data.words.slice(0, 100).map((word, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-muted last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-100"
                  >
                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">
                      <span dir="auto">{word.text}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className={cn(
                              'h-full transition-all',
                              getConfidenceColor(word.confidence),
                            )}
                            style={{
                              width: `${Math.round(word.confidence * 100)}%`,
                            }}
                          />
                        </div>
                        <Text className="text-xs text-gray-500">
                          {Math.round(word.confidence * 100)}%
                        </Text>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.words.length > 100 && (
              <div className="border-t border-muted bg-gray-50 px-3 py-2 text-center text-xs text-gray-500 dark:bg-gray-100">
                {t('ocr.detail.showingFirst100', {
                  total: data.words.length,
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Engine Results (if multiple) */}
      {data.engine_results && data.engine_results.length > 1 && (
        <div className="space-y-2">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('ocr.detail.engineResults')}
          </Text>
          <div className="space-y-2">
            {data.engine_results.map((result, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-lg border p-3',
                  result.engine === data.primary_engine
                    ? 'border-primary bg-primary/5'
                    : 'border-muted bg-gray-0 dark:bg-gray-50',
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Text className="font-semibold text-gray-800 dark:text-gray-100">
                        {result.engine_display || result.engine}
                      </Text>
                      {result.engine === data.primary_engine && (
                        <Badge color="success" size="sm">
                          {t('ocr.detail.primary')}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        {result.char_count} {t('ocr.detail.chars')}
                      </span>
                      <span>•</span>
                      <span>
                        {result.word_count} {t('ocr.detail.wordsShort')}
                      </span>
                      <span>•</span>
                      <span>
                        {Math.round(result.confidence_avg * 100)}%{' '}
                        {t('ocr.detail.conf')}
                      </span>
                      {result.duration_ms && (
                        <>
                          <span>•</span>
                          <span>{result.duration_ms}ms</span>
                        </>
                      )}
                    </div>
                  </div>
                  {result.success ? (
                    <PiCheckCircleBold className="h-5 w-5 text-green-500" />
                  ) : (
                    <PiXCircleBold className="h-5 w-5 text-red-500" />
                  )}
                </div>
                {!result.success && result.error && (
                  <Text className="mt-2 text-xs text-red-600">
                    {result.error}
                  </Text>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ImageOcrTool — Standalone multi-engine OCR extraction page.
 *
 * Layout (Split Panel):
 * +---------------------------------------------------+
 * | Toolbar: file count, done, errors + action btns   |
 * +---------------------+-----------------------------+
 * | LEFT (320px)        | RIGHT (flex-1)              |
 * | Drop Zone           | OCR Result Detail Panel     |
 * | Image Thumb         | (PluginRenderer output)     |
 * | Engine Selector     | or Empty State              |
 * | Process / Retry btn |                             |
 * +---------------------+-----------------------------+
 *
 * UX: Clicking an image in the list shows its OCR result in the right panel.
 *
 * @requires useTranslation -- all UI text via i18n (ocr.* keys)
 * @version 1.0.0 -- Initial implementation with file-meta standards
 */
export default function ImageOcrTool() {
  const { t } = useTranslation();

  const [entries, setEntries] = useState<FileEntry[]>([]);
  // store only the ID — selectedEntry is derived so it's always in sync with latest entries
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [enginePreference, setEnginePreference] = useState<string>('auto');
  const [languagePreference, setLanguagePreference] = useState<string>('fa+en');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Always up-to-date snapshot of the selected entry
  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  // ------------------------------------------
  // Stats
  // ------------------------------------------

  const stats = useMemo(() => {
    const total = entries.length;
    const processing = entries.filter((e) => e.status === 'processing').length;
    const done = entries.filter((e) => e.status === 'done').length;
    const errors = entries.filter((e) => e.status === 'error').length;
    const idle = entries.filter((e) => e.status === 'idle').length;
    return { total, processing, done, errors, idle };
  }, [entries]);

  // ------------------------------------------
  // File Management
  // ------------------------------------------

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      console.info('[ImageOcrTool] Files selected');
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      const imageFiles = files.filter((f) =>
        /\.(jpe?g|png|webp|bmp|tiff?|gif)$/i.test(f.name),
      );

      if (imageFiles.length === 0) {
        console.warn('[ImageOcrTool] No valid images');
        toast.error(t('ocr.toast.noValidImages'));
        return;
      }

      console.info('[ImageOcrTool] Valid images:', { count: imageFiles.length });
      const newEntries: FileEntry[] = imageFiles.map((file) => ({
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        status: 'idle',
        result: null,
        progress: 0,
      }));

      setEntries((prev) => {
        const updated = [...prev, ...newEntries];
        return updated;
      });
      // Auto-select the first newly added file if nothing is selected
      setSelectedEntryId((prev) => prev ?? newEntries[0]?.id ?? null);
      toast.success(t('ocr.toast.filesAdded', { count: imageFiles.length }));

      // Reset input
      e.target.value = '';
    },
    [t],
  );

  const handleClearAll = useCallback(() => {
    console.info('[ImageOcrTool] Clearing all entries');
    setEntries([]);
    setSelectedEntryId(null);
    toast.success(t('ocr.toast.allCleared'));
  }, [t]);

  const handleRemoveEntry = useCallback(
    (id: string) => {
      console.info('[ImageOcrTool] Removing entry:', { id });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      // If removing the selected entry, clear selection
      setSelectedEntryId((prev) => (prev === id ? null : prev));
    },
    [],
  );

  // ------------------------------------------
  // Process
  // ------------------------------------------

  const handleProcess = useCallback(async () => {
    const toProcess = entries.filter((e) => e.status === 'idle' || e.status === 'error');
    if (toProcess.length === 0) {
      console.warn('[ImageOcrTool] No entries to process');
      toast.error(t('ocr.toast.nothingToProcess'));
      return;
    }

    console.info('[ImageOcrTool] Starting OCR processing:', { count: toProcess.length });

    for (const entry of toProcess) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, status: 'processing', progress: 0 } : e,
        ),
      );

      try {
        console.info('[ImageOcrTool] Processing image:', {
          filename: entry.file.name,
          engine: enginePreference,
          lang: languagePreference,
        });

        // Pass engine and lang preferences to the plugin
        const result = await externalPluginsService.runPlugin('image.ocr', entry.file, {
          engine: enginePreference,
          lang: languagePreference,
        });

        const json = result as {
          ok?: boolean;
          error?: string;
          data?: unknown;
          warnings?: string[];
        };

        if (!json.ok) {
          throw new Error(json.error || 'Plugin execution failed');
        }

        console.info('[ImageOcrTool] OCR success:', {
          filename: entry.file.name,
          charCount: (json.data as any)?.char_count,
          wordCount: (json.data as any)?.word_count,
        });

        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  status: 'done' as const,
                  progress: 100,
                  result: json.data as OcrResultData,
                }
              : e,
          ),
        );
        // Auto-select this entry to immediately show results in right panel
        setSelectedEntryId(entry.id);
      } catch (err: unknown) {
        console.error('[ImageOcrTool] OCR failed:', { filename: entry.file.name, err });
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  status: 'error',
                  progress: 0,
                  error: errorMessage,
                }
              : e,
          ),
        );
      }
    }

    console.info('[ImageOcrTool] Processing complete');
    toast.success(t('ocr.toast.processingComplete'));
  }, [entries, enginePreference, languagePreference, t]);

  // ------------------------------------------
  // Retry failed
  // ------------------------------------------

  const handleRetryFailed = useCallback(() => {
    console.info('[ImageOcrTool] Retrying failed entries');
    setEntries((prev) =>
      prev.map((e) => (e.status === 'error' ? { ...e, status: 'idle' } : e)),
    );
    toast.success(t('ocr.toast.retryQueued'));
  }, [t]);

  // ------------------------------------------
  // Render
  // ------------------------------------------

  const canProcess = stats.idle > 0 || stats.errors > 0;
  const isProcessing = stats.processing > 0;
  const doneCount = stats.done;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-muted bg-gray-0 px-5 dark:bg-gray-50">
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <PiFilesBold className="h-4 w-4 text-gray-500" />
            <Text className="font-medium text-gray-700 dark:text-gray-200">
              {t('ocr.toolbar.totalFiles', { count: stats.total })}
            </Text>
          </div>

          {stats.done > 0 && (
            <div className="flex items-center gap-1">
              <PiCheckCircleBold className="h-4 w-4 text-green-500" />
              <Text className="font-medium text-green-600 dark:text-green-400">
                {stats.done}
              </Text>
            </div>
          )}

          {stats.processing > 0 && (
            <div className="flex items-center gap-1">
              <PiClockBold className="h-4 w-4 text-amber-500" />
              <Text className="font-medium text-amber-600 dark:text-amber-400">
                {stats.processing}
              </Text>
            </div>
          )}

          {stats.errors > 0 && (
            <div className="flex items-center gap-1">
              <PiXCircleBold className="h-4 w-4 text-red-500" />
              <Text className="font-medium text-red-600 dark:text-red-400">
                {stats.errors}
              </Text>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Tooltip content={t('ocr.toolbar.exportCsvTooltip')}>
            <ActionIcon
              variant="outline"
              size="sm"
              disabled={doneCount === 0}
              onClick={() => exportToCSV(entries, t)}
            >
              <PiFileCsvBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('ocr.toolbar.exportJsonTooltip')}>
            <ActionIcon
              variant="outline"
              size="sm"
              disabled={doneCount === 0}
              onClick={() => exportToJSON(entries, t)}
            >
              <PiDownloadSimpleBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('ocr.toolbar.clearAllTooltip')}>
            <ActionIcon
              variant="outline"
              size="sm"
              disabled={entries.length === 0}
              onClick={handleClearAll}
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <PiTrashBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* Split Layout */}
      <div className="flex gap-3" style={{ minHeight: '75vh' }}>
        {/* ---- LEFT PANEL ---- */}
        <div className="flex w-80 flex-col gap-3 border-r border-muted bg-gray-0 p-3 dark:bg-gray-50">
          {/* Upload Button */}
          <Button
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="h-12 w-full bg-primary text-white hover:bg-primary/90"
          >
            <PiUploadSimpleBold className="h-5 w-5" />
            {t('ocr.sidebar.selectImages')}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Engine Selector */}
          <div className="space-y-2">
            <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {t('ocr.sidebar.engine')}
            </Text>
            <select
              value={enginePreference}
              onChange={(e) => setEnginePreference(e.target.value)}
              disabled={isProcessing}
              className="w-full rounded-lg border border-muted bg-white px-3 py-2 text-sm dark:bg-gray-100"
            >
              <option value="auto">{t('ocr.sidebar.engineAuto')}</option>
              <option value="rapidocr">RapidOCR</option>
              <option value="easyocr">EasyOCR</option>
              <option value="tesseract">Tesseract</option>
              <option value="speed">{t('ocr.sidebar.engineSpeed')}</option>
              <option value="accuracy">{t('ocr.sidebar.engineAccuracy')}</option>
            </select>
          </div>

          {/* Language Selector */}
          <div className="space-y-2">
            <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {t('ocr.sidebar.language')}
            </Text>
            <select
              value={languagePreference}
              onChange={(e) => setLanguagePreference(e.target.value)}
              disabled={isProcessing}
              className="w-full rounded-lg border border-muted bg-white px-3 py-2 text-sm dark:bg-gray-100"
            >
              <option value="fa+en">{t('ocr.sidebar.langFaEn')}</option>
              <option value="fa">{t('ocr.sidebar.langFa')}</option>
              <option value="en">{t('ocr.sidebar.langEn')}</option>
              <option value="ar+en">{t('ocr.sidebar.langArEn')}</option>
            </select>
          </div>

          {/* Process / Retry Buttons */}
          <div className="flex gap-2">
            <Button
              size="md"
              onClick={handleProcess}
              disabled={!canProcess || isProcessing}
              isLoading={isProcessing}
              className="flex-1 bg-green-600 text-white hover:bg-green-700"
            >
              {!isProcessing && <PiPlayBold className="h-4 w-4" />}
              {isProcessing ? t('ocr.sidebar.processing') : t('ocr.sidebar.process')}
            </Button>

            {stats.errors > 0 && (
              <Tooltip content={t('ocr.sidebar.retryFailedTooltip')}>
                <ActionIcon
                  variant="outline"
                  size="lg"
                  onClick={handleRetryFailed}
                  disabled={isProcessing}
                  className="text-amber-600"
                >
                  <PiArrowsClockwiseBold className="h-5 w-5" />
                </ActionIcon>
              </Tooltip>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-muted" />

          {/* File List */}
          <div className="flex-1 space-y-1 overflow-y-auto">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <PiImageBold className="h-12 w-12 text-gray-300" />
                <Text className="text-sm text-gray-400">
                  {t('ocr.sidebar.noImagesYet')}
                </Text>
              </div>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntryId(entry.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all hover:border-primary/50 hover:bg-primary/5',
                    selectedEntry?.id === entry.id
                      ? 'border-primary bg-primary/10'
                      : 'border-muted bg-white dark:bg-gray-100',
                  )}
                >
                  {/* Icon */}
                  {getFileIconByExtension(entry.file.name, 'h-8 w-8')}

                  {/* Details */}
                  <div className="flex-1 overflow-hidden">
                    <Text className="truncate text-xs font-medium text-gray-800 dark:text-gray-100">
                      {entry.file.name}
                    </Text>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      {entry.status === 'idle' && (
                        <Badge color="secondary">{t('ocr.status.idle')}</Badge>
                      )}
                      {entry.status === 'processing' && (
                        <Badge color="warning">{t('ocr.status.processing')}</Badge>
                      )}
                      {entry.status === 'done' && (
                        <Badge color="success">{t('ocr.status.done')}</Badge>
                      )}
                      {entry.status === 'error' && (
                        <Badge color="danger">{t('ocr.status.error')}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Remove */}
                  <ActionIcon
                    variant="text"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveEntry(entry.id);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <PiTrashBold className="h-3.5 w-3.5" />
                  </ActionIcon>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ---- RIGHT PANEL ---- */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedEntry ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <PiTextTBold className="h-16 w-16 text-gray-300 dark:text-gray-600" />
              <div>
                <Title as="h4" className="text-gray-600 dark:text-gray-300">
                  {t('ocr.detail.noSelection')}
                </Title>
                <Text className="mt-1 text-sm text-gray-400">
                  {t('ocr.detail.selectImageHint')}
                </Text>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-muted pb-3">
                {getFileIconByExtension(selectedEntry.file.name, 'h-8 w-8')}
                <div className="flex-1">
                  <Title as="h4" className="text-base font-semibold">
                    {selectedEntry.file.name}
                  </Title>
                  <Text className="text-xs text-gray-500">
                    {(selectedEntry.file.size / 1024).toFixed(1)} KB
                  </Text>
                </div>
              </div>

              {/* Native Result Display */}
              {selectedEntry.result ? (
                <NativeOcrResultPanel
                  data={selectedEntry.result}
                  filename={selectedEntry.file.name}
                  t={t}
                />
              ) : selectedEntry.status === 'processing' ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <Loader size="xl" />
                  <Text className="text-sm text-gray-500">
                    {t('ocr.detail.processing')}
                  </Text>
                </div>
              ) : selectedEntry.status === 'error' ? (
                <div className="rounded-xl border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
                  <PiWarningBold className="h-10 w-10 text-red-500" />
                  <Title as="h4" className="mt-2 text-red-700 dark:text-red-400">
                    {t('ocr.detail.error')}
                  </Title>
                  <Text className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {selectedEntry.error}
                  </Text>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <PiInfoBold className="h-10 w-10 text-gray-300" />
                  <Text className="text-sm text-gray-400">
                    {t('ocr.detail.notProcessedYet')}
                  </Text>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
