'use client';

import { PiBugBeetleBold, PiStopCircleBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { useBugReporter } from '../context/bug-reporter-context';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

export default function GlobalBugReporterFab() {
  const { t } = useTranslation();
  const { isEnabled, capturePhase, recordingDuration, toggleCapture } = useBugReporter();

  if (!isEnabled) return null;
  if (capturePhase === 'composing') return null;

  const isRecording = capturePhase === 'recording';

  return (
    <button
      type="button"
      onClick={() => void toggleCapture()}
      className={cn(
        'global-bug-reporter-fab rr-block fixed bottom-6 end-6 z-[8990]',
        'flex items-center justify-center rounded-full shadow-2xl',
        'transition-all duration-300 hover:scale-105 active:scale-95',
        isRecording
          ? 'h-auto min-w-14 gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 ring-2 ring-red-300 ring-offset-2'
          : 'h-14 w-14 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500',
        'text-white'
      )}
      aria-label={
        isRecording
          ? t('messages.bugReport.stopRecording', 'Stop recording')
          : t('messages.bugReport.reportBug', 'Report bug')
      }
      title={
        isRecording
          ? t('messages.bugReport.stopRecording', 'Stop recording')
          : t('messages.bugReport.startRecording', 'Start recording session')
      }
    >
      {isRecording ? (
        <>
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
            <PiStopCircleBold className="relative h-5 w-5" />
          </span>
          <span className="font-mono text-sm font-semibold">
            {formatDuration(recordingDuration)}
          </span>
        </>
      ) : (
        <PiBugBeetleBold className="h-6 w-6" />
      )}
    </button>
  );
}
