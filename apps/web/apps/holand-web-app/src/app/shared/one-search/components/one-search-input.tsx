'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiMagnifyingGlassBold,
  PiMicrophoneBold,
  PiXBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import {
  imageFileFromDataTransfer,
  omniboxPillClassName,
  omniboxTextareaClassName,
} from '@/app/shared/chat-omnibox/omnibox-primitives';
import { Button, Text } from 'rizzui';
import { useVoiceSearch } from '@/hooks/use-voice-search';
import { VisualSearchCameraButton } from './visual-search-camera-button';
import { VisualSearchChip, VisualSearchArtifactChip } from './visual-search-chip';

export interface OneSearchInputProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  variant?: 'landing' | 'compact';
  onImageUpload?: (file: File) => void;
  imageUploading?: boolean;
  visualArtifact?: VisualSearchArtifactChip | null;
  onClearVisual?: () => void;
  /** Clears input and syncs URL (drops q= when on results page). */
  onClearQuery?: () => void;
  /** When set, microphone uses STT → callback with transcript */
  onVoiceQuery?: (transcript: string) => void;
  voiceSearchEnabled?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * One Search omnibox — ChatGPT-style pill (mirrors ai-chat/chat-input.tsx)
 * with search-specific affordances (Lens, mode tabs live outside this component).
 */
