// ============================================
// FilePreviewInline — Collapsible inline file preview box
// Appears within chat messages, following ThinkingSteps visual pattern.
// Supports image, video, audio, PDF, text/code, and generic files.
// Has "Expand" button to open full-featured modal via useModal().
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MediaElementHost,
  MediaPreviewPlaceholder,
  useMediaPreview,
  useMediaStickyHandlers,
} from '@/components/media-playback';
import {
  PiX,
  PiDownloadSimple,
  PiArrowsOutSimple,
  PiFileBold,
  PiMusicNoteFill,
  PiWarningCircle,
  PiFileDoc,
  PiFileXls,
  PiFilePpt,
  PiSpinner,
} from 'react-icons/pi';
import { AudioPlayer, type AudioPlayerControls, useAudioStickyAnchor, useAudioPlayerPrefs } from '@/components/audio-player';
import VideoPlayer, {
  type VideoPlayerControls,
  type VideoPlayerSettings,
} from '@/components/video-player';
import mammoth from 'mammoth';
import cn from '@core/utils/class-names';
import { ActionIcon } from 'rizzui';
import { chatService } from '@/services/chat.service';
import { debugLog } from '@/utils/debug-logger';
import FileTypeIcon from '@/components/file-type-icon';
import { getFileIcon } from '@/utils/file-icons';
import { CHAT_EXPAND_MODAL_CUSTOM_SIZE } from '@/app/shared/ai-chat/chat-expand-modal-size';
import { formatFileSize } from '@/config/file-upload.config';
import {
  inferMimeFromName,
  getFileCategory,
  retypeBlob,
  type FileCategory,
} from '@/utils/mime-utils';
import { useModal } from '@/app/shared/modal-views/use-modal';
import FilePreviewModalView from './file-preview-modal';
import MarkdownRenderer from '@/app/shared/ai-chat/markdown-renderer';
import { extractArtifactIdFromGatewaySrc } from '@/utils/gateway-media-url';

// ==========================================
// Types & Utilities
// NOTE: FileCategory, EXT_MIME_MAP, inferMimeFromName, getFileCategory,
// and retypeBlob are centralized in @/utils/mime-utils (DRY).
// ==========================================

interface FilePreviewInlineProps {
  /** URL to fetch the file from (will be fetched with auth) */
  src: string;
  /** Display filename */
  name?: string;
  /** MIME type of the file */
  mimeType?: string | null;
  /** File size in bytes */
  fileSize?: number | null;
  /** Local blob URL from current session upload */
  localPreviewUrl?: string;
  /** Artifact ID for presigned URL generation (video/audio streaming) */
  artifactId?: string;
  /** Callback to close the preview */
  onClose: () => void;
}

/**
 * Get a human-readable label for a file category.
 */
function getCategoryLabel(category: FileCategory): string {
  const labels: Record<FileCategory, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    pdf: 'PDF',
    text: 'Text',
    document: 'Document',
    unknown: 'File',
  };
  return labels[category];
}

/**
 * Get the file extension from a filename.
 */
function getExtension(filename?: string): string {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toUpperCase() ?? '' : '';
}

/**
 * Get the modal customSize based on file category.
 * RizzUI Modal uses customSize as CSS max-width.
 */
function getModalSize(category: FileCategory): string {
  switch (category) {
    case 'image':
      return '1200px';
    case 'video':
      return '1000px';
    case 'audio':
      return '500px';
    case 'pdf':
      return '900px';
    case 'document':
    case 'text':
      return CHAT_EXPAND_MODAL_CUSTOM_SIZE;
    case 'unknown':
      return '500px';
    default:
      return '800px';
  }
}

const effectiveMimeType = (mimeType?: string | null, name?: string) =>
  mimeType ?? inferMimeFromName(name ?? '');

// ==========================================
// Document Helper Functions
// ==========================================

/**
 * Get a color-coded icon for document types (Word=blue, Excel=green, PowerPoint=orange).
 */
