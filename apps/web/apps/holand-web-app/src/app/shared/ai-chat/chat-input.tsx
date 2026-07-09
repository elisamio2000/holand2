// ============================================
// ChatInput — Message input with file upload, voice, and controls
// ChatGPT-like design: + button popover, clean pill, send button
// ============================================

'use client';
/* eslint-disable @next/next/no-img-element -- attachment preview chips use object URLs */

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiPaperPlaneRightFill,
  PiStopFill,
  PiPaperclip,
  PiX,
  PiMicrophone,
  PiMicrophoneSlash,
  PiToolbox,
  PiPlus,
  PiWarningCircle,
} from 'react-icons/pi';
import { Popover } from 'rizzui';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import ToolsPanel from './tools-panel';
import { isImageMimeType } from '@/utils/file-icons';
import FileTypeIcon from '@/components/file-type-icon';
import {
  validateFiles,
  formatFileSize,
  MAX_FILES_PER_UPLOAD,
} from '@/config/file-upload.config';
import type { FileUploadProgress } from '@/types/chat.types';
import type { ChatApiEndpointStatus } from '@/hooks/use-chat-api-health';

interface ChatInputProps {
  /** Send message callback */
  onSend: (content: string, attachments?: File[]) => void;
  /** Whether AI is currently streaming */
  isStreaming: boolean;
  /** Whether session messages are loading from API */
  isLoadingMessages?: boolean;
  /** Stop streaming callback */
  onStop: () => void;
  /** Whether input should be disabled */
  disabled?: boolean;
  /** Per-file upload progress (from useChat) */
  uploadProgress?: FileUploadProgress[];
  /** Whether files are currently uploading */
  isUploading?: boolean;
  /** Cancel active upload callback */
  onCancelUpload?: () => void;
  /** Probed tools API availability */
  toolsApiStatus?: ChatApiEndpointStatus;
  /** Opens dev requirements panel (dev only) */
  onOpenDevPanel?: () => void;
  /** Max width for content column (synced with messages area) */
  contentMaxWidth?: string;
}

export type ChatInputHandle = {
  prependQuote: (text: string) => void;
  focus: () => void;
};

/**
 * ChatInput — Message composition area with rich controls.
 *
 * Features:
 * - Auto-expanding textarea (up to 200px)
 * - Send on Enter (Shift+Enter for new line)
 * - File attachment support (drag & drop + click)
 * - Voice input via Web Speech API (SpeechRecognition)
 * - Stop button during streaming
 * - Disclaimer text for AI limitations
 * - Minimal, borderless design (ChatGPT-style)
 *
 * @example
 * ```tsx
 * <ChatInput
 *   onSend={sendMessage}
 *   isStreaming={isStreaming}
 *   onStop={stopStreaming}
 * />
 * ```
 */

// File icon utility is imported from @/utils/file-icons
// Shared document-style SVG icons for consistent design

/**
 * Check if Web Speech API (SpeechRecognition) is available in the browser.
 * Returns the SpeechRecognition constructor or null if unsupported.
 */
function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  // Standard API or webkit-prefixed (Chrome, Edge, Safari)
  return (
    (window as unknown as Record<string, unknown>).SpeechRecognition as typeof SpeechRecognition ??
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition as typeof SpeechRecognition ??
    null
  );
}

