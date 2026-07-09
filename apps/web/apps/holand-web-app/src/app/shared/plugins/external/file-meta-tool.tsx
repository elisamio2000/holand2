// ============================================
// FileMetaTool -- Standalone file metadata extraction tool
//
// Layout: Left sidebar (file selector + list) + Right panel (metadata detail)
// Inspired by geo-location-view split-panel design pattern.
// All UI text via react-i18next (fileMeta.* keys).
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text, Badge, ActionIcon, Loader } from 'rizzui';
import {
  PiUploadSimpleBold,
  PiFolderOpenBold,
  PiTrashBold,
  PiPlayBold,
  PiArrowsClockwiseBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiClockBold,
  PiDownloadSimpleBold,
  PiFileCsvBold,
  PiMagnifyingGlassBold,
  PiFilesBold,
  PiInfoBold,
  PiWarningBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import PluginRenderer from '@/app/shared/plugins/plugin-renderer';
import { getFileIconByExtension } from '@/utils/file-icons';
import type { PluginRunResult } from '@/types/plugins.types';
import type { FileMetaResult } from '@/app/shared/plugins/renderers/file-meta/file-meta-types';

// ==========================================
// Types
// ==========================================

type FileStatus = 'pending' | 'running' | 'done' | 'error';

interface FileEntry {
  file: File;
  status: FileStatus;
  result?: PluginRunResult & { filename: string };
  error?: string;
}

// ==========================================
// Helpers
// ==========================================

/**
 * Format a byte count into a human-readable string (e.g. "1.4 MB").
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

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
 * Export processed results to an expanded UTF-8 BOM CSV file.
 *
 * Columns exported (60+): Core, Hashes, Timestamps, GPS, Image, Audio,
 * Video, Document/Office/EPUB, Archive, Text, Hidden-data.
 *
 * @param entries - All file entries in the tool
 * @param t - i18n translation function (react-i18next)
 */
function exportToCSV(
  entries: FileEntry[],
  t: (k: string, o?: Record<string, unknown>) => string,
): void {
  const done = entries.filter((e) => e.status === 'done' && e.result?.data);
  if (done.length === 0) {
    toast.error(t('fileMeta.toast.noDataToExport'));
    return;
  }

  // ── Column headers ──────────────────────────────────────────────────────────
  const headers = [
    // Core identity
    'filename', 'extension', 'path', 'parent_dir',
    'kind', 'mime_type', 'mime_description',
    // Size & integrity
    'size_bytes', 'size_formatted', 'sha256',
    // Flags
    'is_symlink', 'encoding',
    // Timestamps
    'created_at', 'modified_at', 'accessed_at',
    // GPS
    'gps_lat', 'gps_lon', 'gps_altitude', 'gps_source',
    // Image
    'img_width', 'img_height', 'img_format', 'img_mode',
    'img_camera_make', 'img_camera_model', 'img_lens_model',
    'img_date_taken', 'img_is_edited', 'img_shutter_count',
    'img_software', 'img_orientation',
    // Audio
    'audio_duration_s', 'audio_bitrate_kbps', 'audio_sample_rate_hz',
    'audio_channels', 'audio_codec',
    'audio_title', 'audio_artist', 'audio_album', 'audio_genre', 'audio_year',
    // Video
    'video_duration_s', 'video_width', 'video_height',
    'video_fps', 'video_codec', 'video_audio_codec', 'video_bitrate_kbps',
    // Document / Office / EPUB
    'doc_type', 'doc_page_count', 'doc_author', 'doc_title',
    'doc_subject', 'doc_created', 'doc_modified', 'doc_is_encrypted',
    // Archive
    'arc_type', 'arc_entry_count', 'arc_is_encrypted', 'arc_compression',
    // Text
    'txt_line_count', 'txt_word_count', 'txt_char_count',
    // Hidden data (security indicators)
    'hidden_suspicious', 'hidden_hit_count',
  ];

  // Headers row — plain strings (no injection risk, but still quoted for consistency)
  const rows: string[][] = [headers.map((h) => `"${h}"`)];

  for (const entry of done) {
    const d = entry.result!.data as unknown as FileMetaResult;
    const img = d.metadata?.image;
    const aud = d.metadata?.audio;
    const vid = d.metadata?.video;
    const doc = d.metadata?.document;
    const off = d.metadata?.office;
    const arc = d.metadata?.archive;
    const txt = d.metadata?.text;
    const epub = d.metadata?.epub;

    // Merge document-like sources (document > office > epub)
    const docType = doc?.document_type ?? off?.doc_type ?? (epub ? 'epub' : undefined);
    const docPages = doc?.page_count ?? off?.page_count;
    const docAuthor = doc?.author ?? off?.author ?? epub?.authors?.join('; ');
    const docTitle = doc?.title ?? off?.title ?? epub?.title;
    const docSubject = doc?.subject ?? off?.subject;
    const docCreated = doc?.created ?? off?.created ?? epub?.published;
    const docModified = doc?.modified ?? off?.modified;
    const docEncrypted = doc?.is_encrypted ?? arc?.is_encrypted;

    rows.push([
      // Core
      safeCsvCell(d.filename ?? entry.file.name),
      safeCsvCell(d.extension),
      safeCsvCell(d.path),
      safeCsvCell(d.parent_dir),
      safeCsvCell(d.kind),
      safeCsvCell(d.mime_type),
      safeCsvCell(d.mime_description),
      safeCsvCell(d.size_bytes),
      safeCsvCell(d.size_formatted),
      safeCsvCell(d.sha256),
      safeCsvCell(d.is_symlink),
      safeCsvCell(d.encoding),
      // Timestamps
      safeCsvCell(d.created_at),
      safeCsvCell(d.modified_at),
      safeCsvCell(d.accessed_at),
      // GPS
      safeCsvCell(d.location?.latitude),
      safeCsvCell(d.location?.longitude),
      safeCsvCell(d.location?.altitude),
      safeCsvCell(d.location?.source),
      // Image
      safeCsvCell(img?.width),
      safeCsvCell(img?.height),
      safeCsvCell(img?.format),
      safeCsvCell(img?.mode),
      safeCsvCell(img?.camera_make),
      safeCsvCell(img?.camera_model),
      safeCsvCell(img?.lens_model),
      safeCsvCell(img?.date_taken),
      safeCsvCell(img?.is_edited),
      safeCsvCell(img?.shutter_count),
      safeCsvCell(img?.software),
      safeCsvCell(img?.orientation),
      // Audio
      safeCsvCell(aud?.duration),
      safeCsvCell(aud?.bitrate),
      safeCsvCell(aud?.sample_rate),
      safeCsvCell(aud?.channels),
      safeCsvCell(aud?.codec),
      safeCsvCell(aud?.title),
      safeCsvCell(aud?.artist),
      safeCsvCell(aud?.album),
      safeCsvCell(aud?.genre),
      safeCsvCell(aud?.year),
      // Video
      safeCsvCell(vid?.duration),
      safeCsvCell(vid?.width),
      safeCsvCell(vid?.height),
      safeCsvCell(vid?.fps),
      safeCsvCell(vid?.video_codec),
      safeCsvCell(vid?.audio_codec),
      safeCsvCell(vid?.bitrate),
      // Document / Office / EPUB
      safeCsvCell(docType),
      safeCsvCell(docPages),
      safeCsvCell(docAuthor),
      safeCsvCell(docTitle),
      safeCsvCell(docSubject),
      safeCsvCell(docCreated),
      safeCsvCell(docModified),
      safeCsvCell(docEncrypted),
      // Archive
      safeCsvCell(arc?.archive_type),
      safeCsvCell(arc?.entry_count),
      safeCsvCell(arc?.is_encrypted),
      safeCsvCell(arc?.compression_method),
      // Text
      safeCsvCell(txt?.line_count),
      safeCsvCell(txt?.word_count),
      safeCsvCell(txt?.char_count),
      // Hidden data
      safeCsvCell(d.hidden_data?.suspicious),
      safeCsvCell(d.hidden_data?.hit_count),
    ]);
  }

  // Cells already quoted by safeCsvCell — just join
  const csv = rows.map((r) => r.join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `file-meta-export-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(t('fileMeta.toast.csvExported', { count: done.length }));
}

/**
 * Export processed results to a structured JSON file.
 *
 * Exports the full metadata object per file, preserving nested structure
 * (location, metadata.image, metadata.audio, etc.).
 *
 * @param entries - All file entries in the tool
 * @param t - i18n translation function (react-i18next)
 */
function exportToJSON(
  entries: FileEntry[],
  t: (k: string, o?: Record<string, unknown>) => string,
): void {
  const done = entries.filter((e) => e.status === 'done' && e.result?.data);
  if (done.length === 0) {
    toast.error(t('fileMeta.toast.noDataToExport'));
    return;
  }

  const output = done.map((entry) => {
    const d = entry.result!.data as unknown as FileMetaResult;
    return {
      filename: d.filename ?? entry.file.name,
      extension: d.extension ?? null,
      path: d.path ?? null,
      parent_dir: d.parent_dir ?? null,
      kind: d.kind ?? null,
      mime_type: d.mime_type ?? null,
      mime_description: d.mime_description ?? null,
      size_bytes: d.size_bytes ?? null,
      size_formatted: d.size_formatted ?? null,
      sha256: d.sha256 ?? null,
      encoding: d.encoding ?? null,
      is_symlink: d.is_symlink ?? null,
      created_at: d.created_at ?? null,
      modified_at: d.modified_at ?? null,
      accessed_at: d.accessed_at ?? null,
      location: d.location ?? null,
      metadata: d.metadata ?? {},
      hidden_data: d.hidden_data ?? null,
    };
  });

  const json = JSON.stringify(output, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `file-meta-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(t('fileMeta.toast.jsonExported', { count: done.length }));
}

/**
 * FileMetaTool -- Standalone file metadata extraction page.
 *
 * Layout (Split Panel):
 * +---------------------------------------------------+
 * | Toolbar: file count, done, errors + action btns   |
 * +---------------------+-----------------------------+
 * | LEFT (320px)        | RIGHT (flex-1)              |
 * | Drop Zone           | Metadata Detail Panel       |
 * | Folder Select btn   | (PluginRenderer output)     |
 * | File List           | or Empty State              |
 * | Process / Retry btn |                             |
 * +---------------------+-----------------------------+
 *
 * UX: Clicking a file in the list shows its metadata in the right panel.
 *
 * @requires useTranslation -- all UI text via i18n (fileMeta.* keys)
 * @version 0.32.3 -- i18n integration, encoding fix
 */
export default function FileMetaTool() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // Derived State
  // ==========================================

  const pendingCount = useMemo(
    () => entries.filter((e) => e.status === 'pending').length,
    [entries],
  );
  const doneCount = useMemo(() => entries.filter((e) => e.status === 'done').length, [entries]);
  const errorCount = useMemo(() => entries.filter((e) => e.status === 'error').length, [entries]);
  const runningCount = useMemo(
    () => entries.filter((e) => e.status === 'running').length,
    [entries],
  );
  const isProcessing = runningCount > 0;
  const selectedEntry = selectedIdx !== null ? (entries[selectedIdx] ?? null) : null;

  // ==========================================
  // File Management
  // ==========================================

  const handleFilesAdd = useCallback(
    (files: File[]) => {
      console.info('[FileMetaTool] Adding files:', { count: files.length });
      setEntries((prev) => {
        const existingNames = new Set(prev.map((e) => e.file.name));
        const newOnes = files.filter((f) => !existingNames.has(f.name));
        const dupeCount = files.length - newOnes.length;
        if (dupeCount > 0) {
          toast(t('fileMeta.toast.duplicatesSkipped', { count: dupeCount }), { icon: 'i' });
        }
        return [...prev, ...newOnes.map<FileEntry>((f) => ({ file: f, status: 'pending' }))];
      });
    },
    [t],
  );

  const handleRemoveEntry = useCallback((idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIdx((prev) => {
      if (prev === null) return null;
      if (prev === idx) return null;
      if (prev > idx) return prev - 1;
      return prev;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setEntries([]);
    setSelectedIdx(null);
    console.info('[FileMetaTool] Cleared all files');
  }, []);

  // ==========================================
  // Processing
  // ==========================================

  const processEntry = useCallback(
    async (idx: number) => {
      const entry = entries[idx];
      if (!entry) return;

      console.info('[FileMetaTool] Processing:', { filename: entry.file.name });
      setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, status: 'running' } : e)));
      setSelectedIdx(idx);

      try {
        // WHY /api/plugins/file-meta/run instead of externalPluginsService.runPlugin():
        // The service calls Plugin Executor at localhost:8100 directly from the browser.
        // This fails when: (a) executor is not running, or (b) accessing from another
        // machine where localhost:8100 doesn't exist. The Next.js API proxy routes
        // through the server to the API Gateway (configured via API_GATEWAY_URL) which is always available.
        const formData = new FormData();
        formData.append('file', entry.file);

        const res = await fetch('/api/plugins/file-meta/run', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Server error ${res.status}: ${errBody.slice(0, 100)}`);
        }

        const json = await res.json() as {
          ok?: boolean;
          error?: string;
          data?: Record<string, unknown>;
          warnings?: string[];
          timings_ms?: Record<string, number>;
        };

        if (!json.ok) throw new Error(json.error ?? 'Plugin execution failed');

        const pluginResult: PluginRunResult & { filename: string } = {
          tool_id: 'file.meta',
          status: 'completed',
          data: json.data,
          warnings: json.warnings,
          timings_ms: json.timings_ms,
          filename: entry.file.name,
        };

        console.info('[FileMetaTool] Done:', { filename: entry.file.name });
        setEntries((prev) =>
          prev.map((e, i) => (i === idx ? { ...e, status: 'done', result: pluginResult } : e)),
        );
        toast.success(entry.file.name, { duration: 2000 });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[FileMetaTool] Error:', { filename: entry.file.name, error: errorMsg });
        setEntries((prev) =>
          prev.map((e, i) => (i === idx ? { ...e, status: 'error', error: errorMsg } : e)),
        );
        toast.error(`${entry.file.name}: ${errorMsg.slice(0, 60)}`);
      }
    },
    [entries],
  );

  const handleProcessAll = useCallback(async () => {
    const pendingIndices = entries
      .map((e, i) => (e.status === 'pending' ? i : -1))
      .filter((i) => i >= 0);

    if (pendingIndices.length === 0) {
      toast.error(t('fileMeta.toast.noPendingFiles'));
      return;
    }

    console.info('[FileMetaTool] Processing all pending:', { count: pendingIndices.length });
    for (const idx of pendingIndices) {
      await processEntry(idx);
    }
  }, [entries, processEntry, t]);

  // ==========================================
  // Drag & Drop
  // ==========================================

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) handleFilesAdd(Array.from(e.dataTransfer.files));
    },
    [handleFilesAdd],
  );

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-muted bg-gray-0 px-4 py-2.5 dark:bg-gray-50">
        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <PiFilesBold className="h-4 w-4 text-gray-500" />
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('fileMeta.toolbar.fileCount', { count: entries.length })}
            </Text>
          </div>
          {doneCount > 0 && (
            <Badge variant="flat" color="success" size="sm" className="gap-1">
              <PiCheckCircleBold className="h-3 w-3" />
              {t('fileMeta.toolbar.processedCount', { count: doneCount })}
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge variant="flat" color="danger" size="sm" className="gap-1">
              <PiXCircleBold className="h-3 w-3" />
              {t('fileMeta.toolbar.errorCount', { count: errorCount })}
            </Badge>
          )}
          {isProcessing && (
            <Badge variant="flat" color="warning" size="sm" className="gap-1">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
              {t('fileMeta.toolbar.processingCount', { count: runningCount })}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Tooltip content={t('fileMeta.toolbar.exportCsvTooltip')}>
            <ActionIcon
              variant="outline"
              size="sm"
              disabled={doneCount === 0}
              onClick={() => exportToCSV(entries, t)}
            >
              <PiFileCsvBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('fileMeta.toolbar.exportJsonTooltip')}>
            <ActionIcon
              variant="outline"
              size="sm"
              disabled={doneCount === 0}
              onClick={() => exportToJSON(entries, t)}
            >
              <PiDownloadSimpleBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
          <Tooltip content={t('fileMeta.toolbar.clearAllTooltip')}>
            <ActionIcon
              variant="outline"
              size="sm"
              disabled={entries.length === 0}
              onClick={handleClearAll}
              className="text-red-500 hover:bg-red-50"
            >
              <PiTrashBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* Split Layout */}
      <div className="flex gap-3" style={{ minHeight: '75vh' }}>
        {/* ---- LEFT PANEL ---- */}
        <div className="flex w-72 shrink-0 flex-col gap-3 lg:w-80">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-6 transition-colors',
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-primary/60 dark:border-gray-600',
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <PiUploadSimpleBold className="mb-2 h-8 w-8 text-gray-400" />
            <Text className="text-center text-sm font-medium text-gray-600 dark:text-gray-400">
              {t('fileMeta.dropzone.title')}
            </Text>
            <Text className="mt-0.5 text-center text-xs text-gray-400">
              {t('fileMeta.dropzone.subtitle')}
            </Text>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesAdd(Array.from(e.target.files));
                  e.target.value = '';
                }
              }}
            />
          </div>

          {/* Folder Select */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => dirInputRef.current?.click()}
            className="w-full gap-2"
          >
            <PiFolderOpenBold className="h-4 w-4" />
            {t('fileMeta.selectFolder')}
          </Button>
          <input
            ref={dirInputRef}
            type="file"
            // @ts-ignore -- webkitdirectory is valid HTML
            webkitdirectory="true"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesAdd(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
          />

          {/* File List */}
          <div className="flex-1 overflow-hidden rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
            {entries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
                <PiFilesBold className="h-10 w-10 text-gray-300" />
                <Text className="text-sm text-gray-400">{t('fileMeta.list.empty')}</Text>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* List Header */}
                <div className="flex items-center justify-between border-b border-muted px-3 py-2">
                  <Text className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('fileMeta.list.fileCount', { count: entries.length })}
                  </Text>
                  {pendingCount > 0 && (
                    <Text className="text-xs text-gray-400">
                      {t('fileMeta.list.readyCount', { count: pendingCount })}
                    </Text>
                  )}
                </div>
                {/* Scrollable File Items */}
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(75vh - 300px)' }}>
                  {entries.map((entry, idx) => (
                    <button
                      key={`${entry.file.name}-${idx}`}
                      onClick={() => setSelectedIdx(idx)}
                      className={cn(
                        'flex w-full items-center gap-2.5 border-b border-muted px-3 py-2.5 text-left transition-colors last:border-0',
                        selectedIdx === idx
                          ? 'bg-primary/8 dark:bg-primary/15'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-100',
                      )}
                    >
                      {/* File Type Icon */}
                      <div className="shrink-0">
                        {getFileIconByExtension(entry.file.name, 'h-5 w-5')}
                      </div>

                      {/* Name + Size */}
                      <div className="min-w-0 flex-1">
                        <Text
                          className={cn(
                            'truncate text-sm',
                            selectedIdx === idx
                              ? 'font-medium text-primary'
                              : 'text-gray-800 dark:text-gray-200',
                          )}
                        >
                          {entry.file.name}
                        </Text>
                        <Text className="text-xs text-gray-400">
                          {formatFileSize(entry.file.size)}
                        </Text>
                      </div>
                      <div className="shrink-0">
                        {entry.status === 'pending' && (
                          <span className="h-2 w-2 rounded-full bg-gray-300" />
                        )}
                        {entry.status === 'running' && (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        )}
                        {entry.status === 'done' && (
                          <PiCheckCircleBold className="h-4 w-4 text-green-500" />
                        )}
                        {entry.status === 'error' && (
                          <PiXCircleBold className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveEntry(idx);
                        }}
                        className="shrink-0 rounded p-0.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                        title={t('fileMeta.actions.remove')}
                      >
                        <PiTrashBold className="h-3.5 w-3.5" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Process All Button */}
          {pendingCount > 0 && (
            <Button
              size="md"
              onClick={handleProcessAll}
              disabled={isProcessing}
              className="w-full gap-2"
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t('fileMeta.process.processingLabel')}
                </>
              ) : (
                <>
                  <PiPlayBold className="h-4 w-4" />
                  {t('fileMeta.process.processFiles', { count: pendingCount })}
                </>
              )}
            </Button>
          )}

          {/* Retry Errors Button */}
          {errorCount > 0 && !isProcessing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setEntries((prev) =>
                  prev.map((e) =>
                    e.status === 'error' ? { ...e, status: 'pending', error: undefined } : e,
                  ),
                )
              }
              className="w-full gap-2 text-red-600 hover:bg-red-50"
            >
              <PiArrowsClockwiseBold className="h-4 w-4" />
              {t('fileMeta.process.retryErrors', { count: errorCount })}
            </Button>
          )}
        </div>

        {/* ---- RIGHT PANEL ---- */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
          {selectedEntry === null ? (
            /* Empty State */
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-200">
                <PiMagnifyingGlassBold className="h-8 w-8 text-gray-400" />
              </div>
              <div className="text-center">
                <Text className="font-medium text-gray-600 dark:text-gray-400">
                  {t('fileMeta.detail.emptyTitle')}
                </Text>
                <Text className="mt-1 text-sm text-gray-400">
                  {t('fileMeta.detail.emptyDesc')}
                </Text>
              </div>
              {entries.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <PiUploadSimpleBold className="h-4 w-4" />
                  {t('fileMeta.actions.addFile')}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Detail Panel Header */}
              <div className="flex items-center gap-3 border-b border-muted px-5 py-3">
                {/* File Type Icon */}
                <div className="shrink-0">
                  {getFileIconByExtension(selectedEntry.file.name, 'h-6 w-6')}
                </div>
                <div className="min-w-0 flex-1">
                  <Text className="truncate font-semibold text-gray-900 dark:text-gray-700">
                    {selectedEntry.file.name}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {formatFileSize(selectedEntry.file.size)}
                    {selectedEntry.status === 'error' && (
                      <span className="mx-1 text-red-500">
                        &bull; {selectedEntry.error?.slice(0, 60)}
                      </span>
                    )}
                  </Text>
                </div>

                {/* Status Badge */}
                <div className="shrink-0">
                  {selectedEntry.status === 'pending' && (
                    <Badge variant="flat" color="secondary" size="sm" className="gap-1">
                      <PiClockBold className="h-3 w-3" />
                      {t('fileMeta.status.pending')}
                    </Badge>
                  )}
                  {selectedEntry.status === 'running' && (
                    <Badge variant="flat" color="warning" size="sm" className="gap-1">
                      <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                      {t('fileMeta.status.running')}
                    </Badge>
                  )}
                  {selectedEntry.status === 'done' && (
                    <Badge variant="flat" color="success" size="sm" className="gap-1">
                      <PiCheckCircleBold className="h-3 w-3" />
                      {t('fileMeta.status.done')}
                    </Badge>
                  )}
                  {selectedEntry.status === 'error' && (
                    <Badge variant="flat" color="danger" size="sm" className="gap-1">
                      <PiXCircleBold className="h-3 w-3" />
                      {t('fileMeta.status.error')}
                    </Badge>
                  )}
                </div>

                {/* Process / Retry Button */}
                {selectedEntry.status === 'pending' && !isProcessing && (
                  <Button
                    size="sm"
                    onClick={() => processEntry(selectedIdx!)}
                    className="shrink-0 gap-1.5"
                  >
                    <PiPlayBold className="h-3.5 w-3.5" />
                    {t('fileMeta.actions.process')}
                  </Button>
                )}
                {selectedEntry.status === 'error' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEntries((prev) =>
                        prev.map((e, i) =>
                          i === selectedIdx ? { ...e, status: 'pending', error: undefined } : e,
                        ),
                      );
                      setTimeout(() => processEntry(selectedIdx!), 50);
                    }}
                    className="shrink-0 gap-1.5 text-red-600"
                  >
                    <PiArrowsClockwiseBold className="h-3.5 w-3.5" />
                    {t('fileMeta.actions.retry')}
                  </Button>
                )}
              </div>

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {selectedEntry.status === 'pending' && (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
                    <PiInfoBold className="h-10 w-10 text-gray-300" />
                    <Text className="text-sm text-gray-400">
                      {t('fileMeta.detail.pendingHint')}
                    </Text>
                  </div>
                )}
                {selectedEntry.status === 'running' && (
                  <div className="flex h-48 flex-col items-center justify-center gap-3">
                    <Loader variant="spinner" size="xl" />
                    <Text className="text-sm text-gray-500">
                      {t('fileMeta.detail.extracting')}
                    </Text>
                  </div>
                )}
                {selectedEntry.status === 'error' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                    <div className="flex items-start gap-3">
                      <PiWarningBold className="mt-0.5 h-5 w-5 text-red-500" />
                      <div>
                        <Text className="font-medium text-red-700 dark:text-red-400">
                          {t('fileMeta.detail.errorTitle')}
                        </Text>
                        <Text className="mt-1 text-sm text-red-600 dark:text-red-500">
                          {selectedEntry.error ?? t('common.unknown')}
                        </Text>
                      </div>
                    </div>
                  </div>
                )}
                {selectedEntry.status === 'done' && selectedEntry.result && (
                  <PluginRenderer
                    pluginId="file.meta"
                    result={selectedEntry.result}
                    isRunning={false}
                    onRun={async () => {
                      if (selectedIdx !== null) await processEntry(selectedIdx);
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