export function OneSearchInput({
  query,
  onQueryChange,
  onSubmit,
  variant = 'landing',
  onImageUpload,
  imageUploading = false,
  visualArtifact,
  onClearVisual,
  onClearQuery,
  onVoiceQuery,
  voiceSearchEnabled = false,
  disabled = false,
  className,
}: OneSearchInputProps) {
  const { t, i18n } = useTranslation();
  const { status: voiceStatus, error: voiceError, startRecording, stopRecording, cancelRecording } =
    useVoiceSearch(i18n.language.startsWith('fa') ? 'fa' : 'en');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCompact = variant === 'compact';

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const minLinePx = isCompact ? 18 : 20;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(
      Math.max(textarea.scrollHeight, minLinePx),
      isCompact ? 120 : 160
    )}px`;
  }, [isCompact]);

  useEffect(() => {
    adjustHeight();
  }, [query, adjustHeight]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && !imageUploading) {
          onSubmit(e as unknown as React.FormEvent);
        }
      }
    },
    [disabled, imageUploading, onSubmit]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!onImageUpload || disabled || imageUploading) return;
      e.preventDefault();
      setIsDragging(true);
    },
    [onImageUpload, disabled, imageUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!onImageUpload || disabled || imageUploading) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [onImageUpload, disabled, imageUploading]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!onImageUpload || disabled || imageUploading) return;
      const file = imageFileFromDataTransfer(e.dataTransfer);
      if (file) onImageUpload(file);
    },
    [onImageUpload, disabled, imageUploading]
  );

  const canSubmit = query.trim().length > 0 || !!visualArtifact?.artifact_id;
  const hasVisual =
    Boolean(visualArtifact?.artifact_id || visualArtifact?.previewUrl) || imageUploading;
  const showPlaceholder = !hasVisual && !query.trim();

  const handleMicClick = useCallback(async () => {
    if (!voiceSearchEnabled || !onVoiceQuery) return;
    if (voiceStatus === 'recording') {
      const transcript = await stopRecording();
      if (transcript) {
        onVoiceQuery(transcript);
      }
      return;
    }
    if (voiceStatus === 'idle') {
      await startRecording();
    }
  }, [voiceSearchEnabled, onVoiceQuery, voiceStatus, stopRecording, startRecording]);

  useEffect(() => {
    return () => cancelRecording();
  }, [cancelRecording]);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative overflow-hidden',
          omniboxPillClassName(isDragging, isCompact),
          !isDragging && 'border-transparent',
          isCompact ? 'shadow-none' : 'shadow-sm focus-within:shadow-md'
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary/50 bg-primary/[0.08] px-4 dark:bg-primary/[0.12]"
            aria-live="polite"
          >
            <p className="text-center text-sm font-medium text-primary">
              {t('searchHub.imageToolbar.dropImage')}
            </p>
          </div>
        )}

        <div
          className={cn(
            'flex w-full min-w-0 items-center gap-1',
            isCompact && 'flex-wrap',
            isDragging && 'opacity-40'
          )}
        >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400',
            isCompact && hasVisual && 'max-sm:hidden'
          )}
          aria-hidden
        >
          <PiMagnifyingGlassBold className="h-4 w-4" />
        </div>

        {visualArtifact && onClearVisual ? (
          <VisualSearchChip
            artifactId={visualArtifact.artifact_id}
            filename={visualArtifact.filename}
            previewUrl={visualArtifact.previewUrl}
            uploading={imageUploading}
            onRemove={onClearVisual}
            size="compact"
            className={cn('shrink-0 self-center', isCompact && 'max-w-[min(42vw,9.5rem)]')}
          />
        ) : null}

        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={showPlaceholder ? t('searchHub.omniboxPlaceholder') : ''}
          disabled={disabled || imageUploading}
          rows={1}
          dir="auto"
          className={cn(
            omniboxTextareaClassName(isCompact),
            'min-w-0 flex-1 self-center',
            hasVisual &&
              !query.trim() &&
              (isCompact ? 'max-w-[5rem] basis-12 sm:max-w-[8rem]' : 'max-w-xs')
          )}
        />

        <div
          className={cn(
            'flex shrink-0 items-center gap-0.5',
            isCompact && 'ms-auto'
          )}
        >
          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                if (onClearQuery) onClearQuery();
                else onQueryChange('');
              }}
              className={cn(
                'flex items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200/50 hover:text-gray-600 dark:hover:bg-gray-200/40',
                isCompact ? 'h-8 w-8' : 'h-8 w-8'
              )}
              aria-label={t('searchHub.clearQuery')}
            >
              <PiXBold className="h-4 w-4" />
            </button>
          )}

          {voiceSearchEnabled && onVoiceQuery ? (
            <button
              type="button"
              onClick={() => void handleMicClick()}
              className={cn(
                'flex items-center justify-center rounded-full transition-colors hover:bg-gray-200/50 hover:text-gray-600 dark:hover:bg-gray-200/40',
                'h-8 w-8',
                voiceStatus === 'recording' && 'bg-red-100 text-red-600 animate-pulse',
                isCompact && hasVisual && 'max-sm:hidden'
              )}
              title={
                voiceStatus === 'recording'
                  ? t('searchHub.voiceSearch.recording')
                  : voiceStatus === 'transcribing'
                    ? t('searchHub.voiceSearch.transcribing')
                    : t('searchHub.voiceSearch.start')
              }
              aria-label={t('searchHub.voiceSearch.start')}
            >
              <PiMicrophoneBold className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                'flex items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200/50 hover:text-gray-600 dark:hover:bg-gray-200/40',
                'h-8 w-8',
                isCompact && hasVisual && 'max-sm:hidden'
              )}
              title={t('searchHub.voiceStub')}
              aria-label={t('searchHub.voiceStub')}
              disabled
            >
              <PiMicrophoneBold className="h-4 w-4" />
            </button>
          )}

          {onImageUpload ? (
            <VisualSearchCameraButton
              size={isCompact ? 'default' : 'large'}
              disabled={imageUploading || disabled}
              onImageSelect={onImageUpload}
            />
          ) : null}

          <Button
            type="submit"
            size={isCompact ? 'sm' : 'md'}
            disabled={!canSubmit || disabled || imageUploading}
            className={cn(
              'shrink-0 rounded-full',
              isCompact ? 'h-8 px-3 text-xs' : 'h-8 px-3.5 text-sm'
            )}
            aria-label={t('searchHub.runSearch')}
          >
            {isCompact ? (
              <>
                <span className="hidden md:inline">{t('searchHub.runSearch')}</span>
                <PiMagnifyingGlassBold className="h-4 w-4 md:hidden" aria-hidden />
              </>
            ) : (
              t('searchHub.runSearch')
            )}
          </Button>
        </div>
        </div>
        {voiceError && voiceSearchEnabled ? (
          <Text className="mt-1 px-2 text-xs text-amber-700 dark:text-amber-300">
            {voiceError}
          </Text>
        ) : null}
      </div>
    </div>
  );
}

export default OneSearchInput;