function getDocumentIcon(mimeType?: string | null): React.ReactNode {
  if (!mimeType) return <PiFileBold className="h-7 w-7 text-gray-400" />;
  const t = mimeType.toLowerCase();

  if (t.includes('word') || t.includes('wordprocessing') || t === 'application/rtf') {
    return <PiFileDoc className="h-7 w-7 text-blue-500" />;
  }
  if (t.includes('excel') || t.includes('spreadsheet')) {
    return <PiFileXls className="h-7 w-7 text-green-600" />;
  }
  if (t.includes('powerpoint') || t.includes('presentation')) {
    return <PiFilePpt className="h-7 w-7 text-orange-500" />;
  }
  return <PiFileBold className="h-7 w-7 text-gray-400" />;
}

/**
 * Get a human-readable label for document MIME types.
 */
function getDocumentTypeLabel(mimeType?: string | null): string {
  if (!mimeType) return 'Document';
  const t = mimeType.toLowerCase();

  if (t.includes('word') || t.includes('wordprocessing')) return 'Microsoft Word Document';
  if (t === 'application/rtf') return 'Rich Text Document';
  if (t.includes('excel') || t.includes('spreadsheet')) return 'Microsoft Excel Spreadsheet';
  if (t.includes('powerpoint') || t.includes('presentation')) return 'Microsoft PowerPoint Presentation';
  return 'Document';
}

// ==========================================
// Document sub-type detection
// ==========================================

/**
 * Check if a file is a Word document (DOCX/DOC/RTF).
 * WHY: Backend may not return MIME type, so we also check by extension.
 * Without extension fallback, DOCX files with missing/octet-stream MIME
 * would never trigger mammoth conversion.
 */
function isWordType(mimeType?: string | null, fileName?: string | null): boolean {
  if (mimeType) {
    const t = mimeType.toLowerCase();
    if (t.includes('word') || t.includes('wordprocessing') || t === 'application/rtf') return true;
  }
  // Extension fallback when MIME is missing or application/octet-stream
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'doc' || ext === 'docx' || ext === 'rtf') return true;
  }
  return false;
}

/**
 * Check if a file is an Excel spreadsheet (XLSX/XLS).
 * WHY: Backend may not return MIME type, so we also check by extension.
 */
function isExcelType(mimeType?: string | null, fileName?: string | null): boolean {
  if (mimeType) {
    const t = mimeType.toLowerCase();
    if (t.includes('excel') || t.includes('spreadsheet')) return true;
  }
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'xls' || ext === 'xlsx') return true;
  }
  return false;
}

// ==========================================
// Main Component
// ==========================================

/**
 * FilePreviewInline — Inline collapsible file preview following ThinkingSteps pattern.
 *
 * Renders within the chat message flow as a dashed-border box with:
 * - Header bar: file icon + name + type badge + size + expand/download/close buttons
 * - Content area: type-specific viewer (image, video, audio, PDF, text, unknown)
 * - "Expand" button opens full-featured modal via template's global useModal() system
 *
 * Visual language matches ThinkingSteps:
 * - Dashed border, subtle gray background
 * - animate-chat-scale-in entrance
 * - Responsive max-heights per media type
 *
 * @requires chatService — for authenticated file fetching and download
 * @requires useModal — template's global modal system for expand functionality
 * @requires FilePreviewModalView — full-featured modal viewer
 *
 * @example
 * ```tsx
 * {previewFile && (
 *   <FilePreviewInline
 *     src={fileUrl}
 *     name="video.mp4"
 *     mimeType="video/mp4"
 *     fileSize={1024000}
 *     onClose={() => setPreviewFile(null)}
 *   />
 * )}
 * ```
 */
