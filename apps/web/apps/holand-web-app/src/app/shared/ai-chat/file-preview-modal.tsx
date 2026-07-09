// ============================================
// FilePreviewModalView — Full-featured file viewer for template's useModal()
// Designed to be used with: openModal({ view: <FilePreviewModalView ... /> })
// Supports: Image (zoom/pan/rotate), Video, Audio, PDF, Text/Code, Word/DOCX, Unknown
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiX,
  PiDownloadSimple,
  PiMagnifyingGlassMinus,
  PiMagnifyingGlassPlus,
  PiArrowsOutSimple,
  PiArrowClockwise,
  PiArrowCounterClockwise,
  PiPlayFill,
  PiPauseFill,
  PiSpeakerHighFill,
  PiSpeakerSlashFill,
  PiMusicNoteFill,
  PiWarningCircle,
  PiCameraBold,
  PiFileDoc,
  PiFileXls,
  PiFilePpt,
  PiFileBold,
} from 'react-icons/pi';
import mammoth from 'mammoth';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { ActionIcon, Title } from 'rizzui';
import { chatService } from '@/services/chat.service';
import { getFileIcon } from '@/utils/file-icons';
import { formatFileSize } from '@/config/file-upload.config';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { getFileCategory } from '@/utils/mime-utils';
import { debugLog } from '@/utils/debug-logger';
import MarkdownRenderer from '@/app/shared/ai-chat/markdown-renderer';
import { extractArtifactIdFromGatewaySrc } from '@/utils/gateway-media-url';
import {
  AudioPlayer as AudioPlayerGlobal,
} from '@/components/audio-player';
import {
  VideoPlayer as VideoPlayerGlobal,
  type VideoPlayerSettings,
  type VideoPlayerControls,
  type VideoChapter,
  type VideoSubtitleTrack,
} from '@/components/video-player';
import { loadArtifactChapters, loadArtifactSubtitles } from '@/components/video-player/utils/load-artifact-metadata';
import {
  addVideoBookmark,
  readVideoBookmarks,
} from '@/components/video-player/utils/bookmarks-storage';
import { resolveStoragePlaybackUrl } from '@/utils/resolve-storage-playback-url';
import { getPlaybackStrategy } from '@/utils/playback-strategy';
import {
  mediaSessionController,
  useMediaSessionStore,
} from '@/components/media-playback';

// ==========================================
// Types
// ==========================================

interface FilePreviewModalViewProps {
  /** URL to fetch the file from */
  src: string;
  /** Display filename */
  name?: string;
  /** MIME type */
  mimeType?: string | null;
  /** File size in bytes */
  fileSize?: number | null;
  /** Local blob URL from current session */
  localPreviewUrl?: string;
  /** Pre-loaded blob URL (from inline preview to avoid re-fetch) */
  initialBlobUrl?: string | null;
  /** Pre-loaded text content (from inline preview) */
  initialTextContent?: string | null;
  /** Initial playback position in seconds — for syncing when expanding from inline preview */
  initialCurrentTime?: number;
  /** Whether media was playing when expanded — to auto-resume in modal */
  initialIsPlaying?: boolean;
  /** Callback to sync playback state back to inline preview when modal closes */
  onPlaybackSync?: (currentTime: number, isPlaying: boolean, showWaveform?: boolean) => void;
  /** Live sync while modal is open (inline PiP mirror) */
  onLivePlaybackSync?: (currentTime: number, isPlaying: boolean, showWaveform?: boolean) => void;
  /** Shared HTML audio element from inline preview — single playback source */
  sharedAudioRef?: RefObject<HTMLAudioElement | null>;
  /** Shared HTML video element from inline preview — single playback source */
  sharedVideoRef?: RefObject<HTMLVideoElement | null>;
  /** Media Playback Session id — shared element + controller for audio handoff */
  mediaSessionId?: string;
  /** Volume/speed/mute synced from inline preview (video) */
  initialVideoSettings?: VideoPlayerSettings;
  /** Called when user changes volume, speed, or mute in modal (video) */
  onVideoSettingsChange?: (settings: VideoPlayerSettings) => void;
  /** Open modal in waveform mode when inline was showing waveform bars */
  initialShowWaveform?: boolean;
  /** Open modal in advanced mode when inline was showing advanced controls */
  initialShowAdvanced?: boolean;
  /** Storage artifact ID — used to get presigned URL for video/audio streaming */
  artifactId?: string;
  /** Optional media metadata hints (dimensions, duration, chapters, subtitles) for video/audio. */
  meta?: VideoPreviewMeta;
}

/** Typed media hints passed from One Search / explorer into file preview. */
export interface VideoPreviewMeta extends Record<string, unknown> {
  chapters?: VideoChapter[];
  subtitles?: VideoSubtitleTrack[];
}

function videoPreviewMetaFromRecord(meta?: Record<string, unknown>): VideoPreviewMeta {
  if (!meta) return {};
  const chapters = meta.chapters;
  const subtitles = meta.subtitles;
  return {
    ...meta,
    chapters: Array.isArray(chapters) ? (chapters as VideoChapter[]) : undefined,
    subtitles: Array.isArray(subtitles) ? (subtitles as VideoSubtitleTrack[]) : undefined,
  };
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
 * Get a human-readable label for a file category.
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    pdf: 'PDF Document',
    text: 'Text File',
    unknown: 'File',
  };
  return labels[category] || 'File';
}

