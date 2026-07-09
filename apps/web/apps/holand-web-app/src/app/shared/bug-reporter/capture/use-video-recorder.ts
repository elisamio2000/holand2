'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createVideoRecorder,
  isVideoRecordingSupported,
  requestVideoCapture,
  type VideoSource,
} from './video-recorder';

export interface VideoRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  hasPermission: boolean | null;
  error: string | null;
  source: VideoSource;
}

export interface VideoRecorderActions {
  startRecording: (source?: VideoSource) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  setSource: (source: VideoSource) => void;
  isSupported: boolean;
}

export function useVideoRecorder(): VideoRecorderState & VideoRecorderActions {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<VideoSource>('screen');

  const recorderRef = useRef<ReturnType<typeof createVideoRecorder> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async (captureSource?: VideoSource) => {
    const activeSource = captureSource ?? source;

    if (!isVideoRecordingSupported() && activeSource === 'screen') {
      setError('Screen recording is not supported in this browser');
      return;
    }

    setError(null);
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);

    try {
      const stream = await requestVideoCapture(activeSource);

      if (!stream) {
        setHasPermission(false);
        setError(
          activeSource === 'webcam'
            ? 'Webcam permission denied'
            : 'Screen capture permission denied'
        );
        return;
      }

      setHasPermission(true);

      recorderRef.current = createVideoRecorder(stream, (errorMsg) => {
        setError(errorMsg);
        setIsRecording(false);
      });

      recorderRef.current.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();

      durationTimerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, [source]);

  const stopRecording = useCallback(async () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    let blob: Blob | null = null;
    if (recorderRef.current) {
      blob = await recorderRef.current.stop();
      recorderRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);
    return blob;
  }, []);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current && isRecording && !isPaused) {
      recorderRef.current.pause();
      setIsPaused(true);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current && isRecording && isPaused) {
      recorderRef.current.resume();
      setIsPaused(false);
      startTimeRef.current = Date.now() - duration * 1000;
      durationTimerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
  }, [isRecording, isPaused, duration]);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        void recorderRef.current.stop();
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    hasPermission,
    error,
    source,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    setSource,
    isSupported: isVideoRecordingSupported(),
  };
}
