'use client';

import { useCallback, useRef, useState } from 'react';
import { oneSearchApi } from '@/services/one-search-api.service';

export type VoiceSearchStatus = 'idle' | 'recording' | 'transcribing' | 'error';

export interface UseVoiceSearchResult {
  status: VoiceSearchStatus;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => void;
}

function speechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

/** Record audio → STT API with Web Speech API fallback. */
export function useVoiceSearch(language = 'auto'): UseVoiceSearchResult {
  const [status, setStatus] = useState<VoiceSearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cancelRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    setStatus('idle');
    setError(null);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
      setStatus('error');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    return new Promise((resolve) => {
      recorder.onstop = () => {
        void (async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          recorder.stream.getTracks().forEach((t) => t.stop());
          recorderRef.current = null;
          chunksRef.current = [];
          setStatus('transcribing');

          try {
            const res = await oneSearchApi.transcribeAudio(blob, language);
            setStatus('idle');
            resolve(res.transcript.trim() || null);
            return;
          } catch {
            /* fall through to browser STT */
          }

          if (speechRecognitionSupported()) {
            try {
              const Ctor =
                (window as unknown as { SpeechRecognition: new () => SpeechRecognition })
                  .SpeechRecognition ||
                (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition })
                  .webkitSpeechRecognition;
              const recognition = new Ctor();
              recognition.lang = language === 'fa' ? 'fa-IR' : language === 'en' ? 'en-US' : 'fa-IR';
              recognition.interimResults = false;
              recognition.maxAlternatives = 1;
              recognition.onresult = (event: SpeechRecognitionEvent) => {
                const text = event.results[0]?.[0]?.transcript?.trim() ?? '';
                setStatus('idle');
                resolve(text || null);
              };
              recognition.onerror = () => {
                setStatus('error');
                setError('Speech recognition failed');
                resolve(null);
              };
              recognition.start();
              return;
            } catch {
              /* ignore */
            }
          }

          setStatus('error');
          setError('STT unavailable — configure POST /search/stt');
          resolve(null);
        })();
      };
      recorder.stop();
    });
  }, [language]);

  return { status, error, startRecording, stopRecording, cancelRecording };
}
