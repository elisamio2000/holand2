'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiMicrophoneBold, PiStopBold, PiTrashBold, PiPaperPlaneTiltBold } from 'react-icons/pi';
import AudioPlayer from '@/components/audio-player';
import cn from '@core/utils/class-names';

type VoiceNoteRecorderProps = {
  onRecorded: (blob: Blob, durationMs: number) => void;
  onCancel: () => void;
  className?: string;
};

export default function VoiceNoteRecorder({
  onRecorded,
  onCancel,
  className,
}: VoiceNoteRecorderProps) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        setPreviewUrl(URL.createObjectURL(blob));
        setDurationMs(Date.now() - startRef.current);
      };
      recorderRef.current = recorder;
      startRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch {
      onCancel();
    }
  }, [onCancel]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
  }, []);

  const handleSend = () => {
    if (!previewUrl) return;
    fetch(previewUrl)
      .then((r) => r.blob())
      .then((blob) => onRecorded(blob, durationMs));
  };

  return (
    <div className={cn('rounded-xl border border-muted bg-gray-0 p-3 dark:bg-gray-50', className)}>
      {!previewUrl ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              recording ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-white'
            )}
          >
            {recording ? <PiStopBold className="h-4 w-4" /> : <PiMicrophoneBold className="h-4 w-4" />}
          </button>
          <span className="text-xs text-gray-500">
            {recording ? t('messages.voice.recording') : t('messages.voice.tapToRecord')}
          </span>
          <button type="button" onClick={onCancel} className="ms-auto text-xs text-gray-400">
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Legacy exception: ephemeral blob preview — not MPS (see media-playback/LEGACY-EXCEPTIONS.md). */}
          <AudioPlayer src={previewUrl} variant="chatInline" title={t('messages.voice.preview')} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPreviewUrl(null);
                onCancel();
              }}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <PiTrashBold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-white"
            >
              <PiPaperPlaneTiltBold className="h-3.5 w-3.5" />
              {t('messages.voice.send')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