export default forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  {
    onSend,
    isStreaming,
    isLoadingMessages = false,
    onStop,
    disabled = false,
    uploadProgress = [],
    isUploading = false,
    onCancelUpload,
    toolsApiStatus = 'unknown',
    onOpenDevPanel,
    contentMaxWidth,
  },
  ref
) {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Stable blob URL cache for image previews — avoids recreating on every render
  const previewUrlsRef = useRef<Map<File, string>>(new Map());

  /**
   * Get a stable blob URL for a File object.
   * Reuses cached URL if the same File reference is requested again.
   * This prevents memory leaks from calling URL.createObjectURL on every render.
   */
  const getPreviewUrl = useCallback((file: File): string => {
    const existing = previewUrlsRef.current.get(file);
    if (existing) return existing;
    const url = URL.createObjectURL(file);
    previewUrlsRef.current.set(file, url);
    return url;
  }, []);

  // Cleanup blob URLs when attachments change or component unmounts
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // Check for Web Speech API support on mount
  useEffect(() => {
    const SpeechRecognitionAPI = getSpeechRecognition();
    setSpeechSupported(!!SpeechRecognitionAPI);
  }, []);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      prependQuote: (text: string) => {
        setContent((prev) => (prev.trim() ? `${text}${prev}` : text));
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          adjustHeight();
        });
      },
      focus: () => textareaRef.current?.focus(),
    }),
    [adjustHeight]
  );

  const handleSend = useCallback(() => {
    if (
      isStreaming ||
      isLoadingMessages ||
      isUploading ||
      (!content.trim() && attachments.length === 0)
    )
      return;

    console.info('[ChatInput] Sending message:', {
      contentLength: content.length,
      attachments: attachments.length,
    });

    onSend(content, attachments.length > 0 ? attachments : undefined);
    setContent('');
    // Revoke all blob URLs before clearing attachments
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, attachments, isStreaming, isLoadingMessages, isUploading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /**
   * Process and validate files before adding to attachments.
   * Runs validation from file-upload.config.ts and shows toasts for rejected files.
   */
  const processFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const result = validateFiles(files, attachments.length);

      // Show toast for each rejected file
      if (result.rejected.length > 0) {
        console.warn('[ChatInput] Files rejected:', {
          count: result.rejected.length,
          reasons: result.rejected.map((r) => r.reason),
        });
        // Show first rejection reason as toast (avoid spam)
        toast.error(result.rejected[0].reason);
        if (result.rejected.length > 1) {
          toast.error(
            t('chatPage.toasts.filesRejectedMore', { count: result.rejected.length - 1 })
          );
        }
      }

      if (result.valid.length > 0) {
        setAttachments((prev) => [...prev, ...result.valid]);
        console.info('[ChatInput] Files attached:', {
          count: result.valid.length,
          names: result.valid.map((f) => f.name),
          sizes: result.valid.map((f) => f.size),
        });
      }
    },
    [attachments.length]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      processFiles(files);
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [processFiles]
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      // Revoke blob URL for the removed file
      const removed = prev[index];
      if (removed) {
        const url = previewUrlsRef.current.get(removed);
        if (url) {
          URL.revokeObjectURL(url);
          previewUrlsRef.current.delete(removed);
        }
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ==========================================
  // Voice Input — Web Speech API
  // ==========================================

  /**
   * Toggle voice recognition on/off.
   * Uses Web Speech API (SpeechRecognition) for browser-native STT.
   * Appends recognized text to the current textarea content.
   */
  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      // Stop listening
      console.info('[ChatInput] Stopping voice input');
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI) {
      console.warn('[ChatInput] Speech recognition not supported in this browser');
      return;
    }

    console.info('[ChatInput] Starting voice input...');
    const recognition = new SpeechRecognitionAPI();
    const lang = i18n.language?.startsWith('fa')
      ? 'fa-IR'
      : i18n.language?.startsWith('en')
        ? 'en-US'
        : i18n.language || 'fa-IR';
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';
    let appliedFinal = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript = transcript;
        }
      }
      const newFinal = finalTranscript.slice(appliedFinal.length);
      setContent((prev) => {
        const base = prev.endsWith(' ') || prev.length === 0 ? prev : prev + ' ';
        return base + newFinal + interimTranscript;
      });
      if (newFinal) appliedFinal = finalTranscript;
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[ChatInput] Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast.error(t('chatInput.voiceNotAllowed'));
      } else if (event.error === 'no-speech') {
        toast.error(t('chatInput.voiceNoSpeech'));
      } else if (event.error === 'network') {
        toast.error(t('chatInput.voiceNetwork'));
      }
    };

    recognition.onend = () => {
      console.info('[ChatInput] Voice input ended');
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, i18n.language, t]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return (
    <div className="relative bg-transparent px-4 pb-3 pt-2 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        className="mx-auto w-full"
        style={contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined}
      >
        {!speechSupported && !disabled && (
          <p className="mb-2 text-center text-[11px] text-gray-400">
            {t('chatInput.voiceUnsupported')}
          </p>
        )}

        {/* Attachments preview — above the input pill */}
        {(attachments.length > 0 || uploadProgress.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {(isUploading ? uploadProgress : attachments.map((file) => ({ file, status: 'pending' as const, progress: 0 }))).map((item, idx) => {
              const file = item.file;
              const status = isUploading ? item.status : 'pending';
              const progress = isUploading ? item.progress : 0;
              const isFailed = status === 'failed';
              const isSuccess = status === 'success';
              const isActiveUpload = status === 'uploading';

              return (
                <div
                  key={idx}
                  className={cn(
                    'group/att relative flex items-center gap-2 rounded-lg border bg-gray-0 px-2.5 py-1.5 text-xs shadow-sm transition-all dark:bg-gray-50',
                    isFailed
                      ? 'border-red-300 dark:border-red-800'
                      : isSuccess
                        ? 'border-green-300 dark:border-green-800'
                        : isActiveUpload
                          ? 'border-primary/40'
                          : 'border-muted hover:border-primary/20'
                  )}
                >
                  {/* Thumbnail or icon */}
                  {isImageMimeType(file.type) ? (
                    <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded">
                      <img
                        src={getPreviewUrl(file)}
                        alt={file.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <FileTypeIcon mimeType={file.type} filename={file.name} size="sm" />
                  )}

                  {/* File info */}
                  <div className="min-w-0">
                    <span className="block max-w-[140px] truncate font-medium text-gray-700 dark:text-gray-300">
                      {file.name}
                    </span>
                    <span className="text-gray-400">
                      {isFailed ? (
                        <span className="text-red-500">Upload failed</span>
                      ) : isSuccess ? (
                        <span className="text-green-600 dark:text-green-400">Uploaded</span>
                      ) : isActiveUpload ? (
                        <span className="text-primary">{progress}%</span>
                      ) : (
                        formatFileSize(file.size)
                      )}
                    </span>
                  </div>

                  {/* Remove button — top-right corner badge, visible on hover or always on touch */}
                  {!isUploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachment(idx);
                      }}
                      className="absolute -end-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-gray-500 text-white opacity-0 shadow-sm transition-all hover:bg-red-500 group-hover/att:opacity-100 dark:bg-gray-400 dark:hover:bg-red-500"
                      aria-label={`Remove ${file.name}`}
                    >
                      <PiX className="h-2.5 w-2.5" />
                    </button>
                  )}

                  {/* Status indicator for upload */}
                  {isUploading && isSuccess && (
                    <div className="ms-0.5 rounded-full p-0.5 text-green-500">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                      </svg>
                    </div>
                  )}
                  {isUploading && isFailed && (
                    <div className="ms-0.5 rounded-full p-0.5 text-red-500">
                      <PiWarningCircle className="h-3.5 w-3.5" />
                    </div>
                  )}

                  {/* Progress bar — bottom edge of the pill */}
                  {isActiveUpload && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-lg bg-gray-200 dark:bg-gray-300">
                      <div
                        className="h-full rounded-b-lg bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                  {/* Completed progress bar — green fill */}
                  {isSuccess && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-lg">
                      <div className="h-full w-full rounded-b-lg bg-green-500" />
                    </div>
                  )}
                  {/* Failed progress bar — red fill */}
                  {isFailed && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-lg">
                      <div className="h-full w-full rounded-b-lg bg-red-500" />
                    </div>
                  )}
                </div>
              );
            })}
            {/* File count indicator */}
            {attachments.length > 1 && !isUploading && (
              <span className="self-center text-xs text-gray-400">
                {attachments.length}/{MAX_FILES_PER_UPLOAD} files
              </span>
            )}
            {/* Upload summary + cancel button during upload */}
            {isUploading && (
              <div className="flex items-center gap-2 self-center">
                <span className="text-xs text-primary">
                  {uploadProgress.filter((p) => p.status === 'success').length}/{uploadProgress.length} uploaded
                </span>
                {onCancelUpload && (
                  <button
                    onClick={onCancelUpload}
                    className="flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40"
                    aria-label="Cancel upload"
                  >
                    <PiX className="h-3 w-3" />
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tools capabilities panel — positioned above input */}
        <ToolsPanel
          isOpen={showToolsPanel}
          onClose={() => setShowToolsPanel(false)}
          toolsApiStatus={toolsApiStatus}
          onOpenDevPanel={onOpenDevPanel}
        />

        {/* Input area — ChatGPT-style rounded pill */}
        <div
          className={cn(
            'relative overflow-hidden rounded-3xl bg-gray-100 transition-all dark:bg-gray-200/20',
            isDragging && 'ring-2 ring-primary/30'
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary/50 bg-primary/[0.08] px-4 dark:bg-primary/[0.12]"
              aria-live="polite"
            >
              <p className="text-center text-sm font-medium text-primary">
                {t('chatInput.dropFiles')}
              </p>
            </div>
          )}

          <div
            className={cn(
              'relative flex items-end gap-1 px-2 py-1.5 transition-opacity',
              isDragging && 'opacity-40'
            )}
          >
          {/* + Button — opens popover with attach/tools options */}
          <Popover shadow="sm" placement="top-start">
            <Popover.Trigger>
              <button
                className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200/70 text-gray-500 transition-colors hover:bg-gray-300/70 hover:text-gray-700 dark:bg-gray-200/40 dark:text-gray-400 dark:hover:bg-gray-200/60 dark:hover:text-gray-300"
                aria-label="More options"
                disabled={disabled}
              >
                <PiPlus className="h-4 w-4" />
              </button>
            </Popover.Trigger>
            <Popover.Content className="z-[9999] w-48 p-1 dark:bg-gray-100 [&>svg]:hidden">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isUploading
                    ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20'
                )}
              >
                <PiPaperclip className="h-4 w-4" />
                {isUploading ? t('chatInput.uploading') : t('chatInput.uploadFile')}
              </button>
              <button
                onClick={() => setShowToolsPanel(!showToolsPanel)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/20"
              >
                <PiToolbox className="h-4 w-4" />
                {t('chatInput.toolsCapabilities')}
              </button>
            </Popover.Content>
          </Popover>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Textarea — clean, no scrollbar */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('chatInput.placeholder')}
            disabled={disabled || isStreaming || isLoadingMessages}
            rows={1}
            className="custom-scrollbar-none max-h-[200px] min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm leading-relaxed text-gray-900 shadow-none outline-none ring-0 placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 dark:text-gray-700 dark:placeholder:text-gray-500"
            dir="auto"
          />

          {/* Right side controls */}
          <div className="mb-0.5 flex items-center gap-0.5">
            {/* Voice input button — only rendered if Web Speech API is available */}
            {speechSupported && (
              <Tooltip content={isListening ? t('chatInput.stopRecording') : t('chatInput.voiceInput')} placement="top">
                <button
                  onClick={toggleVoiceInput}
                  disabled={disabled || isStreaming || isLoadingMessages}
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                    isListening
                      ? 'animate-pulse bg-red-100 text-red-500 hover:bg-red-200 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40'
                      : 'text-gray-400 hover:bg-gray-200/50 hover:text-gray-600 dark:hover:bg-gray-200/40'
                  )}
                  aria-label={isListening ? t('chatInput.stopRecording') : t('chatInput.voiceInput')}
                >
                  {isListening ? (
                    <PiMicrophoneSlash className="h-4 w-4" />
                  ) : (
                    <PiMicrophone className="h-4 w-4" />
                  )}
                </button>
              </Tooltip>
            )}

            {/* Send / Stop button */}
            {isStreaming ? (
              <Tooltip content={t('chatInput.stopGenerating')} placement="top">
                <button
                  onClick={onStop}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                  aria-label={t('chatInput.stopGenerating')}
                >
                  <PiStopFill className="h-4 w-4" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip content={t('chatInput.sendMessage')} placement="top">
                <button
                  onClick={handleSend}
                  disabled={
                    disabled || isUploading || (!content.trim() && attachments.length === 0)
                  }
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                    content.trim() || attachments.length > 0
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-gray-200 text-gray-400 dark:bg-gray-200/40 dark:text-gray-500'
                  )}
                  aria-label={t('chatInput.sendMessage')}
                >
                  {/* rtl:scale-x-[-1] mirrors the arrow to point left in RTL languages */}
                  <PiPaperPlaneRightFill className="h-4 w-4 rtl:scale-x-[-1]" />
                </button>
              </Tooltip>
            )}
          </div>
          </div>
        </div>

        {/* Disclaimer text */}
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
          {t('chatInput.disclaimer')}
        </p>
      </div>
    </div>
  );
});
