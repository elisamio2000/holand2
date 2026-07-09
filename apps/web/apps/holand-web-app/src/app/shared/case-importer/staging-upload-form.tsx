// ============================================
// StagingUploadForm — Resumable chunked upload for large files
// Uses TUS-like protocol via /import/staging/* endpoints
// ============================================

'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Progressbar, Text, Title, Loader } from 'rizzui';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  PiCloudArrowUpDuotone,
  PiFolderOpenDuotone,
  PiRocketLaunchDuotone,
  PiTrashBold,
  PiWarningDuotone,
  PiCheckCircleDuotone,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { caseImporterService } from '@/services/case-importer.service';
import { getStagingRelativePath } from '@/utils/batch-import-utils';
import { cleanupStagingSessionAfterImport } from '@/utils/staging-cleanup';

// ==========================================
// Types
// ==========================================

interface FileUploadState {
  file: File;
  fileId: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  offset: number; // Current byte offset
}

// ==========================================
// Constants
// ==========================================

/** Chunk size for uploads (5MB) */
const CHUNK_SIZE = 5 * 1024 * 1024;

/** Generate a simple UUID v4 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Extract error message from any error object.
 */
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: {
        data?: { detail?: string; message?: string; error?: string };
      };
    };
    const data = axiosErr.response?.data;
    if (data?.detail) return String(data.detail);
    if (data?.message) return String(data.message);
    if (data?.error) return String(data.error);
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

/**
 * Format bytes to human-readable size.
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ==========================================
// Component
// ==========================================

interface StagingUploadFormProps {
  className?: string;
}

/**
 * StagingUploadForm — Large file upload with resumable chunks
 *
 * Features:
 * - TUS-like chunked upload protocol
 * - Resume support (checks offset and continues from last position)
 * - Progress tracking per file
 * - Multiple file selection
 * - Automatic import after upload completion
 *
 * @returns Staging upload form component
 */
