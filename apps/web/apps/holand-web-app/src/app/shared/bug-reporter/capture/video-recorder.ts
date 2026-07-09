export type VideoSource = 'screen' | 'webcam';

export interface VideoRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  hasPermission: boolean | null;
  error: string | null;
  blob: Blob | null;
}

const MAX_DURATION_MS = 2 * 60 * 1000;
const SUPPORTED =
  typeof MediaRecorder !== 'undefined' &&
  typeof navigator.mediaDevices?.getDisplayMedia !== 'undefined';

export function isVideoRecordingSupported(): boolean {
  return SUPPORTED;
}

export async function requestScreenCapture(): Promise<MediaStream | null> {
  if (!SUPPORTED) {
    throw new Error('Screen recording not supported in this browser');
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    return stream;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      return null;
    }
    throw err;
  }
}

export async function requestWebcamCapture(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Webcam recording not supported in this browser');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    return stream;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      return null;
    }
    throw err;
  }
}

export async function requestVideoCapture(source: VideoSource): Promise<MediaStream | null> {
  return source === 'webcam' ? requestWebcamCapture() : requestScreenCapture();
}

export function createVideoRecorder(
  stream: MediaStream,
  onError: (error: string) => void
): {
  start: () => void;
  stop: () => Promise<Blob | null>;
  pause: () => void;
  resume: () => void;
  getState: () => MediaRecorder['state'];
} {
  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  let stopResolve: ((blob: Blob | null) => void) | null = null;

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/webm';

  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch {
    throw new Error('Failed to create MediaRecorder');
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.onstop = () => {
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }

    stream.getTracks().forEach((track) => track.stop());

    const blob = chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null;
    stopResolve?.(blob);
    stopResolve = null;
  };

  recorder.onerror = (event) => {
    onError(`Recording error: ${(event as Event & { error?: { message?: string } }).error?.message || 'Unknown error'}`);
    stopResolve?.(null);
    stopResolve = null;
  };

  stream.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  });

  return {
    start: () => {
      if (recorder.state === 'inactive') {
        chunks.length = 0;
        recorder.start(1000);

        maxDurationTimer = setTimeout(() => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }, MAX_DURATION_MS);
      }
    },
    stop: () => {
      return new Promise<Blob | null>((resolve) => {
        if (recorder.state === 'inactive') {
          resolve(chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null);
          return;
        }

        stopResolve = resolve;
        recorder.stop();
      });
    },
    pause: () => {
      if (recorder.state === 'recording') {
        recorder.pause();
      }
    },
    resume: () => {
      if (recorder.state === 'paused') {
        recorder.resume();
      }
    },
    getState: () => recorder.state,
  };
}