// ==========================================
// Image Viewer — zoom, pan, rotate
// ==========================================

/**
 * ImageViewer — Full-featured image viewer with zoom, pan, and rotate.
 * Mouse wheel zoom, double-click toggle, drag to pan when zoomed.
 */
function ImageViewer({ blobUrl, name }: { blobUrl: string; name: string }) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => setZoom((p) => Math.min(p + 25, 400)), []);
  const handleZoomOut = useCallback(() => {
    setZoom((p) => {
      const next = Math.max(p - 25, 25);
      if (next <= 100) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);
  const handleFit = useCallback(() => {
    setZoom(100);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);
  const handleRotate = useCallback(() => setRotation((p) => (p + 90) % 360), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((p) => {
      const next = e.deltaY < 0 ? Math.min(p + 10, 400) : Math.max(p - 10, 25);
      if (next <= 100) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 100) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [zoom, position]
  );
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }
    },
    [isDragging, dragStart]
  );
  const handleMouseUp = useCallback(() => setIsDragging(false), []);
  const handleDoubleClick = useCallback(() => {
    if (zoom === 100) {
      setZoom(200);
    } else {
      setZoom(100);
      setPosition({ x: 0, y: 0 });
    }
  }, [zoom]);

  // Keyboard shortcuts for image viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-') handleZoomOut();
      else if (e.key === '0') handleFit();
      else if (e.key === 'r' || e.key === 'R') handleRotate();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleFit, handleRotate]);

  return (
    <div className="flex flex-col">
      {/* Image controls bar */}
      <div className="flex items-center justify-center gap-1 border-b border-muted px-3 py-1.5">
        <Tooltip content="Zoom out (−)" placement="bottom">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 25}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <PiMagnifyingGlassMinus className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>

        <span className="min-w-[3rem] text-center text-xs font-medium text-gray-500 dark:text-gray-400">
          {zoom}%
        </span>

        <Tooltip content="Zoom in (+)" placement="bottom">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 400}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <PiMagnifyingGlassPlus className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>

        <div className="mx-1 h-4 w-px bg-muted" />

        <Tooltip content="Rotate (R)" placement="bottom">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={handleRotate}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <PiArrowClockwise className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>

        <Tooltip content="Fit to screen (0)" placement="bottom">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={handleFit}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <PiArrowsOutSimple className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Image canvas */}
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden bg-gray-50 p-4 dark:bg-gray-200/20',
          zoom > 100 ? 'cursor-grab' : 'cursor-zoom-in',
          isDragging && 'cursor-grabbing'
        )}
        style={{ minHeight: '50vh', maxHeight: '70vh' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={name}
          className="max-h-full max-w-full select-none rounded transition-transform duration-150"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

// ==========================================
// Video Player Modal — Uses global VideoPlayer component
// ==========================================

/**
 * VideoPlayerModal — Wrapper around global VideoPlayer component.
 * Mirrors AudioPlayerModal pattern: supports bi-directional sync,
 * settings persistence, and advanced mode toggle.
 */
function VideoPlayerModal({
  blobUrl,
  initialCurrentTime,
  initialIsPlaying,
  initialShowAdvanced = false,
  onMediaStateChange,
  onPlaybackSync,
  onLivePlaybackSync,
  sharedVideoRef,
  mediaSessionId,
  initialVideoSettings,
  onVideoSettingsChange,
  chapters,
  subtitles,
  artifactId,
}: {
  blobUrl: string;
  initialCurrentTime?: number;
  initialIsPlaying?: boolean;
  initialShowAdvanced?: boolean;
  onMediaStateChange?: (currentTime: number, isPlaying: boolean) => void;
  onPlaybackSync?: (currentTime: number, isPlaying: boolean, showAdvanced?: boolean) => void;
  onLivePlaybackSync?: (currentTime: number, isPlaying: boolean, showAdvanced?: boolean) => void;
  sharedVideoRef?: RefObject<HTMLVideoElement | null>;
  mediaSessionId?: string;
  initialVideoSettings?: VideoPlayerSettings;
  onVideoSettingsChange?: (settings: VideoPlayerSettings) => void;
  chapters?: VideoChapter[];
  subtitles?: VideoSubtitleTrack[];
  artifactId?: string;
}) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(initialShowAdvanced);
  const usesMps = Boolean(mediaSessionId);
  const [bookmarks, setBookmarks] = useState<number[]>(() =>
    artifactId ? readVideoBookmarks(artifactId) : []
  );
  const controlsRef = useRef<VideoPlayerControls | null>(null);
  const showAdvancedRef = useRef(showAdvanced);
  showAdvancedRef.current = showAdvanced;

  const onChaptersLoad = useCallback(async () => {
    if (!artifactId) return [];
    return loadArtifactChapters(artifactId);
  }, [artifactId]);

  const onSubtitlesLoad = useCallback(async () => {
    if (!artifactId) return [];
    return loadArtifactSubtitles(artifactId);
  }, [artifactId]);

  const handleBookmark = useCallback(
    (timeSec: number) => {
      if (!artifactId) return;
      setBookmarks(addVideoBookmark(artifactId, timeSec));
    },
    [artifactId]
  );

  const handleToggleAdvanced = useCallback(() => {
    const time = controlsRef.current?.getCurrentTime() ?? sharedVideoRef?.current?.currentTime ?? 0;
    const playing = controlsRef.current?.isPlaying() ?? (sharedVideoRef?.current ? !sharedVideoRef.current.paused : false);
    setShowAdvanced((v) => {
      const next = !v;
      if (usesMps && mediaSessionId) {
        useMediaSessionStore.getState().setViewFlags(mediaSessionId, { showAdvanced: next });
      } else {
        onLivePlaybackSync?.(time, playing, next);
      }
      return next;
    });
  }, [sharedVideoRef, onLivePlaybackSync, usesMps, mediaSessionId]);

  // Cleanup sync — legacy non-MPS path only (MPS uses handleCloseModal before unmount).
  useEffect(() => {
    if (usesMps) return;
    const controls = controlsRef.current;
    const video = sharedVideoRef?.current ?? null;
    return () => {
      const time = controls?.getCurrentTime() ?? video?.currentTime ?? 0;
      const playing = controls?.isPlaying() ?? (video ? !video.paused : false);
      onPlaybackSync?.(time, playing, showAdvancedRef.current);
    };
  }, [onPlaybackSync, sharedVideoRef, usesMps]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <VideoPlayerGlobal
          src={blobUrl}
          variant={showAdvanced ? 'advanced' : 'expanded'}
          chromeMode="overlay"
          fullscreenLayout={showAdvanced ? 'pro' : 'cinema'}
          chapters={chapters}
          subtitles={subtitles}
          onChaptersLoad={!chapters?.length && artifactId ? onChaptersLoad : undefined}
          onSubtitlesLoad={!subtitles?.length && artifactId ? onSubtitlesLoad : undefined}
          showFilmstrip={showAdvanced}
          bookmarks={bookmarks}
          onBookmark={artifactId ? handleBookmark : undefined}
          mediaSessionId={mediaSessionId}
          initialCurrentTime={usesMps ? undefined : initialCurrentTime}
          initialIsPlaying={usesMps ? undefined : initialIsPlaying}
          volume={initialVideoSettings?.volume}
          playbackRate={initialVideoSettings?.playbackRate}
          isMuted={initialVideoSettings?.isMuted}
          onSettingsChange={onVideoSettingsChange}
          syncVideoRef={usesMps ? undefined : sharedVideoRef}
          controlsRef={controlsRef}
          onMediaStateChange={(ct: number, ip: boolean) => {
            onMediaStateChange?.(ct, ip);
            if (!usesMps) onLivePlaybackSync?.(ct, ip);
          }}
          onExpand={handleToggleAdvanced}
          enablePiP
          enableFullscreen
          onScreenshot={() => {
            void controlsRef.current?.takeScreenshot();
          }}
        />
        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={handleToggleAdvanced}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              showAdvanced
                ? 'bg-primary/10 text-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-200/30 dark:text-gray-300 dark:hover:bg-gray-300/40'
            )}
          >
            {showAdvanced
              ? t('videoPlayer.hideProMode', 'Hide pro mode')
              : t('videoPlayer.showProMode', 'Pro mode — timeline & chapters')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Audio Player Modal
// ==========================================

/**
 * AudioPlayerModal — Wrapper around the global AudioPlayer component.
 * Starts in "expanded" mode (no waveform), with a toggle button to show
 * waveform (switches to "full" variant). Supports bi-directional sync
 * with inline preview via initialCurrentTime / onMediaStateChange.
 */
function AudioPlayerModal({
  blobUrl,
  artifactId,
  name,
  mimeType,
  fileSize,
  initialCurrentTime,
  initialIsPlaying,
  initialShowWaveform = false,
  onMediaStateChange,
  onPlaybackSync,
  onLivePlaybackSync,
  sharedAudioRef,
  mediaSessionId,
  latestPlaybackRef,
}: {
  blobUrl: string;
  artifactId?: string;
  name: string;
  mimeType?: string | null;
  fileSize?: number | null;
  initialCurrentTime?: number;
  initialIsPlaying?: boolean;
  initialShowWaveform?: boolean;
  onMediaStateChange?: (currentTime: number, isPlaying: boolean) => void;
  onPlaybackSync?: (currentTime: number, isPlaying: boolean, showWaveform?: boolean) => void;
  onLivePlaybackSync?: (currentTime: number, isPlaying: boolean, showWaveform?: boolean) => void;
  sharedAudioRef?: RefObject<HTMLAudioElement | null>;
  mediaSessionId?: string;
  latestPlaybackRef?: React.MutableRefObject<{ currentTime: number; isPlaying: boolean }>;
}) {
  const [showWaveform, setShowWaveform] = useState(initialShowWaveform);
  const controlsRef = useRef<import('@/components/audio-player').AudioPlayerControls | null>(null);
  const showWaveformRef = useRef(showWaveform);
  showWaveformRef.current = showWaveform;
  const usesMps = Boolean(mediaSessionId);

  const handleToggleWaveform = useCallback(() => {
    const time =
      controlsRef.current?.getCurrentTime() ??
      sharedAudioRef?.current?.currentTime ??
      0;
    const playing =
      controlsRef.current?.isPlaying() ??
      (sharedAudioRef?.current ? !sharedAudioRef.current.paused : false);

    setShowWaveform((v) => {
      const next = !v;
      if (usesMps && mediaSessionId) {
        useMediaSessionStore.getState().setViewFlags(mediaSessionId, { showWaveform: next });
      } else {
        onLivePlaybackSync?.(time, playing, next);
      }
      return next;
    });
  }, [sharedAudioRef, onLivePlaybackSync, usesMps, mediaSessionId]);

  useEffect(() => {
    if (!usesMps) {
      const controls = controlsRef.current;
      const audio = sharedAudioRef?.current ?? null;
      const latestPlayback = latestPlaybackRef?.current;
      return () => {
        const time =
          controls?.getCurrentTime() ??
          latestPlayback?.currentTime ??
          audio?.currentTime ??
          0;
        const playing =
          controls?.isPlaying() ??
          latestPlayback?.isPlaying ??
          (audio ? !audio.paused : false);
        onPlaybackSync?.(time, playing, showWaveformRef.current);
      };
    }
  }, [onPlaybackSync, sharedAudioRef, latestPlaybackRef, usesMps]);

  useEffect(() => {
    if (!usesMps || !mediaSessionId) return;
    const wf = useMediaSessionStore.getState().getSession(mediaSessionId)?.view.showWaveform;
    if (wf !== undefined && wf !== showWaveform) setShowWaveform(wf);
  }, [usesMps, mediaSessionId, showWaveform]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <AudioPlayerGlobal
          artifactId={artifactId}
          src={artifactId ? undefined : blobUrl}
          variant="full"
          title={name}
          mimeType={mimeType || undefined}
          fileSize={fileSize || undefined}
          showWaveform={showWaveform}
          enableRegions={showWaveform}
          showTimeline={showWaveform}
          showZoom={showWaveform}
          showSkipEnds
          mediaSessionId={mediaSessionId}
          syncAudioRef={usesMps ? undefined : sharedAudioRef}
          initialCurrentTime={usesMps ? undefined : initialCurrentTime}
          initialIsPlaying={usesMps ? undefined : initialIsPlaying}
          controlsRef={controlsRef}
          onMediaStateChange={(ct, ip) => {
            onMediaStateChange?.(ct, ip);
            if (!usesMps) onLivePlaybackSync?.(ct, ip);
          }}
          onExpand={handleToggleWaveform}
        />
        <div className="mt-3 flex items-center justify-center">
          <button
            onClick={handleToggleWaveform}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              showWaveform
                ? 'bg-primary/10 text-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            <PiMusicNoteFill className="h-3.5 w-3.5" />
            {showWaveform ? 'Hide Waveform' : 'Show Waveform'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// PDF Viewer
// ==========================================

/**
 * PDFViewer — Embedded PDF viewer using browser's built-in renderer.
 */
function PDFViewer({ blobUrl, name }: { blobUrl: string; name: string }) {
  return (
    <div className="p-2">
      <iframe
        src={blobUrl}
        title={name}
        className="h-[70vh] w-full rounded border-0 bg-white"
      />
    </div>
  );
}

// ==========================================
// Text Viewer
// ==========================================

/**
 * MarkdownViewer — Renders .md files with full markdown styling using MarkdownRenderer.
 * Used when file is text/markdown or has .md/.markdown extension.
 */
function MarkdownViewer({
  textContent,
  name,
}: {
  textContent: string;
  name: string;
}) {
  return (
    <div className="flex flex-col">
      {/* File info bar */}
      <div className="flex items-center gap-2 border-b border-muted px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{name}</span>
        <span className="text-gray-300 dark:text-gray-600">&middot;</span>
        <span className="uppercase font-medium text-primary">MD</span>
      </div>
      {/* Rendered markdown */}
      <div className="max-h-[60vh] overflow-auto p-4">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <MarkdownRenderer content={textContent} className="font-vazirmatn" />
        </div>
      </div>
    </div>
  );
}

/**
 * TextViewer — Line-numbered text/code viewer with monospace font.
 */
function TextViewer({
  textContent,
  name,
  mimeType,
}: {
  textContent: string;
  name: string;
  mimeType?: string | null;
}) {
  const lines = textContent.split('\n');

  return (
    <div className="flex flex-col">
      {/* File info bar */}
      <div className="flex items-center gap-2 border-b border-muted px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{name}</span>
        <span className="text-gray-300 dark:text-gray-600">&middot;</span>
        <span>{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
        {mimeType && (
          <>
            <span className="text-gray-300 dark:text-gray-600">&middot;</span>
            <span className="uppercase">{mimeType.split('/').pop()}</span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[60vh] overflow-auto bg-gray-50 p-4 dark:bg-gray-200/20">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="leading-6 hover:bg-gray-100/70 dark:hover:bg-gray-200/10">
                <td className="select-none pr-4 text-right align-top font-mono text-xs text-gray-300 dark:text-gray-600">
                  {i + 1}
                </td>
                <td className="whitespace-pre font-mono text-sm text-gray-700 dark:text-gray-300">
                  {line || '\u00A0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// Unknown File Viewer
// ==========================================

/**
 * UnknownFileViewer — Info card with download button for unsupported types.
 */

// ==========================================
// Word Viewer (mammoth.js — DOCX/DOC/RTF to HTML)
// ==========================================

/**
 * WordViewer — Client-side DOCX/DOC to HTML converter using mammoth.js.
 *
 * mammoth.js converts .docx/.doc to HTML on the browser without any server
 * or CDN dependency. Preserves headings, bold, lists, tables, links.
 *
 * @param blobUrl - Blob URL of the Word document (already fetched with auth)
 * @param name - Display filename
 * @param onDownload - Download callback shown in toolbar
 */
function WordViewer({
  blobUrl,
  name,
  onDownload,
}: {
  blobUrl: string;
  name: string;
  onDownload: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(true);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const convertDocument = async () => {
      try {
        console.info('[WordViewer] Starting mammoth conversion:', { name });
        // Fetch blob object from the blob URL to get ArrayBuffer
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();

        const result = await mammoth.convertToHtml({ arrayBuffer });

        if (!cancelled) {
          console.info('[WordViewer] Conversion complete:', {
            name,
            warnings: result.messages.length,
          });
          setHtml(result.value);
          setWarnings(result.messages.map((m) => m.message));
          setIsConverting(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Conversion failed';
          console.error('[WordViewer] mammoth conversion failed:', { name, err });
          setConversionError(msg);
          setIsConverting(false);
        }
      }
    };

    convertDocument();
    return () => {
      cancelled = true;
    };
  }, [blobUrl, name]);

  // Converting state
  if (isConverting) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary dark:border-gray-500 dark:border-t-primary" />
        <span className="mt-3 text-sm text-gray-400 dark:text-gray-500">Converting document...</span>
      </div>
    );
  }

  // Conversion failed
  if (conversionError) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <PiWarningCircle className="mb-3 h-8 w-8 text-orange-400" />
        <Title as="h6" className="mb-1">
          Could not render document
        </Title>
        <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">{conversionError}</p>
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <PiDownloadSimple className="h-4 w-4" />
          Download {name}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-muted px-4 py-2">
        <div className="flex items-center gap-2">
          <PiFileDoc className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{name}</span>
          {warnings.length > 0 && (
            <Tooltip content={`${warnings.length} formatting warning(s) — some styles may differ`} placement="bottom">
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                ~{warnings.length} style issue{warnings.length > 1 ? 's' : ''}
              </span>
            </Tooltip>
          )}
        </div>
        <Tooltip content="Download original" placement="bottom">
          <ActionIcon
            variant="text"
            size="sm"
            onClick={onDownload}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500"
          >
            <PiDownloadSimple className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Rendered HTML */}
      <div className="max-h-[65vh] overflow-auto bg-white/90 px-8 py-6 dark:bg-gray-200/10">
        {/* WHY: Scoped word-doc class styles the mammoth HTML output inline since
         *  @tailwindcss/typography is not installed in this project. */}
        <style>{`
          .word-doc h1 { font-size:1.5rem; font-weight:700; margin:1rem 0 .5rem; }
          .word-doc h2 { font-size:1.25rem; font-weight:600; margin:.875rem 0 .4rem; }
          .word-doc h3 { font-size:1.1rem; font-weight:600; margin:.75rem 0 .35rem; }
          .word-doc p  { margin:.5rem 0; line-height:1.7; font-size:.9rem; }
          .word-doc ul, .word-doc ol { margin:.5rem 0 .5rem 1.5rem; }
          .word-doc li { margin:.25rem 0; font-size:.9rem; line-height:1.7; }
          .word-doc strong, .word-doc b { font-weight:600; }
          .word-doc em, .word-doc i { font-style:italic; }
          .word-doc a { color:#6366f1; text-decoration:underline; }
          .word-doc table { width:100%; border-collapse:collapse; margin:1rem 0; font-size:.875rem; }
          .word-doc th, .word-doc td { border:1px solid #e5e7eb; padding:.5rem .75rem; text-align:left; }
          .word-doc th { background:#f9fafb; font-weight:600; }
          .dark .word-doc th { background:rgba(255,255,255,.05); }
          .dark .word-doc th, .dark .word-doc td { border-color:rgba(255,255,255,.1); }
          .dark .word-doc p, .dark .word-doc li, .dark .word-doc td { color:#d1d5db; }
          .dark .word-doc h1, .dark .word-doc h2, .dark .word-doc h3 { color:#f3f4f6; }
          .dark .word-doc a { color:#818cf8; }
        `}</style>
        <div
          className="word-doc text-gray-800 dark:text-gray-200"
          // WHY: mammoth output is sanitised HTML from the docx — safe to dangerouslySetInnerHTML.
          // mammoth does NOT include <script> or event handlers in its output.
          dangerouslySetInnerHTML={{ __html: html! }}
        />
      </div>
    </div>
  );
}

// ==========================================
// Document Viewer (Word → WordViewer, Excel/PPT → Download Card)
// ==========================================

/**
 * DocumentViewer — Routes to appropriate viewer based on document type.
 * - Word/DOC/DOCX/RTF: rendered via WordViewer (mammoth.js)
 * - Excel/PowerPoint: shows a professional download card
 */
function DocumentViewer({
  name,
  mimeType,
  fileSize,
  onDownload,
  blobUrl,
}: {
  name: string;
  mimeType?: string | null;
  fileSize?: number | null;
  onDownload: () => void;
  /** Blob URL of the document — enables Word rendering via mammoth */
  blobUrl?: string | null;
}) {
  // WHY: Backend may return missing or application/octet-stream MIME type,
  // so we also check by file extension to detect Word documents.
  const ext = name?.split('.').pop()?.toLowerCase();
  const isWord = (mimeType &&
    (mimeType.toLowerCase().includes('word') ||
     mimeType.toLowerCase().includes('wordprocessing') ||
     mimeType.toLowerCase() === 'application/rtf')) ||
    ext === 'doc' || ext === 'docx' || ext === 'rtf';

  // Word files: use mammoth for rich HTML rendering
  if (isWord && blobUrl) {
    return <WordViewer blobUrl={blobUrl} name={name} onDownload={onDownload} />;
  }

  /** Get color-coded icon for the document type */
  const getDocIcon = (): React.ReactNode => {
    if (!mimeType) return <PiFileBold className="h-10 w-10 text-gray-400" />;
    const t = mimeType.toLowerCase();
    if (t.includes('word') || t.includes('wordprocessing') || t === 'application/rtf') {
      return <PiFileDoc className="h-10 w-10 text-blue-500" />;
    }
    if (t.includes('excel') || t.includes('spreadsheet')) {
      return <PiFileXls className="h-10 w-10 text-green-600" />;
    }
    if (t.includes('powerpoint') || t.includes('presentation')) {
      return <PiFilePpt className="h-10 w-10 text-orange-500" />;
    }
    return <PiFileBold className="h-10 w-10 text-gray-400" />;
  };

  /** Get readable type label */
  const getTypeLabel = (): string => {
    if (!mimeType) return 'Document';
    const t = mimeType.toLowerCase();
    if (t.includes('word') || t.includes('wordprocessing')) return 'Microsoft Word Document';
    if (t === 'application/rtf') return 'Rich Text Document';
    if (t.includes('excel') || t.includes('spreadsheet')) return 'Microsoft Excel Spreadsheet';
    if (t.includes('powerpoint') || t.includes('presentation')) return 'Microsoft PowerPoint';
    return 'Document';
  };

  return (
    <div className="flex items-center justify-center px-6 py-16">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20">
          {getDocIcon()}
        </div>
        <Title as="h5" className="mb-1">
          {name}
        </Title>
        <p className="mb-2 text-sm text-gray-400 dark:text-gray-500">{getTypeLabel()}</p>
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          {fileSize && (
            <span className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-200/30">{formatFileSize(fileSize)}</span>
          )}
        </div>
        <p className="mb-6 text-sm text-gray-400 dark:text-gray-500">
          This document type needs to be downloaded and opened in a compatible application.
        </p>
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PiDownloadSimple className="h-4 w-4" />
          Download &amp; Open
        </button>
      </div>
    </div>
  );
}

function UnknownFileViewer({
  name,
  mimeType,
  fileSize,
  onDownload,
}: {
  name: string;
  mimeType?: string | null;
  fileSize?: number | null;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center justify-center px-4 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-200/30">
          {getFileIcon(mimeType, 'h-8 w-8')}
        </div>
        <Title as="h5" className="mb-2">
          {name}
        </Title>
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          {mimeType && (
            <span className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-200/30">{mimeType}</span>
          )}
          {fileSize && (
            <span className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-200/30">{formatFileSize(fileSize)}</span>
          )}
        </div>
        <p className="mb-6 text-sm text-gray-400 dark:text-gray-500">
          Preview is not available for this file type.
        </p>
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PiDownloadSimple className="h-4 w-4" />
          Download File
        </button>
      </div>
    </div>
  );
}

// ==========================================
// Main Modal View Component
// ==========================================

/**
 * FilePreviewModalView — Full-featured file viewer for template's useModal() system.
 *
 * Designed to be passed as `view` to `openModal()` from `useModal()`.
 * Uses RizzUI components (ActionIcon, Tooltip, Title) for theme consistency.
 * All content is rendered inside the template's `<Modal>` container which provides
 * proper overlay, dark mode, close-on-outside-click, and responsive sizing.
 *
 * Accepts optional `initialBlobUrl` and `initialTextContent` to skip re-fetching
 * when expanding from FilePreviewInline.
 *
 * Viewers:
 * - **Image**: Zoom, pan, rotate, fit, mouse wheel, double-click toggle
 * - **Video**: HTML5 player with native controls, Space to toggle play
 * - **Audio**: Custom player with progress, volume, play/pause
 * - **PDF**: Browser embedded viewer via iframe
 * - **Text/Code**: Line-numbered viewer with monospace font
 * - **Unknown**: File info card with download button
 *
 * @requires useModal — for self-closing via closeModal()
 * @requires chatService — for authenticated download
 *
 * @example
 * ```tsx
 * const { openModal } = useModal();
 * openModal({
 *   view: <FilePreviewModalView src={url} name="file.pdf" mimeType="application/pdf" />,
 *   customSize: '900px',
 * });
 * ```
 */
export default function FilePreviewModalView({
  src,
  name,
  mimeType,
  fileSize,
  localPreviewUrl,
  initialBlobUrl,
  initialTextContent,
  initialCurrentTime,
  initialIsPlaying,
  onPlaybackSync,
  onLivePlaybackSync,
  sharedAudioRef,
  mediaSessionId,
  sharedVideoRef,
  initialShowWaveform,
  initialShowAdvanced,
  initialVideoSettings,
  onVideoSettingsChange,
  artifactId,
  meta,
}: FilePreviewModalViewProps) {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const mpsHandoffDoneRef = useRef(false);
  const category = getFileCategory(mimeType, name);
  const ext = getExtension(name);
  const resolvedArtifactId = artifactId ?? extractArtifactIdFromGatewaySrc(src);
  const audioPlaybackArtifactId = localPreviewUrl ? undefined : resolvedArtifactId;
  const previewMeta = videoPreviewMetaFromRecord(meta);

  const [blobUrl, setBlobUrl] = useState<string | null>(initialBlobUrl ?? localPreviewUrl ?? null);
  const [textContent, setTextContent] = useState<string | null>(initialTextContent ?? null);
  const [isLoading, setIsLoading] = useState(!(initialBlobUrl || localPreviewUrl || initialTextContent));
  const [error, setError] = useState<string | null>(null);

  // Track latest media playback state for reverse sync (modal → inline)
  const mediaStateRef = useRef<{ currentTime: number; isPlaying: boolean }>({
    currentTime: initialCurrentTime ?? 0,
    isPlaying: initialIsPlaying ?? false,
  });

  /** Called by modal audio on every timeupdate/play/pause (HTML + WaveSurfer) */
  const handleMediaStateChange = useCallback(
    (ct: number, ip: boolean) => {
      mediaStateRef.current = { currentTime: ct, isPlaying: ip };
    },
    []
  );

  const handleCloseModal = useCallback(() => {
    if (mediaSessionId && !mpsHandoffDoneRef.current) {
      mpsHandoffDoneRef.current = true;
      mediaSessionController.closeModalWithHandoff(mediaSessionId, onPlaybackSync);
    }
    closeModal();
  }, [mediaSessionId, onPlaybackSync, closeModal]);

  /** Escape / overlay click — container unmounts without header Close. */
  useEffect(() => {
    return () => {
      if (mediaSessionId && !mpsHandoffDoneRef.current) {
        mpsHandoffDoneRef.current = true;
        mediaSessionController.closeModalWithHandoff(mediaSessionId, onPlaybackSync);
      }
    };
  }, [mediaSessionId, onPlaybackSync]);

  // Fetch file content if no initial data was provided
  useEffect(() => {
    // Skip fetch if we already have data from inline preview or local upload
    if (initialBlobUrl || initialTextContent) {
      // For text with local preview URL but no text content, read it
      if (category === 'text' && !initialTextContent && localPreviewUrl) {
        fetch(localPreviewUrl)
          .then((r) => r.text())
          .then(setTextContent)
          .catch(() => setError('Failed to read text content'));
      }
      setIsLoading(false);
      return;
    }

    if (localPreviewUrl) {
      if (category === 'text') {
        fetch(localPreviewUrl)
          .then((r) => r.text())
          .then((text) => {
            setTextContent(text);
            setIsLoading(false);
          })
          .catch(() => {
            setError('Failed to read text content');
            setIsLoading(false);
          });
      } else {
        setBlobUrl(localPreviewUrl);
        setIsLoading(false);
      }
      return;
    }

    let cancelled = false;
    let revokePlaybackUrl: (() => void) | undefined;
    const fetchContent = async () => {
      setIsLoading(true);
      try {
        // For video/audio: resolve a browser-playable URL (presigned with blob fallback).
        if ((category === 'video' || category === 'audio') && resolvedArtifactId) {
          debugLog.preview('FilePreviewModal resolving playback URL', {
            artifactId: resolvedArtifactId,
            category,
          });
          try {
            const strategy = getPlaybackStrategy(mimeType, name, fileSize ?? undefined);
            const resolved = await resolveStoragePlaybackUrl(resolvedArtifactId, strategy);
            if (!cancelled) {
              setBlobUrl(resolved.url);
              if (resolved.revokeOnCleanup) {
                revokePlaybackUrl = () => URL.revokeObjectURL(resolved.url);
              }
              setIsLoading(false);
              debugLog.preview('FilePreviewModal playback URL ready', { category, name });
            } else if (resolved.revokeOnCleanup) {
              URL.revokeObjectURL(resolved.url);
            }
            return;
          } catch (playbackErr: unknown) {
            console.warn('[FilePreviewModal] Playback URL resolution failed, falling back to fetch:', playbackErr);
          }
        }

        debugLog.preview('FilePreviewModal fetching file', { src, category });
        const authHeaders = await chatService.getAuthHeaders();
        const response = await fetch(src, { headers: authHeaders });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        if (category === 'text') {
          const text = await response.text();
          if (!cancelled) {
            setTextContent(text);
            setIsLoading(false);
          }
        } else {
          const blob = await response.blob();
          if (!cancelled) {
            setBlobUrl(URL.createObjectURL(blob));
            setIsLoading(false);
          }
        }
        debugLog.preview('FilePreviewModal file loaded', { category, name });
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load file');
          setIsLoading(false);
          console.error('[FilePreviewModal] Load failed:', { src, error: err });
        }
      }
    };
    fetchContent();
    return () => {
      cancelled = true;
      revokePlaybackUrl?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, localPreviewUrl, initialBlobUrl, initialTextContent, category, name, resolvedArtifactId]);

  const handleDownload = useCallback(async () => {
    debugLog.preview('FilePreviewModal downloading', { name });
    try {
      await chatService.downloadFile(src, name || 'download');
    } catch (err: unknown) {
      console.error('[FilePreviewModal] Download failed:', err);
    }
  }, [src, name]);

  return (
    <div className="flex flex-col overflow-hidden">
      {/* ── Modal Header ── */}
      <div className="flex items-center gap-3 border-b border-muted px-5 py-3.5">
        {/* File icon */}
        <span className="flex-shrink-0">
          {getFileIcon(mimeType, 'h-5 w-5')}
        </span>

        {/* File info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Title as="h6" className="truncate">
              {name || 'File Preview'}
            </Title>
            <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500 dark:bg-gray-200/30 dark:text-gray-400">
              {ext || getCategoryLabel(category)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span>{getCategoryLabel(category)}</span>
            {fileSize && (
              <>
                <span>&middot;</span>
                <span>{formatFileSize(fileSize)}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-1">
          <Tooltip content="Download" placement="bottom">
            <ActionIcon
              variant="text"
              size="md"
              onClick={handleDownload}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <PiDownloadSimple className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>

          <Tooltip content="Close" placement="bottom">
            <ActionIcon
              variant="text"
              size="md"
              aria-label="Close"
              onClick={handleCloseModal}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <PiX className="h-5 w-5" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* ── Content area ── */}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary dark:border-gray-500 dark:border-t-primary" />
            <span className="text-sm text-gray-400 dark:text-gray-500">
              Loading {getCategoryLabel(category).toLowerCase()}...
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <PiWarningCircle className="mb-3 h-8 w-8 text-red-400" />
          <Title as="h6" className="mb-2">
            Unable to Load Preview
          </Title>
          <p className="mb-4 text-sm text-gray-400 dark:text-gray-500">{error}</p>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <PiDownloadSimple className="h-4 w-4" />
            Download Instead
          </button>
        </div>
      )}

      {/* Loaded content — per-category viewers */}
      {!isLoading && !error && (
        <>
          {category === 'image' && blobUrl && <ImageViewer blobUrl={blobUrl} name={name || 'image'} />}
          {category === 'video' && blobUrl && (
            <VideoPlayerModal
              blobUrl={blobUrl}
              initialShowAdvanced={initialShowAdvanced}
              onMediaStateChange={handleMediaStateChange}
              onPlaybackSync={onPlaybackSync}
              mediaSessionId={mediaSessionId}
              sharedVideoRef={mediaSessionId ? undefined : sharedVideoRef}
              initialVideoSettings={initialVideoSettings}
              onVideoSettingsChange={onVideoSettingsChange}
              artifactId={resolvedArtifactId}
              chapters={previewMeta.chapters}
              subtitles={previewMeta.subtitles}
            />
          )}
          {category === 'audio' && (blobUrl || resolvedArtifactId) && (
            <AudioPlayerModal
              blobUrl={blobUrl ?? ''}
              artifactId={audioPlaybackArtifactId}
              name={name || 'audio'}
              mimeType={mimeType}
              fileSize={fileSize}
              initialCurrentTime={initialCurrentTime}
              initialIsPlaying={initialIsPlaying}
              initialShowWaveform={initialShowWaveform}
              onMediaStateChange={handleMediaStateChange}
              onPlaybackSync={onPlaybackSync}
              onLivePlaybackSync={onLivePlaybackSync}
              mediaSessionId={mediaSessionId}
              sharedAudioRef={mediaSessionId ? undefined : sharedAudioRef}
              latestPlaybackRef={mediaStateRef}
            />
          )}
          {category === 'pdf' && blobUrl && <PDFViewer blobUrl={blobUrl} name={name || 'document.pdf'} />}
          {category === 'text' && textContent !== null && (() => {
            const extLo = ext.toLowerCase();
            const isMarkdown =
              mimeType === 'text/markdown' ||
              extLo === 'md' ||
              extLo === 'markdown' ||
              extLo === 'mdx';
            return isMarkdown ? (
              <MarkdownViewer textContent={textContent} name={name || 'text'} />
            ) : (
              <TextViewer textContent={textContent} name={name || 'text'} mimeType={mimeType} />
            );
          })()}
          {category === 'document' && (
            <DocumentViewer
              name={name || 'document'}
              mimeType={mimeType}
              fileSize={fileSize}
              onDownload={handleDownload}
              blobUrl={blobUrl}
            />
          )}
          {category === 'unknown' && (
            <UnknownFileViewer
              name={name || 'file'}
              mimeType={mimeType}
              fileSize={fileSize}
              onDownload={handleDownload}
            />
          )}
        </>
      )}
    </div>
  );
}