export default function StagingUploadForm({ className }: StagingUploadFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [caseName, setCaseName] = useState('');

  // File upload states
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  /**
   * Create a new staging session.
   */
  const createSession = useCallback(async () => {
    console.info('[StagingUploadForm] Creating new staging session...');
    try {
      const newSessionId = generateUUID();
      const response = await caseImporterService.createStagingSession({
        session_id: newSessionId,
      });
      setSessionId(response.session_id);
      toast.success(t('caseImporter.stagingForm.toastSessionCreated', 'Upload session created'));
      console.info('[StagingUploadForm] Session created:', {
        session_id: response.session_id,
      });
    } catch (error) {
      console.error('[StagingUploadForm] Session creation failed:', error);
      toast.error(
        t('caseImporter.stagingForm.toastCreateSessionFailed', {
          defaultValue: 'Failed to create session: {{error}}',
          error: extractErrorMessage(error),
        })
      );
    }
  }, [t]);

  /**
   * Handle file selection.
   */
  const handleFileSelection = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileStates: FileUploadState[] = Array.from(selectedFiles).map((file) => ({
      file,
      fileId: generateUUID(),
      progress: 0,
      status: 'pending',
      offset: 0,
    }));

    setFiles(fileStates);
    console.info('[StagingUploadForm] Files selected:', {
      count: fileStates.length,
      total_size: fileStates.reduce((sum, f) => sum + f.file.size, 0),
    });
  }, []);

  /**
   * Upload a single file with chunked upload.
   */
  const uploadFile = useCallback(
    async (fileState: FileUploadState): Promise<void> => {
      if (!sessionId) {
        throw new Error('No active session');
      }

      const { file, fileId } = fileState;
      console.info('[StagingUploadForm] Starting upload:', {
        fileId,
        filename: file.name,
        size: file.size,
      });

      // 1. Register file in staging session
      // Backend expects only: relative_path + upload_length
      // Backend returns file_id which we must use for subsequent API calls
      let backendFileId: string;
      try {
        const regResponse = await caseImporterService.registerStagingFile(sessionId, {
          relative_path: getStagingRelativePath(file),
          upload_length: file.size,
        });
        backendFileId = regResponse.file_id;
        console.info('[StagingUploadForm] File registered:', {
          filename: file.name,
          file_id: backendFileId,
        });
      } catch (error) {
        console.error('[StagingUploadForm] File registration failed:', {
          fileId,
          error,
        });
        throw error;
      }

      // 2. Check current offset (resume support)
      let currentOffset = 0;
      try {
        const info = await caseImporterService.getStagingFileInfo(
          sessionId,
          backendFileId,
          true
        );
        currentOffset = info.offset || 0;
        console.info('[StagingUploadForm] Current offset:', {
          fileId: backendFileId,
          offset: currentOffset,
        });
      } catch (error) {
        console.warn('[StagingUploadForm] Failed to get offset, assuming 0:', error);
      }

      // 3. Upload chunks from current offset
      while (currentOffset < file.size) {
        const chunkEnd = Math.min(currentOffset + CHUNK_SIZE, file.size);
        const chunk = file.slice(currentOffset, chunkEnd);

        console.debug('[StagingUploadForm] Uploading chunk:', {
          fileId: backendFileId,
          offset: currentOffset,
          chunk_size: chunk.size,
        });

        try {
          const result = await caseImporterService.uploadFileChunk(
            sessionId,
            backendFileId,
            currentOffset,
            chunk,
            (chunkProgress) => {
              // Update progress for this file (use local fileId for UI state)
              const overallProgress = Math.round(
                ((currentOffset + (chunk.size * chunkProgress) / 100) / file.size) * 100
              );
              setFiles((prev) =>
                prev.map((f) =>
                  f.fileId === fileId
                    ? { ...f, progress: overallProgress, status: 'uploading' }
                    : f
                )
              );
            }
          );

          currentOffset = result.offset;
          console.debug('[StagingUploadForm] Chunk uploaded, new offset:', {
            fileId: backendFileId,
            offset: currentOffset,
          });
        } catch (error) {
          console.error('[StagingUploadForm] Chunk upload failed:', {
            fileId: backendFileId,
            offset: currentOffset,
            error,
          });
          throw error;
        }
      }

      // Upload complete
      console.info('[StagingUploadForm] File upload complete:', { fileId: backendFileId });
      setFiles((prev) =>
        prev.map((f) =>
          f.fileId === fileId ? { ...f, progress: 100, status: 'completed' } : f
        )
      );
    },
    [sessionId]
  );

  /**
   * Start uploading all selected files.
   */
  const startUpload = useCallback(async () => {
    if (files.length === 0) {
      toast.error(t('caseImporter.stagingForm.toastNoFilesSelected', 'No files selected'));
      return;
    }

    if (!sessionId) {
      toast.error(
        t('caseImporter.stagingForm.toastNoActiveSession', 'No active session. Please wait...')
      );
      await createSession();
      return;
    }

    setIsUploading(true);
    console.info('[StagingUploadForm] Starting upload for all files...');

    try {
      // Upload files sequentially (can be parallelized if needed)
      for (const fileState of files) {
        if (fileState.status !== 'completed') {
          try {
            await uploadFile(fileState);
          } catch (error) {
            const errorMsg = extractErrorMessage(error);
            console.error('[StagingUploadForm] File upload failed:', {
              fileId: fileState.fileId,
              error: errorMsg,
            });
            setFiles((prev) =>
              prev.map((f) =>
                f.fileId === fileState.fileId
                  ? { ...f, status: 'failed', error: errorMsg }
                  : f
              )
            );
            toast.error(
              t('caseImporter.stagingForm.toastUploadFailedFile', {
                defaultValue: 'Upload failed: {{name}}',
                name: fileState.file.name,
              })
            );
          }
        }
      }

      toast.success(
        t('caseImporter.stagingForm.toastAllUploaded', 'All files uploaded successfully')
      );
      console.info('[StagingUploadForm] All uploads complete');
    } catch (error) {
      console.error('[StagingUploadForm] Upload process failed:', error);
      toast.error(t('caseImporter.stagingForm.toastUploadFailed', 'Upload failed'));
    } finally {
      setIsUploading(false);
    }
  }, [files, sessionId, createSession, uploadFile, t]);

  /**
   * Import uploaded files as a case.
   */
  const importCase = useCallback(async () => {
    if (!sessionId) {
      toast.error(t('caseImporter.stagingForm.toastNoActiveSessionSimple', 'No active session'));
      return;
    }

    if (!caseName.trim()) {
      toast.error(t('caseImporter.stagingForm.toastEnterCaseName', 'Please enter a case name'));
      return;
    }

    const allCompleted = files.every((f) => f.status === 'completed');
    if (!allCompleted) {
      toast.error(
        t('caseImporter.stagingForm.toastFilesNotUploaded', 'Some files are not uploaded yet')
      );
      return;
    }

    setIsImporting(true);
    console.info('[StagingUploadForm] Starting import from staging...', {
      staging_id: sessionId,
      case_name: caseName,
    });

    try {
      const result = await caseImporterService.importFromStaging({
        staging_id: sessionId,
        case_name: caseName.trim(),
      });

      toast.success(
        t('caseImporter.stagingForm.toastImportStarted', {
          defaultValue: 'Import started: {{message}}',
          message: result.message,
        })
      );
      console.info('[StagingUploadForm] Import queued:', {
        case_id: result.case_id,
      });

      await cleanupStagingSessionAfterImport(sessionId);

      router.push(routes.caseImporter.detail(result.case_id));
    } catch (error) {
      console.error('[StagingUploadForm] Import failed:', error);
      toast.error(
        t('caseImporter.stagingForm.toastImportFailed', {
          defaultValue: 'Import failed: {{error}}',
          error: extractErrorMessage(error),
        })
      );
    } finally {
      setIsImporting(false);
    }
  }, [sessionId, caseName, files, router, t]);

  /**
   * Clear all files and reset form.
   */
  const clearFiles = useCallback(() => {
    setFiles([]);
    setCaseName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Auto-create session on mount
  useState(() => {
    if (!sessionId) {
      createSession();
    }
  });

  // Calculate overall progress
  const overallProgress =
    files.length > 0
      ? Math.round(files.reduce((sum, f) => sum + f.progress, 0) / files.length)
      : 0;

  const completedFiles = files.filter((f) => f.status === 'completed').length;
  const failedFiles = files.filter((f) => f.status === 'failed').length;

  return (
    <div className={cn('rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50', className)}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Title as="h3" className="mb-2 text-lg">
            <PiCloudArrowUpDuotone className="mr-2 inline h-6 w-6" />
            {t('caseImporter.stagingForm.title', 'Resumable Upload (Large Files)')}
          </Title>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {t(
              'caseImporter.stagingForm.description',
              'Upload large files with pause/resume support using chunked upload protocol.'
            )}
          </Text>
        </div>
      </div>

      {/* Session Info */}
      {sessionId && (
        <div className="mb-4 rounded-md bg-gray-100 p-3 dark:bg-gray-100">
          <Text className="text-xs text-gray-500">
            {t('caseImporter.stagingForm.sessionId', 'Session ID')}: <code className="font-mono">{sessionId}</code>
          </Text>
        </div>
      )}

      {/* File Selection */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelection}
          className="hidden"
          disabled={isUploading || isImporting}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
          variant="outline"
          disabled={isUploading || isImporting}
        >
          <PiFolderOpenDuotone className="mr-2 h-5 w-5" />
          {t('caseImporter.stagingForm.selectFiles', 'Select Files')}
        </Button>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <Text className="font-medium">
              {t('caseImporter.stagingForm.filesCompleted', {
                defaultValue: 'Files ({{completed}}/{{total}} completed)',
                completed: completedFiles,
                total: files.length,
              })}
            </Text>
            {!isUploading && (
              <Button size="sm" variant="text" onClick={clearFiles}>
                <PiTrashBold className="mr-1 h-4 w-4" />
                {t('common.clear', 'Clear')}
              </Button>
            )}
          </div>

          {files.map((fileState) => (
            <div
              key={fileState.fileId}
              className="rounded-md border border-muted bg-white p-3 dark:bg-gray-100"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1">
                  <Text className="font-medium">{fileState.file.name}</Text>
                  <Text className="text-xs text-gray-500">
                    {formatFileSize(fileState.file.size)}
                  </Text>
                </div>
                <div className="ml-2">
                  {fileState.status === 'completed' && (
                    <PiCheckCircleDuotone className="h-5 w-5 text-green" />
                  )}
                  {fileState.status === 'failed' && (
                    <PiWarningDuotone className="h-5 w-5 text-red" />
                  )}
                  {fileState.status === 'uploading' && (
                    <Loader size="sm" variant="spinner" />
                  )}
                </div>
              </div>

              {fileState.status !== 'pending' && (
                <Progressbar value={fileState.progress} color="primary" size="sm" />
              )}

              {fileState.error && (
                <Text className="mt-1 text-xs text-red">{fileState.error}</Text>
              )}
            </div>
          ))}

          {/* Overall Progress */}
          {isUploading && (
            <div className="rounded-md bg-gray-100 p-3 dark:bg-gray-150">
              <Text className="mb-2 text-sm font-medium">
                {t('caseImporter.stagingForm.overallProgress', {
                  defaultValue: 'Overall Progress: {{progress}}%',
                  progress: overallProgress,
                })}
              </Text>
              <Progressbar value={overallProgress} color="primary" />
            </div>
          )}
        </div>
      )}

      {/* Case Name Input */}
      {files.length > 0 && (
        <div className="mb-6">
          <Input
            label={t('caseImporter.import.caseNameLabel')}
            placeholder={t('caseImporter.stagingForm.caseNamePlaceholder', 'Enter a name for this case')}
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            disabled={isUploading || isImporting}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={startUpload}
          disabled={files.length === 0 || isUploading || isImporting || completedFiles === files.length}
          className="flex-1"
        >
          {isUploading ? (
            <>
              <Loader size="sm" variant="spinner" className="mr-2" />
              {t('caseImporter.import.submit.uploading')}
            </>
          ) : (
            <>
              <PiCloudArrowUpDuotone className="mr-2 h-5 w-5" />
              {t('caseImporter.stagingForm.uploadFiles', 'Upload Files')}
            </>
          )}
        </Button>

        <Button
          onClick={importCase}
          disabled={
            files.length === 0 ||
            isUploading ||
            isImporting ||
            completedFiles !== files.length ||
            !caseName.trim()
          }
          className="flex-1"
        >
          {isImporting ? (
            <>
              <Loader size="sm" variant="spinner" className="mr-2" />
              {t('caseImporter.import.submit.importing')}
            </>
          ) : (
            <>
              <PiRocketLaunchDuotone className="mr-2 h-5 w-5" />
              {t('caseImporter.stagingForm.importCase', 'Import Case')}
            </>
          )}
        </Button>
      </div>

      {/* Status Messages */}
      {failedFiles > 0 && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
          <Text className="text-sm text-red-600 dark:text-red-400">
            <PiWarningDuotone className="mr-1 inline h-4 w-4" />
            {t('caseImporter.stagingForm.failedFiles', {
              defaultValue: '{{count}} file(s) failed to upload. Please retry.',
              count: failedFiles,
            })}
          </Text>
        </div>
      )}
    </div>
  );
}