export default function FilePreviewInline({
  src,
  name,
  mimeType,
  fileSize,
  localPreviewUrl,
  artifactId,
  onClose,
}: FilePreviewInlineProps) {
  const { openModal } = useModal();
  const category = getFileCategory(mimeType, name);
  const ext = getExtension(name);
  const resolvedArtifactId = artifactId ?? extractArtifactIdFromGatewaySrc(src);
  const audioSessionId = resolvedArtifactId ?? src;
  const audioPrefs = useAudioPlayerPrefs();

  const [blobUrl, setBlobUrl] = useState<string | null>(localPreviewUrl ?? null);
  /** When localPreviewUrl is set (lab/dev), play blob directly — mock artifactId must not hit JWT resolver */
  const audioPlaybackArtifactId = localPreviewUrl ? undefined : resolvedArtifactId;
  const audioPlaybackSrc = audioPlaybackArtifactId ? undefined : blobUrl ?? undefined;
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!localPreviewUrl);
  const [error, setError] = useState<string | null>(null);
  const inlineAudioControlsRef = useRef<AudioPlayerControls | null>(null);
  const inlineVideoControlsRef = useRef<VideoPlayerControls | null>(null);
  const stickyAnchorRef = useRef<HTMLDivElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // ── Document inline rendering state ──
  // WHY: User expects DOCX/XLSX content to render directly inline,
  // not behind an extra "Preview" button click.
  const [docHtml, setDocHtml] = useState<string | null>(null);
  const [docConverting, setDocConverting] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  /** Excel data: array of sheets, each with name + 2D array of cell strings */
  const [excelSheets, setExcelSheets] = useState<Array<{ name: string; data: string[][] }> | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);

  // PiP-style sync: modal uses MPS — inline shows placeholder while modal is open.
  /** Inline decorative waveform bars visible (chatInline) */
  const [inlineShowWaveform, setInlineShowWaveform] = useState(false);
  /** Advanced mode (filmstrip/sidebar) synced with modal */
  const [inlineShowAdvanced, setInlineShowAdvanced] = useState(false);
  const [videoSettings, setVideoSettings] = useState<VideoPlayerSettings>({
    volume: 0.8,
    playbackRate: 1,
    isMuted: false,
  });
  const audioReady = category === 'audio' && Boolean(resolvedArtifactId || blobUrl);

  const audioMedia = useMediaPreview({
    enabled: category === 'audio' && audioReady,
    kind: 'audio',
    src,
    artifactId: audioPlaybackArtifactId,
    mimeType,
    fileSize,
    title: name,
    blobUrl,
    initialView: { showWaveform: false },
  });

  const videoReady = category === 'video' && Boolean(blobUrl);
  const videoMedia = useMediaPreview({
    enabled: videoReady,
    kind: 'video',
    src,
    artifactId: resolvedArtifactId,
    mimeType,
    fileSize,
    title: name,
    blobUrl,
  });

  const stickyHandlers = useMediaStickyHandlers({
    mediaSessionId: audioMedia.sessionId || undefined,
    fallback: {
      togglePlay: () => inlineAudioControlsRef.current?.togglePlay(),
      seekTo: (time) => inlineAudioControlsRef.current?.seekTo(time),
    },
  });

  useAudioStickyAnchor({
    enabled:
      category === 'audio' &&
      audioPlaying &&
      !audioMedia.isModal &&
      Boolean(audioSessionId),
    sessionId: audioSessionId,
    anchorRef: stickyAnchorRef,
    anchorKey: audioSessionId,
    stickyLayout: audioPrefs.stickyLayout,
    handlers: stickyHandlers,
  });

  /** Live sync waveform flag from MPS session (modal ↔ inline). */
  useEffect(() => {
    const wf = audioMedia.session?.view.showWaveform;
    if (wf !== undefined) setInlineShowWaveform(wf);
  }, [audioMedia.session?.view.showWaveform]);

  /** Live sync advanced video flag from MPS session (modal ↔ inline). */
  useEffect(() => {
    const adv = videoMedia.session?.view.showAdvanced;
    if (adv !== undefined) setInlineShowAdvanced(adv);
  }, [videoMedia.session?.view.showAdvanced]);

  // Fetch file content with auth
  useEffect(() => {
    debugLog.preview('FilePreviewInline mount', {
      src,
      name,
      mimeType,
      category,
      artifactId,
      hasLocalPreview: !!localPreviewUrl,
      fileSize,
    });
    if (localPreviewUrl) {
      // For text files with local URL, read as text
      if (category === 'text') {
        fetch(localPreviewUrl)
          .then((r) => r.text())
          .then((text) => {
            setTextContent(text);
            setIsLoading(false);
          })
          .catch(() => setIsLoading(false));
      } else {
        setBlobUrl(localPreviewUrl);
        setIsLoading(false);
      }
      return;
    }

    // AudioPlayer resolves artifactId internally — skip redundant blob fetch.
    if (category === 'audio' && resolvedArtifactId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const fetchContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // WHY: We always fetch video/audio as authenticated blobs rather than using
        // presigned URLs. The presigned URL points to MinIO directly (e.g. http://10.7.0.7:9000/...)
        // which is either unreachable from the browser or CORS-blocked. Blob download
        // through the gateway proxy works reliably and creates a proper blob: URL.

        debugLog.preview('FilePreviewInline fetching file', { src, category });
        const authHeaders = await chatService.getAuthHeaders();
        const response = await fetch(src, { headers: authHeaders });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (category === 'text') {
          const text = await response.text();
          if (!cancelled) {
            setTextContent(text);
            setIsLoading(false);
          }
        } else {
          const rawBlob = await response.blob();
          if (!cancelled) {
            // ⚠️ WORKAROUND: Re-type blob when backend returns wrong Content-Type.
            // Uses centralized retypeBlob() from mime-utils.ts.
            // Remove when backend sets correct Content-Type headers. (audit §4.1)
            const finalBlob = retypeBlob(rawBlob, name);
            if (finalBlob !== rawBlob) {
              debugLog.preview('FilePreviewInline re-typed blob', {
                original: rawBlob.type,
                corrected: finalBlob.type,
                name,
              });
            }
            setBlobUrl(URL.createObjectURL(finalBlob));
            setIsLoading(false);
          }
        }

        debugLog.preview('FilePreviewInline file loaded', { category, name });
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load';
          console.error('[FilePreviewInline] Load failed:', { src, error: err });
          setError(msg);
          setIsLoading(false);
        }
      }
    };

    fetchContent();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, localPreviewUrl, category, name, artifactId]);

  // ── Document conversion: convert DOCX/XLSX blob to renderable content ──
  // WHY: Runs after blobUrl is available for document types. Uses mammoth.js
  // for Word docs and xlsx (SheetJS) for Excel spreadsheets to render content
  // directly inline without requiring an extra "Preview" click.
  useEffect(() => {
    if (category !== 'document' || !blobUrl || isLoading) return;

    let cancelled = false;

    const convertDocument = async () => {
      setDocConverting(true);
      setDocError(null);

      try {
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();

        if (isWordType(mimeType, name)) {
          // Word → HTML via mammoth.js
          debugLog.preview('FilePreviewInline converting DOCX', { name, mimeType });
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (!cancelled) {
            setDocHtml(result.value);
            debugLog.preview('FilePreviewInline DOCX conversion complete', {
              name,
              warnings: result.messages.length,
            });
          }
        } else if (isExcelType(mimeType, name)) {
          // Excel → 2D table via xlsx (SheetJS) — dynamic import to reduce bundle
          debugLog.preview('FilePreviewInline converting XLSX', { name, mimeType });
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          if (!cancelled) {
            const sheets = workbook.SheetNames.map((sheetName) => {
              const sheet = workbook.Sheets[sheetName];
              // WHY: header=1 returns 2D array of raw values (no header mapping)
              const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
              return { name: sheetName, data: data as string[][] };
            });
            setExcelSheets(sheets);
            debugLog.preview('FilePreviewInline XLSX conversion complete', {
              name,
              sheets: sheets.length,
              rows: sheets[0]?.data.length ?? 0,
            });
          }
        }
        // PowerPoint — no client-side renderer available, stays as download card
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Document conversion failed';
          console.error('[FilePreviewInline] Document conversion failed:', { name, err });
          setDocError(msg);
        }
      } finally {
        if (!cancelled) setDocConverting(false);
      }
    };

    convertDocument();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobUrl, category, mimeType, isLoading]);

  // Expand to full modal — PiP-style: suspends inline media entirely,
  // only the modal player is active. On close, position syncs back.
  const handleExpand = useCallback(() => {
    debugLog.preview('FilePreviewInline expanding to modal', { name, category });

    if (category === 'video') {
      videoMedia.expandToModal();
    } else if (category === 'audio') {
      audioMedia.expandToModal();
    }

    const handlePlaybackSync = (ct: number, ip: boolean, finalModeFlag?: boolean) => {
      if (category === 'audio') {
        if (finalModeFlag !== undefined) setInlineShowWaveform(finalModeFlag);
        debugLog.preview('PiP reverse sync from modal (audio MPS)', { ct, ip });
        return;
      }
      if (category === 'video') {
        if (finalModeFlag !== undefined) setInlineShowAdvanced(finalModeFlag);
        debugLog.preview('PiP reverse sync from modal (video MPS)', { ct, ip });
      }
    };

    openModal({
      view: (
        <FilePreviewModalView
          src={src}
          name={name}
          mimeType={mimeType}
          fileSize={fileSize}
          localPreviewUrl={localPreviewUrl}
          artifactId={artifactId}
          initialBlobUrl={blobUrl}
          initialTextContent={textContent}
          onPlaybackSync={handlePlaybackSync}
          mediaSessionId={
            category === 'audio'
              ? audioMedia.sessionId
              : category === 'video'
                ? videoMedia.sessionId
                : undefined
          }
          initialShowWaveform={inlineShowWaveform}
          initialShowAdvanced={inlineShowAdvanced}
          initialVideoSettings={videoSettings}
          onVideoSettingsChange={setVideoSettings}
        />
      ),
      customSize: getModalSize(category),
    });
  }, [
    openModal,
    src,
    name,
    mimeType,
    fileSize,
    localPreviewUrl,
    artifactId,
    blobUrl,
    textContent,
    category,
    inlineShowWaveform,
    inlineShowAdvanced,
    videoSettings,
    audioMedia,
    videoMedia,
  ]);

  // Download
  const handleDownload = useCallback(async () => {
    const filename = name || 'download';
    debugLog.preview('FilePreviewInline downloading', { filename });
    try {
      await chatService.downloadFile(src, filename);
    } catch (err: unknown) {
      console.error('[FilePreviewInline] Download failed:', err);
    }
  }, [src, name]);

  return (
    <div ref={stickyAnchorRef} className="mb-2 animate-chat-scale-in">
      <div className="overflow-hidden rounded-lg border border-dashed border-gray-200 bg-gray-50/50 dark:border-gray-200/30 dark:bg-gray-100/30">
        {/* Shared audio — one element for inline + modal (prevents duplicate playback) */}
        {audioReady && audioMedia.sessionId && (
          <MediaElementHost
            sessionId={audioMedia.sessionId}
            kind="audio"
            src={audioMedia.playbackSrc}
          />
        )}
        {category === 'video' && blobUrl && videoMedia.sessionId && (
          <MediaElementHost
            sessionId={videoMedia.sessionId}
            kind="video"
            src={videoMedia.playbackSrc}
            className="hidden"
          />
        )}
        {/* ── Header bar ── */}
        <div className="flex items-center gap-2 px-3 py-2">
          <FileTypeIcon
            mimeType={effectiveMimeType(mimeType, name)}
            filename={name}
            size="sm"
            className="flex-shrink-0"
          />

          {/* Filename */}
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700 dark:text-gray-300">
            {name || 'File'}
          </span>

          {/* Type badge */}
          <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500 dark:bg-gray-200/30 dark:text-gray-400">
            {ext || getCategoryLabel(category)}
          </span>

          {/* Size */}
          {fileSize != null && (
            <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
              {formatFileSize(fileSize)}
            </span>
          )}

          {/* Action buttons */}
          <div className="flex flex-shrink-0 items-center gap-0.5">
            <Tooltip content="Expand" placement="top">
              <ActionIcon
                variant="text"
                size="sm"
                aria-label="Expand"
                onClick={handleExpand}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <PiArrowsOutSimple className="h-3.5 w-3.5" />
              </ActionIcon>
            </Tooltip>

            <Tooltip content="Download" placement="top">
              <ActionIcon
                variant="text"
                size="sm"
                onClick={handleDownload}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <PiDownloadSimple className="h-3.5 w-3.5" />
              </ActionIcon>
            </Tooltip>

            <Tooltip content="Close" placement="top">
              <ActionIcon
                variant="text"
                size="sm"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <PiX className="h-3.5 w-3.5" />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {/* ── Content area ── */}
        <div className="border-t border-gray-200/60 dark:border-gray-200/20">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary dark:border-gray-500 dark:border-t-primary" />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Loading {getCategoryLabel(category).toLowerCase()}...
                </span>
              </div>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <PiWarningCircle className="mb-2 h-6 w-6 text-gray-400 dark:text-gray-500" />
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Unable to preview this file
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <PiDownloadSimple className="h-3.5 w-3.5" />
                Download instead
              </button>
            </div>
          )}

          {/* ── Loaded content — per-category inline viewers ── */}
          {!isLoading && !error && (
            <>
              {/* Image — click to expand, object-contain with max height */}
              {category === 'image' && blobUrl && (
                <div
                  className="flex cursor-pointer items-center justify-center bg-gray-100/50 p-2 dark:bg-gray-200/10"
                  onClick={handleExpand}
                  title="Click to expand"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={blobUrl}
                    alt={name || 'Image'}
                    className="max-h-[350px] max-w-full rounded object-contain"
                  />
                </div>
              )}

              {/* Video — MPS session video reparents into chatInline stage */}
              {category === 'video' && blobUrl && videoMedia.sessionId && (
                <>
                  {!videoMedia.isModal ? (
                    <div className="border-t border-gray-200/60 bg-gray-0 px-3 py-3 dark:border-gray-200/20 dark:bg-gray-50">
                      <VideoPlayer
                        src={blobUrl}
                        variant="chatInline"
                        chatInlineLayout="footer"
                        title={name || 'Video'}
                        mediaSessionId={videoMedia.sessionId}
                        volume={videoSettings.volume}
                        playbackRate={videoSettings.playbackRate}
                        isMuted={videoSettings.isMuted}
                        onSettingsChange={setVideoSettings}
                        controlsRef={inlineVideoControlsRef}
                        onExpand={handleExpand}
                      />
                    </div>
                  ) : (
                    <div className="px-3 py-3">
                      <MediaPreviewPlaceholder
                        sessionId={videoMedia.sessionId}
                        kind="video"
                        title={name || 'Video'}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Audio — PiP-style: suspended when modal is open */}
              {category === 'audio' && audioReady && audioMedia.sessionId && !audioMedia.isModal && (
                <div className="px-3 py-3">
                  <AudioPlayer
                    artifactId={audioPlaybackArtifactId}
                    src={audioPlaybackSrc}
                    variant="chatInline"
                    title={name || 'Audio'}
                    mediaSessionId={audioMedia.sessionId}
                    showWaveform={inlineShowWaveform}
                    onShowWaveformChange={(next) => {
                      setInlineShowWaveform(next);
                      audioMedia.setViewFlags({ showWaveform: next });
                    }}
                    controlsRef={inlineAudioControlsRef}
                    sessionId={audioSessionId}
                    stickyEnabled
                    stickyLayout={audioPrefs.stickyLayout}
                    onMediaStateChange={(_ct, ip) => setAudioPlaying(ip)}
                  />
                </div>
              )}

              {category === 'audio' && audioReady && audioMedia.sessionId && audioMedia.isModal && (
                <div className="px-3 py-3">
                  <MediaPreviewPlaceholder
                    sessionId={audioMedia.sessionId}
                    kind="audio"
                    title={name || 'Audio'}
                  />
                </div>
              )}

              {/* PDF — embedded iframe viewer */}
              {category === 'pdf' && blobUrl && (
                <div className="p-2">
                  <iframe
                    src={blobUrl}
                    title={name || 'PDF'}
                    className="h-[400px] w-full rounded border-0 bg-white"
                  />
                </div>
              )}

              {/* Text/Code — scrollable with line numbers; .md renders as markdown */}
              {category === 'text' && textContent !== null && (() => {
                const extLo = ext.toLowerCase();
                const isMarkdown =
                  mimeType === 'text/markdown' ||
                  extLo === 'md' ||
                  extLo === 'markdown' ||
                  extLo === 'mdx';
                if (isMarkdown) {
                  return (
                    <div className="max-h-[300px] overflow-auto p-3">
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <MarkdownRenderer content={textContent} className="font-vazirmatn" />
                      </div>
                    </div>
                  );
                }
                return (
                <div className="max-h-[300px] overflow-auto">
                  <div className="overflow-x-auto p-3">
                    <table className="w-full border-collapse">
                      <tbody>
                        {textContent.split('\n').map((line, i) => (
                          <tr key={i} className="leading-5 hover:bg-gray-100/50 dark:hover:bg-gray-200/10">
                            <td className="select-none pr-3 text-right align-top font-mono text-[10px] text-gray-300 dark:text-gray-600">
                              {i + 1}
                            </td>
                            <td className="whitespace-pre font-mono text-xs text-gray-600 dark:text-gray-400">
                              {line || '\u00A0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                );
              })()}

              {/* Document (Word/Excel/PowerPoint) — inline content rendering */}
              {category === 'document' && (
                <>
                  {/* Converting state */}
                  {docConverting && (
                    <div className="flex items-center justify-center gap-2 py-8">
                      <PiSpinner className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Converting document...
                      </span>
                    </div>
                  )}

                  {/* Conversion error — fallback to download */}
                  {docError && (
                    <div className="flex flex-col items-center justify-center px-4 py-6 text-center">
                      <PiWarningCircle className="mb-2 h-6 w-6 text-orange-400" />
                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                        Could not render document inline
                      </p>
                      <p className="mb-3 text-[10px] text-gray-400 dark:text-gray-500">{docError}</p>
                      <button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <PiDownloadSimple className="h-3.5 w-3.5" />
                        Download
                      </button>
                    </div>
                  )}

                  {/* Word document (DOCX) — rendered HTML via mammoth.js */}
                  {docHtml && (
                    <div className="max-h-[350px] overflow-auto bg-white/90 px-4 py-3 dark:bg-gray-200/10">
                      {/* WHY: Scoped styles for mammoth HTML output.
                       * mammoth does NOT include <script> or event handlers — safe for dangerouslySetInnerHTML. */}
                      <style>{`
                        .word-doc-inline h1 { font-size:1.25rem; font-weight:700; margin:.75rem 0 .4rem; }
                        .word-doc-inline h2 { font-size:1.1rem; font-weight:600; margin:.6rem 0 .3rem; }
                        .word-doc-inline h3 { font-size:1rem; font-weight:600; margin:.5rem 0 .25rem; }
                        .word-doc-inline p  { margin:.3rem 0; line-height:1.6; font-size:.8rem; }
                        .word-doc-inline ul, .word-doc-inline ol { margin:.3rem 0 .3rem 1.2rem; }
                        .word-doc-inline li { margin:.15rem 0; font-size:.8rem; line-height:1.6; }
                        .word-doc-inline strong, .word-doc-inline b { font-weight:600; }
                        .word-doc-inline em, .word-doc-inline i { font-style:italic; }
                        .word-doc-inline a { color:#6366f1; text-decoration:underline; }
                        .word-doc-inline table { width:100%; border-collapse:collapse; margin:.5rem 0; font-size:.75rem; }
                        .word-doc-inline th, .word-doc-inline td { border:1px solid #e5e7eb; padding:.3rem .5rem; text-align:left; }
                        .word-doc-inline th { background:#f9fafb; font-weight:600; }
                        .dark .word-doc-inline th { background:rgba(255,255,255,.05); }
                        .dark .word-doc-inline th, .dark .word-doc-inline td { border-color:rgba(255,255,255,.1); }
                        .dark .word-doc-inline p, .dark .word-doc-inline li, .dark .word-doc-inline td { color:#d1d5db; }
                        .dark .word-doc-inline h1, .dark .word-doc-inline h2, .dark .word-doc-inline h3 { color:#f3f4f6; }
                        .dark .word-doc-inline a { color:#818cf8; }
                      `}</style>
                      <div
                        className="word-doc-inline text-gray-800 dark:text-gray-200"
                        dangerouslySetInnerHTML={{ __html: docHtml }}
                      />
                    </div>
                  )}

                  {/* Excel spreadsheet (XLSX) — rendered as table */}
                  {excelSheets && excelSheets.length > 0 && (
                    <div>
                      {/* Sheet tabs — only show if multiple sheets */}
                      {excelSheets.length > 1 && (
                        <div className="flex gap-0.5 overflow-x-auto border-b border-gray-200/60 px-2 pt-1 dark:border-gray-200/20">
                          {excelSheets.map((sheet, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveSheet(idx)}
                              className={cn(
                                'whitespace-nowrap rounded-t px-2 py-1 text-[10px] font-medium transition-colors',
                                idx === activeSheet
                                  ? 'bg-white text-gray-700 dark:bg-gray-200/20 dark:text-gray-300'
                                  : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400'
                              )}
                            >
                              {sheet.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Table content — max 100 rows for inline, scroll for more */}
                      <div className="max-h-[350px] overflow-auto">
                        <table className="w-full border-collapse text-[11px]">
                          <tbody>
                            {excelSheets[activeSheet].data.slice(0, 100).map((row, ri) => (
                              <tr key={ri} className={ri === 0 ? 'bg-gray-50 font-semibold dark:bg-gray-200/10' : 'hover:bg-gray-50/50 dark:hover:bg-gray-200/5'}>
                                {/* Row number */}
                                <td className="select-none border border-gray-200/60 bg-gray-50 px-1.5 py-1 text-right text-[9px] text-gray-300 dark:border-gray-200/15 dark:bg-gray-200/10 dark:text-gray-600">
                                  {ri + 1}
                                </td>
                                {(row as unknown[]).map((cell, ci) => (
                                  <td
                                    key={ci}
                                    className="border border-gray-200/60 px-1.5 py-1 text-gray-600 dark:border-gray-200/15 dark:text-gray-400"
                                  >
                                    {cell != null ? String(cell) : ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {excelSheets[activeSheet].data.length > 100 && (
                          <p className="py-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
                            Showing first 100 of {excelSheets[activeSheet].data.length} rows — expand for full view
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PowerPoint or other unsupported document type — download card */}
                  {!docConverting && !docError && !docHtml && !excelSheets && (
                    <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20">
                        {getDocumentIcon(mimeType)}
                      </div>
                      <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {name || 'Document'}
                      </p>
                      <p className="mb-1 text-xs text-gray-400 dark:text-gray-500">
                        {getDocumentTypeLabel(mimeType)}
                      </p>
                      {fileSize && (
                        <p className="mb-4 text-[11px] text-gray-400 dark:text-gray-500">
                          {formatFileSize(fileSize)}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDownload}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <PiDownloadSimple className="h-3.5 w-3.5" />
                          Download
                        </button>
                        <button
                          onClick={handleExpand}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-muted px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20"
                        >
                          <PiArrowsOutSimple className="h-3.5 w-3.5" />
                          Preview
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Unknown — info + download */}
              {category === 'unknown' && (
                <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-200/30">
                    {getFileIcon(mimeType, 'h-6 w-6')}
                  </div>
                  <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                    {name || 'File'}
                  </p>
                  {mimeType && (
                    <p className="mb-3 text-[10px] text-gray-400 dark:text-gray-500">
                      {mimeType}
                    </p>
                  )}
                  <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
                    Preview is not available for this file type.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <PiDownloadSimple className="h-3.5 w-3.5" />
                    Download File
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
