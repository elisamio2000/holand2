// ============================================
// UploadModal — Drag-and-drop file upload modal
// Uploads to /storage/upload, shows progress per file.
// ============================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Title, Text, Button } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  PiUploadBold,
  PiXBold,
  PiCheckCircleBold,
  PiWarningCircleBold,
  PiFileBold,
  PiTrashBold,
  PiSpinnerBold,
  PiFolderBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { storageService } from '@/services/storage.service';
import type { UploadResponse } from '@/types/storage.types';
import toast from 'react-hot-toast';

// ==========================================
// Types
// ==========================================

interface FileEntry {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: UploadResponse;
}

interface UploadModalProps {
  /** The folder path to upload files into */
  folderPath: string;
  /** Session ID for attribution */
  sessionId?: string;
  /** Optional initial files (e.g., from drag-and-drop) */
  initialFiles?: File[];
  /** Called when upload is done and files were uploaded successfully */
  onUploadComplete: (uploadedCount: number) => void;
  onClose: () => void;
}

// ==========================================
// UploadModal Component
// ==========================================

/**
 * UploadModal — Full-screen modal for uploading files to storage.
 *
 * Features:
 * - Drag-and-drop zone
 * - Multi-file select
 * - Per-file progress + status
 * - Folder path display
 * - Sequential upload to POST /storage/upload
 *
 * @example
 * ```tsx
 * <UploadModal folderPath="cases/abc" onUploadComplete={refetch} onClose={() => setOpen(false)} />
 * ```
 */
export default function UploadModal({
  folderPath,
  sessionId,
  initialFiles,
  onUploadComplete,
  onClose,
}: UploadModalProps) {
  const { t } = useTranslation();
  const tx = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      t(`fileExplorer.${key}`, options),
    [t]
  );
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Add files ─────────────────────────────────────────────────────────────
  const addFiles = useCallback((files: File[]) => {
    const newEntries: FileEntry[] = files.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      status: 'pending',
      progress: 0,
    }));
    setEntries((prev) => {
      // Deduplicate by name
      const existingNames = new Set(prev.map((e) => e.file.name));
      return [...prev, ...newEntries.filter((e) => !existingNames.has(e.file.name))];
    });
  }, []);

  // ── Auto-add initial files from drag-and-drop (B1) ───────────────────────
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      addFiles(initialFiles);
    }
  }, [initialFiles, addFiles]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) addFiles(files);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Remove file from queue ────────────────────────────────────────────────
  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // ── Upload all pending ────────────────────────────────────────────────────
  const handleUpload = async () => {
    const pending = entries.filter((e) => e.status === 'pending');
    if (!pending.length) return;

    console.info('[UploadModal] Starting upload:', {
      count: pending.length,
      folderPath,
      sessionId,
    });
    setIsUploading(true);

    let doneCount = 0;

    for (const entry of pending) {
      // Mark as uploading
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, status: 'uploading', progress: 10 } : e))
      );

      try {
        const result = await storageService.uploadFileSmart(
          entry.file,
          sessionId,
          folderPath || undefined,
          (pct) => {
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entry.id ? { ...e, progress: Math.max(10, pct) } : e
              )
            );
          }
        );
        console.info('[UploadModal] File uploaded:', { name: entry.file.name, result });
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, status: 'done', progress: 100, result }
              : e
          )
        );
        doneCount++;
      } catch (error) {
        console.error('[UploadModal] Upload failed:', { name: entry.file.name, error });
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  status: 'error',
                  progress: 0,
                  error: error instanceof Error ? error.message : t('common.unknown'),
                }
              : e
          )
        );
      }
    }

    setIsUploading(false);
    console.info('[UploadModal] Upload session complete:', { doneCount });

    if (doneCount > 0) {
      toast.success(`${doneCount} ${tx('filesUploaded')}`);
      onUploadComplete(doneCount);
    }
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const pendingCount = entries.filter((e) => e.status === 'pending').length;
  const doneCount = entries.filter((e) => e.status === 'done').length;
  const errorCount = entries.filter((e) => e.status === 'error').length;
  const canUpload = pendingCount > 0 && !isUploading;

  // ── Format size ───────────────────────────────────────────────────────────
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <PiUploadBold className="h-5 w-5 text-primary" />
            <Title as="h3" className="text-base font-semibold">
              {tx('uploadFiles')}
            </Title>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <PiXBold className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Folder path badge */}
          <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
            <PiFolderBold className="h-4 w-4 text-yellow-500" />
            <Text className="text-xs text-gray-600 dark:text-gray-400">
              {folderPath || tx('rootNoFolder')}
            </Text>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors',
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50'
            )}
          >
            <PiUploadBold
              className={cn(
                'mb-2 h-10 w-10',
                isDragOver ? 'text-primary' : 'text-gray-300 dark:text-gray-600'
              )}
            />
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {isDragOver ? tx('dropFiles') : tx('dragOrClickFiles')}
            </Text>
            <Text className="mt-1 text-xs text-gray-400">{tx('allFileTypesAccepted')}</Text>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* File queue */}
          {entries.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5 dark:border-gray-800"
                >
                  {/* Status icon */}
                  <div className="shrink-0">
                    {entry.status === 'done' ? (
                      <PiCheckCircleBold className="h-5 w-5 text-green-500" />
                    ) : entry.status === 'error' ? (
                      <PiWarningCircleBold className="h-5 w-5 text-red-500" />
                    ) : entry.status === 'uploading' ? (
                      <PiSpinnerBold className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <PiFileBold className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  {/* Name + error */}
                  <div className="flex-1 min-w-0">
                    <Text className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                      {entry.file.name}
                    </Text>
                    {entry.status === 'error' && (
                      <Text className="text-xs text-red-500">{entry.error}</Text>
                    )}
                  </div>

                  {/* Size */}
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatSize(entry.file.size)}
                  </span>

                  {/* Remove button (only for pending) */}
                  {entry.status === 'pending' && (
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="shrink-0 rounded p-1 text-gray-300 hover:text-red-500"
                    >
                      <PiTrashBold className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {(doneCount > 0 || errorCount > 0) && (
            <div className="flex gap-3 text-xs">
              {doneCount > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  ✓ {doneCount} {tx('uploaded')}
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600 dark:text-red-400">✗ {errorCount} {t('common.error')}</span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            {doneCount > 0 ? t('common.close') : t('common.cancel')}
          </Button>
          {canUpload && (
            <Button
              onClick={handleUpload}
              isLoading={isUploading}
              className="gap-2"
            >
              <PiUploadBold className="h-4 w-4" />
              {tx('uploadNFiles', { count: pendingCount })}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
